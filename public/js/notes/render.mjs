import { POST, wallId, tree } from '../helpers/index.mjs';
import { drag } from './drag.mjs';

const nColors = 8;
const colors = d3.scaleOrdinal(d3.schemePastel1)
	.domain(d3.range(nColors));

export const simpleNote = function (_kwargs) {
	const { content, color, x, y, id, tree } = _kwargs;
	// GET ALL UNMOVED NOTES, TO CHECK FOR VISUAL OVERLAP/CLUTTER AND OFFSET IF NEEDED
	const otherNotesAtOrigin = d3.selectAll('div.note.unmoved');
	// REMOVE FOCUS FROM ALL NOTES
	d3.selectAll('div.note.focus').classed('focus', false);
	// ADD A NOTE
	const note = d3.select('div.canvas')
		.addElem('div', 'note simple focus')
		.datum({ 
			content: content || '', 
			color: color || colors(0), 
			x: x ?? 10 * otherNotesAtOrigin.size(), 
			y: y ?? 10 * otherNotesAtOrigin.size(),
			id,
			tree: tree || '0',
		}).classed('unmoved', d => d.x === 0 && d.y === 0)
		.styles({ 
			'transform': d => `translate(${d.x}px, ${d.y}px)`, 
			'background-color': d => d.color,
		});
	// ADD A SIDEBAR TO SELECT THE COLOR OF THE NOTE
	note.addElems('div', 'color-swatches')
		.addElems('div', 'color', d3.range(nColors).map(d => colors(d)))
	.on('mousedown', async function (d) {
		d3.event.stopPropagation();
		d3.select(this.parentNode.parentNode).style('background-color', c => c.color = d);
		if (wallId) await POST('/updateNote', { data: this.parentNode.parentNode['__data__'], project: wallId });
	}).on('mousemove', _ => {
		d3.event.stopPropagation();
	}).on('mouseup', _ => {
		d3.event.stopPropagation();
	}).style('background-color', d => d);
	// ADD A STICKY AREA TO MOVE THE NOTE AROUND
	note.addElems('div', 'sticky-area');
	// ADD THE TEXT AREA IN THE NOTE
	note.addElems('textarea')
		.each(function (d) { this.value = d.content })
		.on('mousedown', _ => {
			d3.event.stopPropagation();
		}).on('mousemove', _ => {
			d3.event.stopPropagation();
		}).on('mouseup', _ => {
			d3.event.stopPropagation();
		})
		.on('keydown', _ => d3.event.stopPropagation())
		.on('focusout', async function (d) {
			d.content = this.value.trim() || d.content;
			if (wallId) await POST('/updateNote', { data: d, project: wallId });
		});
	
	note.call(drag);
	return note;
}

export const group = function (_kwargs) {
	const { parent, label, x, y, w, h, id, tree } = _kwargs;
	// REMOVE FOCUS FROM ALL NOTES
	d3.selectAll('div.note.focus').classed('focus', false);
	// CHECK IF THIS IS TO BE A CHILD GROUP
	const childgroup = tree?.split('.')?.length > 0;
	// ADD A GROUP
	const group = parent.addElem('div', 'group focus')
		.classed('child', childgroup)
		.datum({
			label: label || '',
			x: x ?? 0,
			y: y ?? 0,
			w: w ?? 0,
			h: h ?? 0,
			id,
			tree: tree || '0',
		}).styles({
			'width': d => `${d.w}px`,
			'height': d => `${d.h}px`,
			'transform': d => `translate(${d.x}px, ${d.y}px)`,
		});
	// ADD A STICKY AREA TO MOVE THE NOTE AROUND
	group.addElems('div', 'sticky-area');
	// ADD THE LABEL
	group.addElems('input')
	.attrs({
		'type': 'text',
		'value': d => d.label,
	});

	// group.call(drag);
	return group;
}

export const resetGroups = function () {
	// FIT THE GROUP TO ITS CONTENT
	d3.selectAll('div.group')
	.sort((a, b) => tree.getDepth(b.tree) - tree.getDepth(a.tree)) // START WITH THE DEEPEST GROUPS
	.each(function (g) {
		const sel = d3.select(this);
		const children = tree.getChildren(d3.selectAll('div.group, div.note'), g.id);
		if (children.size() <= 1) {
			sel.remove();
			children.each(d => {
				d.tree = tree.moveUp(d.tree);
			})
		} else {
			const rects = [...children.nodes()].map(el => {
				const { width: w, height: h } = el.getBoundingClientRect();
				const { x, y } = d3.select(el).datum(); // NEED TO USE THE x, y FROM THE DATA AS IT NEEDS TO BE RELATIVE TO THE .cavnas, NOT THE WINDOW
				return { x, y, w, h };
			});
			g.x = Math.min(...rects.map(c => c.x));
			g.y = Math.min(...rects.map(c => c.y));
			g.w = Math.max(...rects.map(c => c.x + c.w)) - g.x;
			g.h = Math.max(...rects.map(c => c.y + c.h)) - g.y;

			sel.styles({
				'width': g => `${g.w}px`,
				'height': g => `${g.h}px`,
				'transform': g => `translate(${g.x}px, ${g.y}px)`,
			});
		}
	})
	// d3.selectAll('div.note, div.group')
	d3.selectAll('div.group')
	.sort((a, b) => tree.getDepth(a.tree) - tree.getDepth(b.tree))
	.moveToFront();
}