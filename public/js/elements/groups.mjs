import { Note } from './notes.mjs';
import { Card } from './cards.mjs';
import { POST, DELETE, wallId, tree, computeAbsCoordinates } from '../helpers/index.mjs';
import { drag } from './drag.mjs';
import { broadcast } from '../websocket/index.mjs';

export const Group = {
	add: async function (_kwargs) {
		const constructorRef = this;
		let { parent, datum, children, focus, bcast, client } = _kwargs;
		if (!datum) datum = {};
		let { id, label, x, y, tree: gtree } = datum;
		if (!label) label = '';
		if (!x) x = 0;
		if (!y) y = 0;

		console.log(x,y)
		// CHECK IF THIS IS A NEW GROUP
		if (!id) datum = await POST('/addGroup', { data: { label, x, y, tree: gtree }, project: wallId });
		// REMOVE FOCUS FROM ALL OBJECTS
		constructorRef.releaseAll(bcast);
		Note.releaseAll(bcast);
		Card.releaseAll(bcast);
		// CHECK IF THIS IS TO BE A CHILD GROUP
		const child = tree.getDepth(gtree) > 1;
		if (!parent) {
			if (child) {
				const parentNode = d3.selectAll('div.group').filter(d => d.tree === tree.moveUp(gtree) && d.id === +tree.getLeaf(gtree)).node();
				if (parentNode) parent = d3.select(parentNode);
			} else parent = d3.select('div.canvas');
		}
		// ADD A GROUP
		const group = parent
		.addElem('div', 'group')
			.datum(datum)
			.classed('child', child)
			.classed('focus', focus)
			.classed('locked', client)
			.styles({
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null,
			});
		// ADD A STICKY AREA TO MOVE THE GROUP AROUND
		group.addElems('div', 'sticky-area');
		// ADD THE LABEL
		const input = group.addElems('input')
		.attrs({
			'type': 'text',
			'placeholder': 'New group',
			'value': d => d.label,
		}).on('mousedown', _ => {
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
				Note.releaseAll(true);
				Card.releaseAll(true);
			}
			constructorRef.lock({ group, id, bcast: true });

		}).on('focusout', async function (d) {
			const { id } = d;
			d.label = this.value.trim() || d.label;
			await constructorRef.save(d);
			constructorRef.broadcast({ operation: 'update', data: d });
			constructorRef.release({ group, id, bcast: true });
		});
		if (focus) input.node().focus();

		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(group.datum());
			constructorRef.broadcast({ operation: 'add', data: group.datum() });
		}
		// THE SAVE AND BROADCAST NEEDS TO COME BEFORE HANDLING THE CHILDREN HERE
		// BECAUSE OTHERWISE, THE CHILDREN GET UPDATED BEFORE THE GROUP IS CREATED
		// IN THE DISPATCHED INSTANCES

		// APPEND ALL NEW CHILDREN TO THE GROUP
		if (children?.length) {
			for (let i = 0; i < children.length; i ++) {
				const child = children[i]
				const x = null;
				const y = null;
				const { id: gid, tree: gtree } = group.datum();
				const ctree = tree.rebase(child.datum().tree, gid, gtree);

				if (child.classed('note')) {
					await Note.update({ 
						note: child, 
						datum: { x, y, tree: ctree },
						bcast, // THIS OPERATION MAY BE REDUNDATN
					});
				} else if (child.classed('card')) {
					await Card.update({ 
						card: child, 
						datum: { x, y, tree: ctree },
						bcast, // THIS OPERATION MAY BE REDUNDATN
					});
				} else if (child.classed('group')) {
					await constructorRef.update({ 
						group: child, 
						datum: { x, y, tree: ctree },
						bcast, // THIS OPERATION MAY BE REDUNDATN
					});
				}
			}
		}

		group.call(drag);
		return group;
	},
	update: async function (_kwargs) {
		const constructorRef = this;
		let { group, datum, bcast } = _kwargs;
		if (!group) {
			const { id } = datum;
			group = d3.selectAll('div.group')
				.filter(d => d.id === id);
		}
		if (datum) {
			group.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { tree: gtree, id: gid } = group.datum();
		const child = tree.getDepth(gtree) > 1;

		if (!child && !group.node().parentNode.classList.contains('canvas')) {
			group.moveTo('canvas');
		} else if (child) { // THIS DOES NOTHING FOR NOW
			const expectedParent = d3.selectAll('.group').filter(d => d.tree === tree.moveUp(gtree) && d.id === +tree.getLeaf(gtree));
			if (expectedParent.node() && group.node().parentNode !== expectedParent.node()) {
				expectedParent.node().appendChild(group.node());
			}
		}
		group.classed('child', child)
			.classed('hit', false)
			.styles({
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null,
			});
		group.select('input[type=text]')
			.attr('value', d => d.label);
		
		// UPDATE ALL CHILDREN
		const children = group.selectAll('div.child')
			.filter(function () {
				return this.parentNode === group.node();
			});
		const rmGroup = children.size() <= 1;

		const childNodes = children.nodes();
		for (let i = 0; i < childNodes.length; i ++) {
			const child = childNodes[i];
			const sel = d3.select(child);
			const d = sel.datum();
			let x = null;
			let y = null;
			let ctree = tree.rebase(d.tree, gid, gtree);
			
			if (rmGroup) {
				ctree = tree.cutBranch(d.tree, gid);
				if (tree.getDepth(ctree) === 1) {
					const [ nx, ny ] = computeAbsCoordinates(sel, d3.select('.canvas'));
					x = nx;
					y = ny;
				}
			}

			if (sel.classed('note')) {
				await Note.update({
					note: sel,
					datum: { tree: ctree, x, y },
					bcast,
				});
			} else if (sel.classed('card')) {
				await Card.update({
					card: sel,
					datum: { tree: ctree, x, y },
					bcast,
				});
			} else if (sel.classed('group')) {
				await constructorRef.update({
					group: sel,
					datum: { tree: ctree, x, y },
					bcast,
				})
			}
		}

		if (rmGroup) {
			return await constructorRef.remove({ group, gid, bcast });
		} else {
			// SAVE AND BROADCAST
			if (bcast) {
				await constructorRef.save(group.datum());
				constructorRef.broadcast({ operation: 'update', data: group.datum() });
			}
			return group;
		}
	},
	remove: async function (_kwargs) {
		const constructorRef = this;
		let { group, id, bcast } = _kwargs;
		if (!group?.node() && !id) {
			return console.log('cannot find group to remove');
		} else if (!group?.node() && id) {
			group = d3.selectAll('div.group')
				.filter(d => d.id === id);
		}
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(group.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: group.datum().id } });
		}

		group.remove();
		return null;
	},
	lock: function (_kwargs) {
		const constructorRef = this;
		let { group, id, bcast, client } = _kwargs;
		if (!group?.node() && !id) {
			return console.log('cannot find group to remove');
		} else if (!group?.node() && id) {
			group = d3.selectAll('div.group')
				.filter(d => d.id === id);
		}
		console.log('lock grroup')
		if (client) {
			let label = `Locked by ${client}`;
			if (label.length > 30) label = `${label.slice(0, 30)}…`

			group.classed('focus', false)
				.classed('locked', true)
				.attr('data-locked-by', label);
		} else group.classed('focus', true);
		if (bcast) constructorRef.broadcast({ operation: 'lock', data: { id } });
	},
	release: function (_kwargs) {
		const constructorRef = this;
		let { group, id, bcast } = _kwargs;
		if (!group?.node() && !id) {
			return console.log('cannot find group to remove');
		} else if (!group?.node() && id) {
			group = d3.selectAll('div.group')
				.filter(d => d.id === id);
		}
		group.classed('focus', false)
			.classed('dragging', false)
			.classed('hit', false)
			.classed('locked', false)
			.attr('data-locked-by', null);

		if (bcast) constructorRef.broadcast({ operation: 'release', data: { id } });
	},
	releaseAll: function (bcast) {
		const constructorRef = this;
		if (!bcast) bcast = false;
		d3.selectAll('div.group.focus')
		.each(function (d) {
			const { id } = d;
			const sel = d3.select(this);
			constructorRef.release({ group: sel, id, bcast });
		});
	},
	save: async function (data) {
		if (wallId) await POST('/updateGroup', { data, project: wallId });
		else console.log('error: no project to save to');
	},
	delete: async function (id) {
		if (wallId && id) await DELETE(`/removeGroup?groupId=${id}&wallId=${wallId}`);
		else console.log('error: no group to delete');
	},
	broadcast: function (_kwargs) {
		const { operation, data } = _kwargs;
		if (operation) {
			broadcast.object({ 
				object: 'group',
				operation,
				data,
			});
		} else console.log('error: no broadcast operation provided');
	}
}