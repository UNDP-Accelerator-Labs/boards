import { Note } from './notes.mjs';
import { Group } from './groups.mjs';
import { Card } from './cards.mjs';
import { Matrix } from './matrixes.mjs';
import { POST, DELETE, checkContain, cartesianToPolar } from '../helpers/index.mjs';
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

	// REMOVE FOCUS FROM ALL OBJECTS
	if (!sel.classed('focus')) {
		/*
		Note.releaseAll(true);
		Card.releaseAll(true);
		Group.releaseAll(true);
		Matrix.releaseAll(true);
		*/
	}

	d3.select('div.canvas')
	.addElem('div', 'pipeline')
	.datum({
		id,
		w: 1,
		h: 1,
		x: d.x - ow / 2,
		y: d.y + oh / 2,
		dx: 0, //(sx - ox) / k - x + ow / 2,
		dy: 0, //Math.abs(y - (sy - oy) / k) - oh / 2,
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
		const { pipe_to } = datum || {};
		if (Array.isArray(pipe_to)) pipe_to.push(to);
		else pipe_to = [to];
		// UPDATE THE PIPE GROUP
		await Group.update({
			datum: { id: from, pipe_to },
			bcast: true,
		})
	} else {
		console.log('no group to pipe to');
		const to = id;
		await DELETE(`/removePipe?to=${to}`);
	}
}

export const pipe = d3.drag()
.on('start', pipeStart)
.on('drag', piping)
.on('end', pipeEnd);