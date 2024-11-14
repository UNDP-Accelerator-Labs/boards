import { Group } from './groups.mjs';
import { Note } from './notes.mjs';
import { Matrix } from './matrixes.mjs';
import { POST, DELETE, wallId, tree, computeAbsCoordinates } from '../helpers/index.mjs';
import { drag } from './drag.mjs';
import { broadcast } from '../websocket/index.mjs';

export const Card = {
	add: async function (_kwargs) {
		const constructorRef = this;
		let { datum, i, focus, bcast, client } = _kwargs;
		if (!datum) datum = {}; // MAKE SURE THERE IS A datum OBJECT TO DESTRUCTURE BELOW
		let { content, x, y, id, tree: ntree } = datum;
		if (!content) content = {};
		// GET ALL UNMOVED NOTES, TO CHECK FOR VISUAL OVERLAP/CLUTTER AND OFFSET IF NEEDED
		const otherCardsAtOrigin = d3.selectAll('div.card.unmoved');
		if (x === undefined) x = 300 * Math.floor(i / 10);
		if (y === undefined) y = 300 * (i % 10);
		// CHECK IF THIS IS A NEW CARD
		if (!id) datum = await POST('/addCard', { data: { content, x, y }, project: wallId });
		// REMOVE FOCUS FROM ALL OBJECTS
		constructorRef.releaseAll(bcast);
		Note.releaseAll(bcast);
		Group.releaseAll(bcast);
		Matrix.releaseAll(bcast);
		//.classed('focus', false)
		// CHECK IF THIS IS TO BE A CHILD GROUP
		let parent = d3.select('div.canvas');
		const child = tree.getDepth(ntree) > 1;
		if (child) {
			const parentNode = d3.selectAll('div.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree)).node();
			if (parentNode) parent = d3.select(parentNode);
		} 
		// else if (!x || !y) {
		// 	parent = d3.select('div.deck');
		// }
		// ADD A CARD
		const card = parent
		.addElem('div', 'card')
			.datum(datum)
			.classed('unmoved', d => !d.x && !d.y)
			.classed('child', child)
			.classed('focus', focus)
			.classed('locked', client)
			.styles({ 
				'transform': d => {
					if (!child) {
						if (!d.x) d.x = x;
						if (!d.y) d.y = y;
						return `translate(${d.x}px, ${d.y}px)`;
					} else return null;
				}, 
			});
		// ADD A STICKY AREA TO MOVE THE CARD AROUND
		card.addElems('div', 'sticky-area');
		// ADD THE IMAGE IF IT EXISTS
		card.addElems('img', null, d => d.content?.img ? [d.content.img] : [])
		.attr('src', d => d);
		card.addElems('a', null, d => d.content?.title ? [d.content] : [])
			.attrs({
				'target': '_blank',
				'href': d => d.source,
			}).addElems('h1')
		.html(d => d.title);
		card.addElems('p', null, d => d.content?.txt ? [d.content.txt] : [])
		.html(d => {
			if (d.length > 200) return `${d.slice(0, 200)}…`;
			else return d;
		});
		
		card.call(drag);
		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(card.datum());
			constructorRef.broadcast({ operation: 'add', data: card.datum() });
		}
		return card;
	},
	update: async function (_kwargs) {
		const constructorRef = this;
		let { card, datum, bcast } = _kwargs;
		if (!card) {
			const { id } = datum;
			card = d3.selectAll('div.card')
				.filter(d => d.id === id);
		}
		if (datum) {
			card.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { tree: ntree } = card.datum();
		const child = tree.getDepth(ntree) > 1;

		if (!child && !card.node().parentNode.classList.contains('canvas')) {
			card.moveTo('canvas');
		} else if (child) { // THIS DOES NOTHING FOR NOW
			const expectedParent = d3.selectAll('.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree));
			if (expectedParent.node() && card.node().parentNode !== expectedParent.node()) {
				expectedParent.node().appendChild(card.node());
			}
		}
		card.classed('child', child)
			.classed('hit', false)
			.styles({ 
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null,
			});

		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(card.datum());
			constructorRef.broadcast({ operation: 'update', data: card.datum() });
		}
		return card;
	},
	remove: async function (_kwargs) {
		const constructorRef = this;
		let { card, id, bcast } = _kwargs;
		if (!card?.node() && !id) {
			return console.log('cannot find card to remove');
		} else if (!card?.node() && id) {
			card = d3.selectAll('div.card')
				.filter(d => d.id === id);
		}
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(card.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: card.datum().id } });
		}

		card.remove();
		return null;
	},
	lock: function (_kwargs) {
		const constructorRef = this;
		let { card, id, bcast, client } = _kwargs;
		if (!card?.node() && !id) {
			return console.log('cannot find card to remove');
		} else if (!card?.node() && id) {
			card = d3.selectAll('div.card')
				.filter(d => d.id === id);
		}
		if (client) {
			let label = `Locked by ${client}`;
			if (label.length > 30) label = `${label.slice(0, 30)}…`

			card.classed('focus', false)
				.classed('locked', true)
				.attr('data-locked-by', label);
		} else card.classed('focus', true);
		if (bcast) constructorRef.broadcast({ operation: 'lock', data: { id } });
	},
	release: function (_kwargs) {
		const constructorRef = this;
		let { card, id, bcast } = _kwargs;
		if (!card?.node() && !id) {
			return console.log('cannot find card to remove');
		} else if (!card?.node() && id) {
			card = d3.selectAll('div.card')
				.filter(d => d.id === id);
		}
		card.classed('focus', false)
			.classed('dragging', false)
			.classed('hit', false)
			.classed('locked', false)
			.attr('data-locked-by', null);
		if (bcast) constructorRef.broadcast({ operation: 'release', data: { id } });
	},
	releaseAll: function (bcast) {
		const constructorRef = this;
		if (!bcast) bcast = false;
		d3.selectAll('div.card.focus')
		.each(function (d) {
			const { id } = d;
			const sel = d3.select(this);
			constructorRef.release({ card: sel, id, bcast });
		});
	},
	save: async function (data) {
		if (wallId) await POST('/updateCard', { data, project: wallId });
		else console.log('error: no project to save to');
	},
	delete: async function (id) {
		if (wallId && id) await DELETE(`/removeCard?cardId=${id}&wallId=${wallId}`);
		else console.log('error: no card to delete');
	},
	broadcast: function (_kwargs) {
		const { operation, data } = _kwargs;
		if (operation) {
			broadcast.object({ 
				object: 'card',
				operation,
				data,
			});
		} else console.log('error: no broadcast operation provided');
	}
}