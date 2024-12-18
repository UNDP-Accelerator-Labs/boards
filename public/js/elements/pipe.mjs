import { Note } from './notes.mjs';
import { Group } from './groups.mjs';
import { Card } from './cards.mjs';
import { Matrix } from './matrixes.mjs';
import { POST, DELETE, tree, checkContain, cartesianToPolar, computeAbsCoordinates } from '../helpers/index.mjs';
import { broadcast } from '../websocket/index.mjs';

function pipeStart (d) {
	const evt = d3.event;
	const node = this;
	const sel = d3.select(this);
	const { width: ow, height: oh } = node.getBoundingClientRect();
	const { id } = d;
	const { x: ox, y: oy, k } = d3.select('div.canvas').datum();
	const { clientX: sx, clientY: sy } = evt.sourceEvent;
	const { x, y } = evt;

	// const 
	const [ ex, ey ] = computeAbsCoordinates(sel, d3.select('.canvas'));

	// REMOVE FOCUS FROM ALL OBJECTS
	if (!sel.classed('focus')) {
		Note.releaseAll(true);
		Card.releaseAll(true);
		Group.releaseAll(true);
		Matrix.releaseAll(true);
	}

	d3.select('div.canvas')
	.addElem('div', 'pipeline')
	.datum({
		id,
		w: 1,
		h: 1,
		x: ex + (ow / 2) / k,
		y: ey + (oh / 2) / k,
		dx: 0,
		dy: 0,
	}).styles({
		'top': c => `${c.y}px`,
		'left': c => `${c.x}px`,
	});
	
	// if (sel.classed('note') || sel.classed('card') || sel.classed('group') || sel.classed('matrix')) {
	// 	if (sel.classed('note')) Note.lock({ note: sel, id, bcast: true });
	// 	if (sel.classed('card')) Card.lock({ card: sel, id, bcast: true });
	// 	if (sel.classed('group')) Group.lock({ group: sel, id, bcast: true });
	// 	if (sel.classed('matrix')) Matrix.lock({ group: sel, id, bcast: true });
		
	// 	if (d3.select(evt.sourceEvent.srcElement).classed('sticky-area')) {
	// 		sel.classed('dragging', true)
	// 			.classed('unmoved', false);
	// 		d3.selectAll('.hit').classed('hit', false);

	// 		if (sel.style('position') === 'relative') {
	// 			d.x = 0;
	// 			d.y = 0;
	// 		}
	// 	}
	// 	else sel.classed('dragging', false);
	// }

	// BROADCAST THE PIPE
}
function piping (d) {
	const evt = d3.event;
	const sel = d3.select(this);
	const { width: ow, height: oh } = this.getBoundingClientRect();
	const { id } = d;
	const group = sel.findAncestor('group');

	const { k } = d3.select('div.canvas').datum();

	d3.selectAll('.pipeline')
		.filter(c => c.id === d.id)
	.styles({
		'transform': c => {
			c.dx += (evt.dx / k) ?? 0;
			c.dy += (evt.dy / k) ?? 0;
			c.w = c.dx;
			c.h = c.dy;

			const [ angle, distance ] = cartesianToPolar(c.w, c.h);

			return `rotate(${angle}rad)`;
		},
		'width': c => {
			c.dx += (evt.dx / k) ?? 0;
			c.dy += (evt.dy / k) ?? 0;
			c.w = c.dx;
			c.h = c.dy;

			const [ angle, distance ] = cartesianToPolar(c.w, c.h);

			return `${distance / 2}px`;
		}
	});

	const hits = [];
	d3.selectAll('div.group') // TO DO: CANNOT PIPE TO SELF
	.filter(function () { return this !== group.node() })
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

	// BROADCAST THE PIPE
}
async function pipeEnd (d) {
	const sel = d3.select(this);
	const { id } = d;

	d3.selectAll('.pipeline')
	.filter(c => c.id === d.id)
	.remove();

	const hit = d3.select('div.hit');
	
	if (hit.node()) {
		const { id: from, label, matrix_index } = hit.datum();
		const to = id;
		await POST('/addPipe', { from, to });
		
		// sel.classed('connected', true)
		// .addElems('span', 'flip')
		// .html(`Piped to: ${label || `matrix cell ${matrix_index}` || 'unlabeled group'}`)

		// UPDATE GROUP TO PIPE FROM
		const [ datum ] = d3.selectAll('div.group')
			.filter(d => d.id === from).data();
		let { pipe_to } = datum || {};
		if (Array.isArray(pipe_to)) pipe_to.push(to);
		else pipe_to = [to];
		// UPDATE THE PIPE GROUP
		await Group.update({
			datum: { id: from, pipe_to },
			bcast: true,
		});
	} else {
		console.log('no group to pipe to. Unlinking everything.');
		const to = id;
		// TO DO: FIX THIS
		// GET THE GROUP THE CURRENT SELECTION IS PIPED TO
		const [ datum ] = d3.selectAll('div.group')
			.filter(d => d.pipe_to.includes(to)).data();
		if (datum !== undefined) {
			await DELETE(`/removePipe?to=${to}`);
			// UPDATE THE FRONT END
			let { id: from, pipe_to } = datum || {};
			pipe_to = pipe_to.filter(d => d !== to);
			// UPDATE THE PIPED GROUP
			await Group.update({
				datum: { id: from, pipe_to },
				bcast: true,
			});
			// UPDATE THE PIPED NOTES
			const note_pipes = d3.selectAll('div.note')
				.filter(d => tree.hasNode(d.tree, to));
			if (note_pipes.size()) {
				const notes = [...note_pipes.nodes()];
				for (let n = 0; n < notes.length; n ++) {
					await Note.update({ 
						note: d3.select(notes[n]),
						datum: { pipe_from: null },
						bcast: true,
					});
				}
			}
		}
	}
}

export const pipe = d3.drag()
.on('start', pipeStart)
.on('drag', piping)
.on('end', pipeEnd);