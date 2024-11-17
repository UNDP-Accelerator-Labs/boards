import { Group } from './groups.mjs';
import { Matrix } from './matrixes.mjs';
import { Card } from './cards.mjs';
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
		let { content, color, x, y, id, tree: ntree, pipe_from } = datum;
		if (!content) content = '';
		if (!color) color = colors(0);
		const { k } = d3.select('div.canvas').datum();
		// GET ALL UNMOVED NOTES, TO CHECK FOR VISUAL OVERLAP/CLUTTER AND OFFSET IF NEEDED
		const otherNotesAtOrigin = d3.selectAll('div.note.unmoved');
		if (x === undefined) x = 10 * otherNotesAtOrigin.size();
		if (y === undefined) y = 10 * otherNotesAtOrigin.size();
		// CHECK IF THIS IS A NEW NOTE
		if (!id) datum = await POST('/addNote', { data: { content, color, x, y, tree: ntree, pipe_from }, project: wallId });
		// REMOVE FOCUS FROM ALL OBJECTS
		constructorRef.releaseAll(bcast);
		Card.releaseAll(bcast);
		Group.releaseAll(bcast);
		Matrix.releaseAll(bcast);
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
			})
		.on('dblclick', function () {
			d3.event.stopPropagation();
		});
		// ADD A SIDEBAR TO SELECT THE COLOR OF THE NOTE
		note.addElems('div', 'color-swatches')
			.addElems('div', 'color', d3.range(nColors).map(d => colors(d)))
		.on('mousedown', async d => {
			d3.event.stopPropagation();
			// SAVE AND BROADCAST
			await constructorRef.update({ 
				note,
				datum: { color: d },
				bcast: true,
				pipe_note: true,
			});
		}).on('mousemove', _ => {
			d3.event.stopPropagation();
		}).on('mouseup', _ => {
			d3.event.stopPropagation();
		}).style('background-color', d => d);
		// ADD A STICKY AREA TO MOVE THE NOTE AROUND
		note.addElems('div', 'sticky-area')
			.style('height', `${Math.min(75, 30 * 1 / k / 2)}px`);
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
				Card.releaseAll(true);
				Group.releaseAll(true);
				Matrix.releaseAll(true);
			}
			constructorRef.lock({ note, id, bcast: true });
		}).on('focusout', async function (d) {
			// SAVE AND BROADCAST
			d.content = this.value.trim() || d.content;
			await constructorRef.update({ 
				note, 
				datum: { content: d.content },
				bcast: true,
				pipe_note: true,
			});
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
		let { note, datum, group_pipes, pipe_note, bcast } = _kwargs;
		if (!note) {
			const { id, pipe_from } = datum;
			if (id) {
				note = d3.selectAll('div.note')
					.filter(d => d.id === id);
			} else if (pipe_from) {
				note = d3.selectAll('div.note')
					.filter(d => d.pipe_from === pipe_from);
			}
			// IF NO NOTE IS FOUND, CREATE THE NOTE
			if (!note.node()) { // THE NOTE DOES NOT YET EXIST
				return constructorRef.add({ datum, bcast });
			}
		}
		if (datum) {
			note.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { tree: ntree, id: nid, content } = note.datum();
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
		// CHECK FOR PIPING

		console.log('group pipes', group_pipes)
		if (group_pipes !== undefined) {
			if (group_pipes?.length) {
				// ADD THE NOTES TO THE PIPED GROUP
				for (let p = 0; p < group_pipes.length; p ++) {
					const pipe = group_pipes[p];
					let { tree: ptree } = d3.selectAll('div.group')
						.filter(d => d.id === pipe).datum();
					// REPLACE THE PIPED GROUP'S ID IN THE tree
					ptree = tree.update(ptree || '0', pipe);
					const { id: forget_id, tree: forget_tree, x: forget_x, y: forget_y, pipe_from: forget_piping, ...data_to_pass } = note.datum();
					await constructorRef.update({ 
						datum: { ...data_to_pass, ...{ tree: ptree, x: null, y: null, pipe_from: nid } },
						bcast,
					});
					
				}
			} else {
				// REMOVE THE NOTES FROM THE PIPED GROUP
				const note_pipes = d3.selectAll('div.note')
					.filter(d => d.pipe_from === nid);
				if (note_pipes.size()) {
					const notes = [...note_pipes.nodes()];
					for (let n = 0; n < notes.length; n ++) {
						await constructorRef.remove({ 
							note: d3.select(notes[n]),
							bcast,
						});
					}
				}
			}
		}
		if (pipe_note) {
			const note_pipes = d3.selectAll('div.note')
				.filter(d => d.pipe_from === nid);
			if (note_pipes.size()) {
				const notes = [...note_pipes.nodes()];
				for (let n = 0; n < notes.length; n ++) {
					await constructorRef.update({ 
						note: d3.select(notes[n]),
						datum,
						bcast,
					});
				}
			}
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
		const { id: nid, tree: ntree } = note.datum();
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(note.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: note.datum().id } });
		}
		// DELETE ALL PIPED NOTES
		const note_pipes = d3.selectAll('div.note')
			.filter(d => d.pipe_from === nid);
		if (note_pipes.size()) {
			const notes = [...note_pipes.nodes()];
			for (let n = 0; n < notes.length; n ++) {
				await constructorRef.remove({ 
					note: d3.select(notes[n]),
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
					const children = group.selectAll('div.group, div.note, div.card').size();
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