import { group, resetGroups } from './render.mjs';
import { POST, wallId, lock, tree, checkContain } from '../helpers/index.mjs';

function dragStart (d) {
	const evt = d3.event;
	const sel = d3.select(this);
	d3.selectAll('div.note.focus').classed('focus', false);
	if (sel.classed('note')) {
		sel.classed('focus', true).classed('unmoved', false).moveToFront();
		if (d3.select(evt.sourceEvent.srcElement).classed('sticky-area')) sel.classed('dragging', true);
		else sel.classed('dragging', false);
	}
	else if (sel.classed('title')) {
		if (d3.select(evt.sourceEvent.srcElement).classed('sticky-area')) sel.classed('dragging', true);
		else sel.classed('dragging', false);
	}
	console.log(d.tree)
}
function dragging (d) {
	const evt = d3.event;
	const sel = d3.select(this);
	// NEED TO ESTABLISH BOUNDS OF ALL OTHER NOTES
	if (d3.select(this).classed('dragging')) {
		const offset = d3.select('div.canvas').datum()
		d.x += evt.dx / offset.k
		d.y += evt.dy / offset.k
		d3.select(this).style('transform', `translate(${d.x}px, ${d.y}px)`)
	}
	const hits = [];
	d3.selectAll('div.group, div.note:not(.dragging)')
	.sort((a, b) => tree.getDepth(a.tree) - tree.getDepth(b.tree))
	.classed('hit', false)
	.each(function (c) {
		const sel = d3.select(this);
		const { clientX: x, clientY: y } = evt.sourceEvent;
		const hit = checkContain([x, y], this);
		if (hit) hits.push({ node: this });
	});
	// MAKE SURE THERE IS ONLY ONE TARGET/HIT
	const hit = hits[hits.length - 1]?.node;
	if (hit) d3.select(hit).classed('hit', true);
}


let i = 1; // THIS IS TEMP FOR THE GROUP IDs
async function dragEnd (d) {
	const sel = d3.select(this);
	sel.classed('dragging', false);
	if (sel.classed('note')) {
		await POST('/updateNote', { data: d, project: wallId });
	} else if (sel.classed('title')) {
		await POST('/updateTitle', { data: d, project: wallId });
	}
	const hit = d3.select('div.hit');
	if (hit.node()) {
		// 1- CHECK IF THE HIT IS AN EXISTING GROUP
		// OTHERWISE CREATE THE GROUP
		let groupping;
		if (hit.classed('group')) {
			// IF THE HIT IS AN EXISTING GROUP, JUST APPPEND THE NOTE
			groupping = hit;
			groupping.classed('hit', false);
		} else if (hit.classed('note')) {
			// IF THE HIT IS A NOTE, CREATE A GROUP
			groupping = new group({
				parent: d3.select(hit.node().parentNode),
				label: 'New group', 
				id: i, // THIS IS TEMP
				tree: hit.datum().tree,
			});
			hit.classed('hit', false)
				.classed('child', true)
			.each(c => {
				c.tree = `${groupping.datum().tree}.${groupping.datum().id}`; // TO DO: MAKE SURE THIS WORKS PROPERLY
			});
			i++; // THIS IS TEMP
		}
		// APPPEND THE NOTE TO THE GROUP
		sel.classed('child', true)
		.each(c => {
			c.tree = `${groupping.datum().tree}.${groupping.datum().id}`;
		});
		
		// 3- SAVE EVERYTHING
	} else d.tree = tree.getRoot(d.tree);
	resetGroups();
}

export const drag = d3.drag()
.on('start', dragStart)
.on('drag', dragging)
.on('end', dragEnd);