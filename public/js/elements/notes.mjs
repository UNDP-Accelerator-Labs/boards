import { Group } from './groups.mjs';
import { POST, DELETE, wallId, tree, computeAbsCoordinates } from '../helpers/index.mjs';
import { drag } from './drag.mjs';
import { broadcast } from '../websocket/index.mjs';

const nColors = 8;
const colors = d3.scaleOrdinal(d3.schemePastel1)
	.domain(d3.range(nColors));

export const Note = {
	add: async function (_kwargs) {
		const constructorRef = this;
		let { datum, focus, bcast, client } = _kwargs;
		if (!datum) datum = {}; // MAKE SURE THERE IS A datum OBJECT TO DESTRUCTURE BELOW
		let { content, color, x, y, id, tree: ntree } = datum;
		if (!content) content = '';
		if (!color) color = colors(0);
		// GET ALL UNMOVED NOTES, TO CHECK FOR VISUAL OVERLAP/CLUTTER AND OFFSET IF NEEDED
		const otherNotesAtOrigin = d3.selectAll('div.note.unmoved');
		if (!x) x = 10 * otherNotesAtOrigin.size();
		if (!y) y = 10 * otherNotesAtOrigin.size();
		// CHECK IF THIS IS A NEW NOTE
		if (!id) datum = await POST('/addNote', { data: { content, color, x, y }, project: wallId });
		// REMOVE FOCUS FROM ALL OBJECTS
		constructorRef.releaseAll(bcast);
		Group.releaseAll(bcast);
		//.classed('focus', false)
		// CHECK IF THIS IS TO BE A CHILD GROUP
		let parent = d3.select('div.canvas');
		const child = tree.getDepth(ntree) > 1;
		if (child) {
			const parentNode = d3.selectAll('div.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree)).node();
			if (parentNode) parent = d3.select(parentNode);
		}
		// ADD A NOTE
		const note = parent
		.addElem('div', 'note simple')
			.datum(datum)
			.classed('unmoved', d => d.x === 0 && d.y === 0)
			.classed('child', child)
			.classed('focus', focus)
			.classed('locked', client)
			.styles({ 
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null, 
				'background-color': d => d.color,
			});
		// ADD A SIDEBAR TO SELECT THE COLOR OF THE NOTE
		note.addElems('div', 'color-swatches')
			.addElems('div', 'color', d3.range(nColors).map(d => colors(d)))
		.on('mousedown', async d => {
			d3.event.stopPropagation();
			// SAVE AND BROADCAST
			await constructorRef.save(d);
			constructorRef.broadcast({ operation: 'update', data: d });
		}).on('mousemove', _ => {
			d3.event.stopPropagation();
		}).on('mouseup', _ => {
			d3.event.stopPropagation();
		}).style('background-color', d => d);
		// ADD A STICKY AREA TO MOVE THE NOTE AROUND
		note.addElems('div', 'sticky-area');
		// ADD THE TEXT AREA IN THE NOTE
		const input = note.addElems('textarea')
		.each(function (d) { this.value = d.content })
		.on('mousedown', _ => {
			d3.event.stopPropagation();
		}).on('mousemove', _ => {
			d3.event.stopPropagation();
		}).on('mouseup', _ => {
			d3.event.stopPropagation();
		}).on('keydown', _ => d3.event.stopPropagation())
		.on('focus', function (d) {
			const { id } = d;
			// REMOVE FOCUS FROM ALL OBJECTS
			if (!d3.select(this).classed('focus')) {
				constructorRef.releaseAll(true);
				Group.releaseAll(true);
			}
			constructorRef.lock({ note, id, bcast: true });
		}).on('focusout', async function (d) {
			// SAVE AND BROADCAST
			d.content = this.value.trim() || d.content;
			await constructorRef.save(d);
			constructorRef.broadcast({ operation: 'update', data: d });
		});
		if (focus) input.node().focus();
		
		note.call(drag);
		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(note.datum());
			constructorRef.broadcast({ operation: 'add', data: note.datum() });
		}
		return note;
	},
	update: async function (_kwargs) {
		const constructorRef = this;
		let { note, datum, bcast } = _kwargs;
		if (!note) {
			const { id } = datum;
			note = d3.selectAll('div.note')
				.filter(d => d.id === id);
		}
		if (datum) {
			note.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { tree: ntree } = note.datum();
		const child = tree.getDepth(ntree) > 1;

		if (!child && !note.node().parentNode.classList.contains('canvas')) {
			note.moveTo('canvas');
		} else if (child) { // THIS DOES NOTHING FOR NOW
			const expectedParent = d3.selectAll('.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree));
			if (expectedParent.node() && note.node().parentNode !== expectedParent.node()) {
				expectedParent.node().appendChild(note.node());
			}
		}
		note.classed('child', child)
			.classed('hit', false)
			.styles({ 
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null, 
				'background-color': d => d.color,
			});
		note.select('textarea')
		.each(function (d) { this.value = d.content });

		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(note.datum());
			constructorRef.broadcast({ operation: 'update', data: note.datum() });
		}
		return note;
	},
	remove: async function (_kwargs) {
		const constructorRef = this;
		let { note, id, bcast } = _kwargs;
		if (!note?.node() && !id) {
			return console.log('cannot find note to remove');
		} else if (!note?.node() && id) {
			note = d3.selectAll('div.note')
				.filter(d => d.id === id);
		}
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(note.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: note.datum().id } });
		}

		note.remove();
		return null;
	},
	lock: function (_kwargs) {
		const constructorRef = this;
		let { note, id, bcast, client } = _kwargs;
		if (!note?.node() && !id) {
			return console.log('cannot find note to remove');
		} else if (!note?.node() && id) {
			note = d3.selectAll('div.note')
				.filter(d => d.id === id);
		}
		if (client) {
			let label = `Locked by ${client}`;
			if (label.length > 30) label = `${label.slice(0, 30)}…`

			note.classed('focus', false)
				.classed('locked', true)
				.attr('data-locked-by', label);
		} else note.classed('focus', true);
		if (bcast) constructorRef.broadcast({ operation: 'lock', data: { id } });
	},
	release: function (_kwargs) {
		const constructorRef = this;
		let { note, id, bcast } = _kwargs;
		if (!note?.node() && !id) {
			return console.log('cannot find note to remove');
		} else if (!note?.node() && id) {
			note = d3.selectAll('div.note')
				.filter(d => d.id === id);
		}
		note.classed('focus', false)
			.classed('dragging', false)
			.classed('hit', false)
			.classed('locked', false)
			.attr('data-locked-by', null);
		if (bcast) constructorRef.broadcast({ operation: 'release', data: { id } });
	},
	releaseAll: function (bcast) {
		const constructorRef = this;
		if (!bcast) bcast = false;
		d3.selectAll('div.note.focus')
		.each(function (d) {
			const { id } = d;
			const sel = d3.select(this);
			constructorRef.release({ note: sel, id, bcast });
		});
	},
	save: async function (data) {
		if (wallId) await POST('/updateNote', { data, project: wallId });
		else console.log('error: no project to save to');
	},
	delete: async function (id) {
		if (wallId && id) await DELETE(`/removeNote?noteId=${id}&wallId=${wallId}`);
		else console.log('error: no note to delete');
	},
	broadcast: function (_kwargs) {
		const { operation, data } = _kwargs;
		if (operation) {
			broadcast.object({ 
				object: 'note',
				operation,
				data,
			});
		} else console.log('error: no broadcast operation provided');
	}
}