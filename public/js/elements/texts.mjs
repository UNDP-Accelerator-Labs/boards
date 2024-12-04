import { Note } from './notes.mjs';
import { Group } from './groups.mjs';
import { Matrix } from './matrixes.mjs';
import { Card } from './cards.mjs';
import { POST, DELETE, wallId, tree, computeAbsCoordinates } from '../helpers/index.mjs';
import { drag } from './drag.mjs';
import { broadcast } from '../websocket/index.mjs';

const nColors = 8;
const colors = d3.scaleOrdinal(d3.schemePastel1)
	.domain(d3.range(nColors));

export const Text = {
	add: async function (_kwargs) {
		const constructorRef = this;
		let { parent, datum, focus, bcast, client } = _kwargs;
		if (!datum) datum = {}; // MAKE SURE THERE IS A datum OBJECT TO DESTRUCTURE BELOW
		let { content, variables, x, y, id, tree: ntree } = datum;
		if (!content) content = '';
		// if (!color) color = colors(0);
		const { k } = d3.select('div.canvas').datum();
		// GET ALL UNMOVED TEXTS, TO CHECK FOR VISUAL OVERLAP/CLUTTER AND OFFSET IF NEEDED
		const otherTextAtOrigin = d3.selectAll('div.text.unmoved');
		if (x === undefined) x = 10 * otherTextAtOrigin.size();
		if (y === undefined) y = 10 * otherTextAtOrigin.size();
		// CHECK IF THIS IS A NEW TEXT
		if (!id) datum = await POST('/addText', { data: { content, variables, x, y, tree: ntree }, project: wallId });
		// REMOVE FOCUS FROM ALL OBJECTS
		constructorRef.releaseAll(bcast);
		Note.releaseAll(bcast);
		Card.releaseAll(bcast);
		Group.releaseAll(bcast);
		Matrix.releaseAll(bcast);
		// CHECK IF THIS IS TO BE A CHILD GROUP
		const child = tree.getDepth(ntree) > 1;
		if (!parent) {
			if (child) {
				const parentNode = d3.selectAll('div.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree)).node();
				if (parentNode) parent = d3.select(parentNode);
				else parent = d3.select('div.canvas');
			} else parent = d3.select('div.canvas');
		}
		// ADD A TEXT
		const text = parent
		.addElem('div', 'text')
			.datum(datum)
			.classed('unmoved', d => d.x === 0 && d.y === 0)
			.classed('child', child)
			.classed('focus', focus)
			.classed('locked', client)
			.styles({ 
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null, 
				'background-color': d => d.color,
			})
		.on('dblclick', function () {
			d3.event.stopPropagation();
		});
		// ADD A SIDEBAR TO SELECT THE COLOR OF THE TEXT
		/*
		text.addElems('div', 'color-swatches')
			.addElems('div', 'color', d3.range(nColors).map(d => colors(d)))
		.on('mousedown', async d => {
			d3.event.stopPropagation();
			// SAVE AND BROADCAST
			await constructorRef.update({ 
				text,
				datum: { color: d },
				bcast: true,
				pipe_text: true,
			});
		}).on('mousemove', _ => {
			d3.event.stopPropagation();
		}).on('mouseup', _ => {
			d3.event.stopPropagation();
		}).style('background-color', d => d);
		*/
		// ADD A STICKY AREA TO MOVE THE TEXT AROUND
		text.addElems('div', 'sticky-area vertical')
			.style('height', `${Math.min(75, 30 * 1 / k / 2)}px`);
		// ADD THE TEXT AREA IN THE TEXT
		const input = text.addElems('textarea')
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
				Card.releaseAll(true);
				Group.releaseAll(true);
				Matrix.releaseAll(true);
			}
			constructorRef.lock({ text, id, bcast: true });
		}).on('focusout', async function (d) {
			// SAVE AND BROADCAST
			const disconnect_from_pipe = this.value.trim() !== d.content;
			d.content = this.value.trim() || d.content;

			const datum = {};
			datum.content = d.content;
			if (d.pipe_from && disconnect_from_pipe) datum.pipe_from = null;

			await constructorRef.update({ 
				text, 
				// datum: { content: d.content, pipe_from: disconnect_from_pipe ? null : d.pipe_from },
				datum,
				bcast: true,
				pipe_text: true,
			});
		});
		if (focus) input.node().focus();
		
		text.call(drag);
		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(text.datum());
			constructorRef.broadcast({ operation: 'add', data: text.datum() });
		}
		return text;
	},
	update: async function (_kwargs) {
		const constructorRef = this;
		let { text, datum, group_pipes, pipe_text, bcast } = _kwargs;
		if (!text) {
			const { id, pipe_from } = datum;
			if (id) {
				text = d3.selectAll('div.text')
					.filter(d => d.id === id);
			} else if (pipe_from) {
				text = d3.selectAll('div.text')
					.filter(d => d.pipe_from === pipe_from);
			}
			// IF NO TEXT IS FOUND, CREATE THE TEXT
			if (!text.node()) { // THE TEXT DOES NOT YET EXIST
				return constructorRef.add({ datum, bcast });
			}
		}
		if (datum) {
			text.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { tree: ntree, id: nid, content } = text.datum();
		const child = tree.getDepth(ntree) > 1;

		if (!child && !text.node().parentNode.classList.contains('canvas')) {
			text.moveTo('canvas');
		} else if (child) { // THIS DOES NOTHING FOR NOW
			const expectedParent = d3.selectAll('.group').filter(d => d.tree === tree.moveUp(ntree) && d.id === +tree.getLeaf(ntree));
			if (expectedParent.node() && text.node().parentNode !== expectedParent.node()) {
				expectedParent.node().appendChild(text.node());
			}
		}
		text.classed('child', child)
			.classed('hit', false)
			.styles({ 
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null, 
				'background-color': d => d.color,
			});
		text.select('textarea')
		.each(function (d) { this.value = d.content });

		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(text.datum());
			constructorRef.broadcast({ operation: 'update', data: text.datum() });
		}
		// CHECK FOR PIPING
		if (group_pipes !== undefined) {
			if (group_pipes?.length) {
				// ADD THE TEXTS TO THE PIPED GROUP
				for (let p = 0; p < group_pipes.length; p ++) {
					const pipe = group_pipes[p];
					let { tree: ptree } = d3.selectAll('div.group')
						.filter(d => d.id === pipe).datum();
					// REPLACE THE PIPED GROUP'S ID IN THE tree
					ptree = tree.update(ptree || '0', pipe);
					const { id: forget_id, tree: forget_tree, x: forget_x, y: forget_y, pipe_from: forget_piping, ...data_to_pass } = text.datum();
					await constructorRef.update({ 
						datum: { ...data_to_pass, ...{ tree: ptree, x: null, y: null, pipe_from: nid } },
						bcast,
					});
					
				}
			} else {
				// REMOVE THE TEXTS FROM THE PIPED GROUP
				const text_pipes = d3.selectAll('div.text')
					.filter(d => d.pipe_from === nid);
				if (text_pipes.size()) {
					const texts = [...text_pipes.nodes()];
					for (let n = 0; n < texts.length; n ++) {
						await constructorRef.remove({ 
							text: d3.select(texts[n]),
							bcast,
						});
					}
				}
			}
		}
		if (pipe_text) {
			const text_pipes = d3.selectAll('div.text')
				.filter(d => d.pipe_from === nid);
			if (text_pipes.size()) {
				const texts = [...text_pipes.nodes()];
				for (let n = 0; n < texts.length; n ++) {
					await constructorRef.update({ 
						text: d3.select(texts[n]),
						datum,
						bcast,
					});
				}
			}
		}
		return text;
	},
	remove: async function (_kwargs) {
		const constructorRef = this;
		let { text, id, bcast } = _kwargs;
		if (!text?.node() && !id) {
			return console.log('cannot find text to remove');
		} else if (!text?.node() && id) {
			text = d3.selectAll('div.text')
				.filter(d => d.id === id);
		}
		const { id: nid, tree: ntree } = text.datum();
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(text.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: text.datum().id } });
		}
		// DELETE ALL PIPED TEXTS
		const text_pipes = d3.selectAll('div.text')
			.filter(d => d.pipe_from === nid);
		if (text_pipes.size()) {
			const texts = [...text_pipes.nodes()];
			for (let n = 0; n < texts.length; n ++) {
				await constructorRef.remove({ 
					text: d3.select(texts[n]),
					bcast,
				});
			}
		}
		// IF THE PARENT IS A GROUP AND THIS IS THE LAST ELEMENT IN THE GROUP
		// REMOVE THE GROUP
		const child = tree.getDepth(ntree) > 1;
		if (child) {
			const nodes = tree.getNodes(ntree);
			let i = nodes.length - 1;
			while (i >= 0) {
				const group = d3.selectAll('div.group')
				.filter(d => d.id === +nodes[i]);
				
				if (group.node()) {
					// IF THE GROUP CONTAINS ONLY ONE OR LESS CHILDREN THEN THE LAST
					// CHILD REMAINING IS THE CURRENT NODE BEING REMOVED
					// SO THE GROUP CAN BE REMOVED AS WELL
					const children = group.selectAll('div.group, div.text, div.card').size();
					if (children <= 1) {
						await Group.remove({
							group,
							bcast,
						})
					}
				}
				i--;
			}
		}

		text.remove();
		return null;
	},
	lock: function (_kwargs) {
		const constructorRef = this;
		let { text, id, bcast, client } = _kwargs;
		if (!text?.node() && !id) {
			return console.log('cannot find text to remove');
		} else if (!text?.node() && id) {
			text = d3.selectAll('div.text')
				.filter(d => d.id === id);
		}
		if (client) {
			let label = `Locked by ${client}`;
			if (label.length > 30) label = `${label.slice(0, 30)}…`

			text.classed('focus', false)
				.classed('locked', true)
				.attr('data-locked-by', label);
		} else text.classed('focus', true);
		if (bcast) constructorRef.broadcast({ operation: 'lock', data: { id } });
	},
	release: function (_kwargs) {
		const constructorRef = this;
		let { text, id, bcast } = _kwargs;
		if (!text?.node() && !id) {
			return console.log('cannot find text to remove');
		} else if (!text?.node() && id) {
			text = d3.selectAll('div.text')
				.filter(d => d.id === id);
		}
		text.classed('focus', false)
			.classed('dragging', false)
			.classed('hit', false)
			.classed('locked', false)
			.attr('data-locked-by', null);
		if (bcast) constructorRef.broadcast({ operation: 'release', data: { id } });
	},
	releaseAll: function (bcast) {
		const constructorRef = this;
		if (!bcast) bcast = false;
		d3.selectAll('div.text.focus')
		.each(function (d) {
			const { id } = d;
			const sel = d3.select(this);
			constructorRef.release({ text: sel, id, bcast });
		});
	},
	save: async function (data) {
		if (wallId) await POST('/updateText', { data, project: wallId });
		else console.log('error: no project to save to');
	},
	delete: async function (id) {
		if (wallId && id) await DELETE(`/removeText?textId=${id}&wallId=${wallId}`);
		else console.log('error: no text to delete');
	},
	broadcast: function (_kwargs) {
		const { operation, data } = _kwargs;
		if (operation) {
			broadcast.object({ 
				object: 'text',
				operation,
				data,
			});
		} else console.log('error: no broadcast operation provided');
	}
}