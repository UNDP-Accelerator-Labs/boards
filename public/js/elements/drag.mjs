import { Note } from './notes.mjs';
import { Group } from './groups.mjs';
import { Card } from './cards.mjs';
import { Matrix } from './matrixes.mjs';
import { POST, wallId, uuid, tree, checkContain, computeAbsCoordinates, computeDistance } from '../helpers/index.mjs';
import { broadcast } from '../websocket/index.mjs';

function dragStart (d) {
	const evt = d3.event;
	const sel = d3.select(this);
	const { id } = d;
	d.dx = 0;
	d.dy = 0;

	// REMOVE FOCUS FROM ALL OBJECTS
	if (!sel.classed('focus')) {
		Note.releaseAll(true);
		Card.releaseAll(true);
		Group.releaseAll(true);
		Matrix.releaseAll(true);
	}
	
	if (sel.classed('note') || sel.classed('card') || sel.classed('group') || sel.classed('matrix')) {
		if (sel.classed('note')) Note.lock({ note: sel, id, bcast: true });
		if (sel.classed('card')) Card.lock({ card: sel, id, bcast: true });
		if (sel.classed('group')) Group.lock({ group: sel, id, bcast: true });
		if (sel.classed('matrix')) Matrix.lock({ group: sel, id, bcast: true });
		
		if (d3.select(evt.sourceEvent.srcElement).classed('sticky-area')) {
			sel.classed('dragging', true)
				.classed('unmoved', false);
			d3.selectAll('.hit').classed('hit', false);

			if (sel.style('position') === 'relative') {
				d.x = 0;
				d.y = 0;
			}
			// DEACTIVATE ALL textareas AND inputs
			d3.select('div.canvas').selectAll('textarea, input')
			.classed('deactivate', true);
		} else {
			sel.classed('dragging', false);
			// REACTIVATE ALL textareas AND inputs
			d3.select('div.canvas').selectAll('textarea, input')
			.classed('deactivate', false);
		}
	}

	let object;
	if (sel.classed('note')) object = 'note';
	else if (sel.classed('card')) object = 'card';
	else if (sel.classed('group')) object = 'group';
	else if (sel.classed('matrix')) object = 'matrix';
	broadcast.object({ 
		object,
		operation: 'update',
		data: d,
	});
}
function dragging (d) {
	const evt = d3.event;
	const node = this;
	const sel = d3.select(this);

	if (!sel.classed('dragging')) return false;

	const { k } = d3.select('div.canvas').datum();
	// NEED TO ESTABLISH BOUNDS OF ALL OTHER NOTES
	if (sel.classed('dragging')) {
		d.dx += evt.dx;
		d.dy += evt.dy;
		d.x += evt.dx / k;
		d.y += evt.dy / k;
		sel.style('transform', `translate(${d.x}px, ${d.y}px)`);
	}
	
	if (!sel.classed('matrix')) {
		const hits = [];
		d3.selectAll('div.group:not(.dragging), div.note:not(.dragging), div.card:not(.dragging)')
		.filter(function () { return this !== node })
		.classed('hit', false)
		.each(function (c) {
			const sel = d3.select(this);
			const { clientX: x, clientY: y } = evt.sourceEvent;
			const hit = checkContain([x, y], this);
			if (hit) hits.push({ node: this });
		});
		// MAKE SURE THERE IS ONLY ONE TARGET/HIT
		const hit = hits[hits.length - 1]?.node;
		if (hit) {
			d3.select(hit)
				.classed('hit', true)
				.style('border-width', `${1 / k}px`);
		}
	}
	
	// BROADCAST THE DRAG
	let object;
	if (sel.classed('note')) object = 'note';
	else if (sel.classed('card')) object = 'card';
	else if (sel.classed('group')) object = 'group';
	else if (sel.classed('matrix')) object = 'matrix';
	broadcast.object({ 
		object,
		operation: 'update',
		data: d,
	});
}
async function dragEnd (d) {
	if (computeDistance([0, 0], [d.dx, d.dy]) <= 10) {
		// Note.releaseAll(true);
		Card.releaseAll(true);
		Group.releaseAll(true);
		// Matrix.releaseAll(true);
		return console.log('has not moved');
	}

	const sel = d3.select(this)
		.classed('dragging', false);
	// REACTIVATE ALL textareas AND inputs
	d3.select('div.canvas').selectAll('textarea, input')
	.classed('deactivate', false);

	const parent = d3.select(this.parentNode);
	const otree = d.tree;

	const hit = d3.select('div.hit');
	let pipes = [];

	if (hit.node()) {
		// 1- CHECK IF THE HIT IS AN EXISTING GROUP
		// OTHERWISE CREATE THE GROUP
		let groupping;

		if (hit.classed('group')) {
			// IF THE HIT IS AN EXISTING GROUP, JUST APPPEND THE NOTE
			groupping = hit;
			d.x = null;
			d.y = null;
			const { id: gid, tree: gtree, pipe_to } = hit.datum();
			d.tree = tree.build(gtree, gid);
			if (Array.isArray(pipe_to) && pipe_to?.length) pipes = [ ...pipes, ...pipe_to ];
			
		} else if (hit.classed('note') || hit.classed('card')) {
			// IF THE HIT IS A NOTE OR CARD, CREATE A GROUP
			const { x, y, tree: ntree, piped_from } = hit.datum();

			groupping = await Group.add({ 
				parent: d3.select(hit.node().parentNode),
				datum: { x, y, tree: ntree },
				children: [hit, sel],
				focus: true, 
				bcast: true,
			});
			d.x = null;
			d.y = null;
			const { id: gid, tree: gtree } = groupping.datum();
			d.tree = tree.build(gtree, gid);

			// IF THE hit note IS INSIDE A PIPED GROUP, PIPE THE dragged NOTE
			if (tree.getDepth(d.tree) > 1) {
				// CHECK ALL THE PARENT GROUPS FOR PIPING
				const nodes = tree.getNodes(d.tree);
				let i = nodes.length - 1;
				
				while (i >= 0) {
					const group = d3.selectAll('div.group')
					.filter(d => d.id === +nodes[i]);
					
					if (group.node()) {
						const { pipe_to } = group.datum();
						if (Array.isArray(pipe_to) && pipe_to?.length) pipes = [ ...pipes, ...pipe_to ];
					}
					i--;
				}
				
			}
		}
		hit.classed('hit', false);
	} else { // THE OBJECT IS MOVED OUT OF ALL GROUPS
		const [ x, y ] = computeAbsCoordinates(sel, d3.select('.canvas'));
		d.x = x;
		d.y = y;
		d.tree = tree.getRoot(d.tree);
	}

	if (sel.classed('note')) {
		await Note.update({ 
			note: sel, 
			datum: { ...d, ...{ pipe_from: null } },
			bcast: true,
			group_pipes: pipes,
		});
	} else if (sel.classed('card')) {
		await Card.update({ 
			card: sel, 
			datum: d,
			bcast: true,
		});
	} else if (sel.classed('group')) {
		await Group.update({ 
			group: sel, 
			datum: d,
			bcast: true,
		});
		Group.release({ group: sel, id: d.id, bcast: true });
	} else if (sel.classed('matrix')) {
		await Matrix.update({ 
			matrix: sel, 
			datum: d,
			bcast: true,
		});
	}
	
	if (parent.classed('group')) {
		// IF THE MOVED ELEMENT WAS PART OF A GROUP, MAKE SURE TO UPDATE THAT GROUP AS WELL
		await Group.update({ 
			group: parent,
			bcast: true,
		});
	}

	// RELEASE EVERYTHING
	// Note.releaseAll(true);
	// Card.releaseAll(true);
	// Group.releaseAll(true);
	// Matrix.releaseAll(true);
}

export const drag = d3.drag()
.on('start', dragStart)
.on('drag', dragging)
.on('end', dragEnd);