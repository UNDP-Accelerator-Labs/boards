import { Note } from './notes.mjs';
import { Card } from './cards.mjs';
import { Group } from './groups.mjs';
import { POST, DELETE, wallId, tree, computeAbsCoordinates } from '../helpers/index.mjs';
import { drag } from './drag.mjs';
import { broadcast } from '../websocket/index.mjs';

/*
Matrixes should be groups of groups
that are organized according to a specific pattern
with column headers (editable) and indexes (editable)
*/

export const Matrix = {
	add: async function (_kwargs) {
		const constructorRef = this;
		let { parent, datum, children, focus, bcast, client } = _kwargs;
		if (!datum) datum = {};
		let { id, label, x, y, tree: mtree, cols, rows, cells } = datum;
		if (!label) label = '';
		if (!x) x = 0;
		if (!y) y = 0;
		if (!rows) rows = new Array(2).fill('index');;
		if (!cols) cols = new Array(2).fill('header');;
		// CHECK IF THIS IS A NEW MATRIX
		if (!id) datum = await POST('/addMatrix', { data: { label, x, y, tree: mtree, rows, cols }, project: wallId });
		
		// REMOVE FOCUS FROM ALL OBJECTS
		// constructorRef.releaseAll(bcast);
		Note.releaseAll(bcast);
		Card.releaseAll(bcast);
		Group.releaseAll(bcast);
		// CHECK IF THIS IS TO BE A CHILD MATRIX
		// NOTE: MATRIX SHOULD NOT BE CHILD
		const child = tree.getDepth(mtree) > 1;
		if (!parent) {
			if (child) {
				const parentNode = d3.selectAll('div.matrix').filter(d => d.tree === tree.moveUp(mtree) && d.id === +tree.getLeaf(mtree)).node();
				if (parentNode) parent = d3.select(parentNode);
			} else parent = d3.select('div.canvas');
		}
		// ADD A MATRIX
		const matrix = parent
		.addElem('div', 'matrix')
			.datum(datum)
			.classed('child', child)
			.classed('focus', focus)
			.classed('locked', client)
			.styles({
				'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null,
				// 'grid-template-columns': d => `.5fr, repeat(${d.cols.length}, 1fr)`,
			});
		const table = matrix.addElems('table');
		// ADD STICKY AREAS TO EACH COLUMN HEADER TO MOVE THE MATRIX AROUND
		const thead = table.addElems('tr', 'head');
		thead.addElems('th', 'sticky-area immutable col-header', d => {
			const { id, cols } = d;
			const headers = cols.map((c, j) => {
				return { id, label: c, cidx: j };
			});
			headers.unshift({ id, label: d.label, cidx: -1 });
			return headers;
		}).call(constructorRef.addLabel, { constructorRef, axis: 'cols' });

		matrix.addElems('div', 'btn add-col')
			.addElems('button')
		.on('click', function () {
			constructorRef.addAxis({ matrix, axis: 'col' });
		}).html('+')
		
		// SAVE AND BROADCAST
		if (bcast) {
			await constructorRef.save(matrix.datum());
			constructorRef.broadcast({ operation: 'add', data: matrix.datum() });
		}
		// THE SAVE AND BROADCAST NEEDS TO COME BEFORE HANDLING THE CHILDREN HERE
		// BECAUSE OTHERWISE, THE CHILDREN GET UPDATED BEFORE THE MATRIXES IS CREATED
		// IN THE DISPATCHED INSTANCES
	
		// FILL IN THE MATRIX ITERATING OVER ROWS, THEN COLUMNS
		const { id: mid, tree: mdtree, cols: mcols, rows: mrows, cells: mcells } = matrix.datum();

		for (let i = 0; i < mrows.length; i ++) {
			const row = mrows[i];

			const tr = table.addElems('tr', `row-${i}`)
			tr.addElems('th', 'sticky-area immutable row-header', [{ id: mid, label: row, cidx: i }])
				.call(constructorRef.addLabel, { constructorRef, axis: 'rows' });

			for (let j = 0; j < mcols.length; j ++) {
				// CHECK FOR STORED CELLS
				let cell = mcells?.find(c => {
					return tree.getRoot(c.matrix_index) === i.toString() 
					&& tree.getLeaf(c.matrix_index) === j.toString();
				});
				let group;
				
				if (cell) {
					const td = tr.addElems('td', `cell-${j}`, [cell]);
					group = await Group.add({ 
						parent: td,
						datum: cell,
						immutable: true,
						bcast, // THIS OPERATION MAY BE REDUNDANT
					});
				} else {
					// CREATE A NEW CELL
					const ctree = tree.build(mdtree, `m${mid}`);
					const cidx = tree.build(i, j);
					cell = { tree: ctree, matrix_index: cidx, x: null, y: null };

					const td = tr.addElems('td', `cell-${j}`, [cell]);
					group = await Group.add({ 
						parent: td,
						datum: cell,
						immutable: true,
						bcast, // THIS OPERATION MAY BE REDUNDANT
					});

					// ADD A MINIMUM OF TWO NOTES
					const { tree: gtree, id: gid } = group.datum();
					const ntree = tree.build(gtree, gid);
					for (let n = 0; n < 2; n ++) {
						await Note.add({ 
							datum: { tree: ntree, x: null, y: null },
							bcast, // THIS OPERATION MAY BE REDUNDANT
						});
					}
				}

				// ADD THE (Group) CELL TO THE Matrix DATA
				// THIS IS REALLY IMPORTANT FOR ADDING ROWS AND COLS
				// AS THERE NEEDS TO BE A REPRESENTATION OF THE CELLS
				// IN THE DATA FOR THE .update FUNCTION
				matrix.each(d => {
					if (!d.cells) d.cells = [];
					d.cells.push(group.datum());
				})
			}
		}

		matrix.addElems('div', 'btn add-row')
			.addElems('button')
		.on('click', function () {
			constructorRef.addAxis({ matrix, axis: 'row' });
		}).html('+')

		matrix.call(drag);
		return matrix;
	},
	update: async function (_kwargs) { // TO DO: IMPROVE THIS
		const constructorRef = this;
		let { matrix, datum, bcast, rows, ncols } = _kwargs;

		if (!matrix) {
			const { id } = datum;
			matrix = d3.selectAll('div.matrix')
				.filter(d => d.id === id);
		}
		if (datum) {
			matrix.each(d => {
				for (let key in datum) {
					d[key] = datum[key];
				}
			});
		};
		const { id: mid, tree: mtree, cols: mcols, rows: mrows, cells: mcells } = matrix.datum();
		
		matrix.styles({
			'transform': d => (![null, undefined].includes(d.x) && ![null, undefined].includes(d.y)) ? `translate(${d.x}px, ${d.y}px)` : null,
		});

		const table = matrix.select('table');
		const thead = table.addElems('tr', 'head');
		thead.addElems('th', 'sticky-area immutable col-header', d => {
			const { id, cols } = d;
			const headers = cols.map((c, j) => {
				return { id, label: c, cidx: j };
			});
			headers.unshift({ id, label: d.label, cidx: -1 });
			return headers;
		}).call(constructorRef.addLabel, { constructorRef, axis: 'cols' });

		// UPDATE THE CONTENT OF THE MATRIX
		for (let i = 0; i < mrows.length; i ++) {
			const row = mrows[i];

			const tr = table.addElems('tr', `row-${i}`)
			tr.addElems('th', 'sticky-area immutable row-header', [{ id: mid, label: row, cidx: i }])
				.call(constructorRef.addLabel, { constructorRef, axis: 'rows' });

			for (let j = 0; j < mcols.length; j ++) {
				// CHECK FOR STORED CELLS
				let cell = mcells?.find(c => {
					return tree.getRoot(c.matrix_index) === i.toString() 
					&& tree.getLeaf(c.matrix_index) === j.toString();
				});
				
				if (!cell) { // ONLY ADD CELLS THAT DO NOT EXIST // IF A CELL ALREADY EXISTS, DO NOTHING
					// ALL TRANSFORMATIONS SHOULD BE HANDLED BY THE Group IN THE CELL
					// CREATE A NEW CELL
					const ctree = tree.build(mtree, `m${mid}`);
					const cidx = tree.build(i, j);
					cell = { tree: ctree, matrix_index: cidx, x: null, y: null };

					const td = tr.addElems('td', `cell-${j}`, [cell]);
					const group = await Group.add({ 
						parent: td,
						datum: cell,
						immutable: true,
						bcast, // THIS OPERATION MAY BE REDUNDANT
					});

					// ADD A MINIMUM OF TWO NOTES
					const { tree: gtree, id: gid } = group.datum();
					const ntree = tree.build(gtree, gid);
					for (let n = 0; n < 2; n ++) {
						await Note.add({ 
							datum: { tree: ntree, x: null, y: null },
							bcast, // THIS OPERATION MAY BE REDUNDANT
						});
					}

					// ADD THE (Group) CELL TO THE Matrix DATA
					// THIS IS REALLY IMPORTANT FOR ADDING ROWS AND COLS
					// AS THERE NEEDS TO BE A REPRESENTATION OF THE CELLS
					// IN THE DATA FOR THE .update FUNCTION
					matrix.each(d => {
						if (!d.cells) d.cells = [];
						d.cells.push(group.datum());
					})
				}
			}
		}

		// SAVE AND BROADCAST
		let rmMatrix = false;
		if (rmMatrix) {
			return await constructorRef.remove({ matrix, gid, bcast });
		} else {
			// SAVE AND BROADCAST
			if (bcast) {
				await constructorRef.save(matrix.datum());
				constructorRef.broadcast({ operation: 'update', data: matrix.datum() });
			}
			return matrix;
		}
	},
	remove: async function (_kwargs) {
		const constructorRef = this;
		let { matrix, id, bcast } = _kwargs;
		if (!matrix?.node() && !id) {
			return console.log('cannot find matrix to remove');
		} else if (!matrix?.node() && id) {
			matrix = d3.selectAll('div.matrix')
				.filter(d => d.id === id);
		}
		// DELETE AND BROADCAST
		if (bcast) {
			await constructorRef.delete(matrix.datum().id);
			constructorRef.broadcast({ operation: 'delete', data: { id: matrix.datum().id } });
		}

		matrix.remove();
		return null;
	},
	lock: function (_kwargs) {
		const constructorRef = this;
		let { matrix, id, bcast, client } = _kwargs;
		if (!matrix?.node() && !id) {
			return console.log('cannot find matrix to lock');
		} else if (!matrix?.node() && id) {
			matrix = d3.selectAll('div.matrix')
				.filter(d => d.id === id);
		}
		console.log('lock matrix')
		if (client) {
			let label = `Locked by ${client}`;
			if (label.length > 30) label = `${label.slice(0, 30)}…`

			matrix.classed('focus', false)
				.classed('locked', true)
				.attr('data-locked-by', label);
		} else matrix.classed('focus', true);
		if (bcast) constructorRef.broadcast({ operation: 'lock', data: { id } });
	},
	release: function (_kwargs) {
		const constructorRef = this;
		let { matrix, id, bcast } = _kwargs;
		if (!matrix?.node() && !id) {
			return console.log('cannot find matrix to remove');
		} else if (!matrix?.node() && id) {
			matrix = d3.selectAll('div.matrix')
				.filter(d => d.id === id);
		}
		matrix.classed('focus', false)
			.classed('dragging', false)
			.classed('hit', false)
			.classed('locked', false)
			.attr('data-locked-by', null);

		if (bcast) constructorRef.broadcast({ operation: 'release', data: { id } });
	},
	releaseAll: function (bcast) {
		const constructorRef = this;
		if (!bcast) bcast = false;
		d3.selectAll('div.matrix.focus')
		.each(function (d) {
			const { id } = d;
			const sel = d3.select(this);
			constructorRef.release({ matrix: sel, id, bcast });
		});
	},
	save: async function (data) {
		if (wallId) await POST('/updateMatrix', { data, project: wallId });
		else console.log('error: no project to save to');
	},
	delete: async function (id) {
		if (wallId && id) await DELETE(`/removeMatrix?matrixId=${id}&wallId=${wallId}`);
		else console.log('error: no matrix to delete');
	},
	broadcast: function (_kwargs) {
		const { operation, data } = _kwargs;
		if (operation) {
			broadcast.object({ 
				object: 'matrix',
				operation,
				data,
			});
		} else console.log('error: no broadcast operation provided');
	},
	addLabel: function (sel, _kwargs) {
		const { constructorRef, axis } = _kwargs;
		const matrix = sel.findAncestor('matrix');

		return sel.addElems('input')
		.attrs({
			'type': 'text',
			'placeholder': 'New matrix',
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
				// constructorRef.releaseAll(true);
				Note.releaseAll(true);
				Card.releaseAll(true);
				Group.releaseAll(true);
			}
			constructorRef.lock({ matrix, id, bcast: true });

		}).on('focusout', async function (d) {
			const { id } = d;
			d.label = this.value.trim() || d.label;
			// FETCH PARENT (MATRIX) DATA TO SAVE
			const datum = matrix.datum();
			if (d.cidx > -1) datum[axis][d.cidx] = d.label;
			else datum.label = d.label;
			await constructorRef.save(datum);
			constructorRef.broadcast({ operation: 'update', data: d });
			constructorRef.release({ matrix, id, bcast: true });
		});
	},
	addAxis: function (_kwargs) {
		const constructorRef = this;
		let { matrix, axis } = _kwargs;

		if (!matrix) {
			const { id } = datum;
			matrix = d3.selectAll('div.matrix')
				.filter(d => d.id === id);
		}

		const label = axis === 'col' ? 'header' : 'index';
		matrix.each(d => {
			d[`${axis}s`].push(label);
		});

		constructorRef.update({ matrix, bcast: true });
	},
}