import { Note, Group, Card, Matrix } from '../elements/index.mjs';
import { computeDistance } from '../helpers/index.mjs';

function zoomstart () {
	// Note.releaseAll(true);
	// Card.releaseAll(true);
	// Group.releaseAll(true);
	// Matrix.releaseAll(true);
	const { x, y } = d3.event.transform;
	this['__delatzoom'] = { x, y };
}
function zooming (z) {
	if (d3.select(this).classed('adding-text') || d3.select(this).classed('changing-text')) return false;
	const t = d3.event.transform;
	d3.select('div.canvas')
		.datum(t)
		.styles({
			'transform': d => `translate(${d.x}px, ${d.y}px) scale(${d.k})`,
			'transform-origin': '0 0',
		})
	.select('div.origin')
		.style('transform', d => `scale(${1 / d.k})`);

	d3.selectAll('div.matrix div.add-col')
		.style('width', `${Math.max(75, 30 * 1 / t.k / 2)}px`)
	.select('button')
		.style('font-size', `${Math.max(75, 30 * 1 / t.k / 2)}px`);
	d3.selectAll('div.matrix div.add-row')
		.style('height', `${Math.max(75, 30 * 1 / t.k / 2)}px`)
	.select('button')
		.style('font-size', `${Math.max(75, 30 * 1 / t.k / 2)}px`);

	// d3.selectAll('div.sticky-area:not(.immutable)')
	// 	.style('height', `${Math.min(75, 30 * 1 / t.k / 2)}px`);

	d3.selectAll('button.pipe')
		.styles({
			'width': `${Math.min(75, 30 * 1 / t.k / 2)}px`,
			'height': `${Math.min(75, 30 * 1 / t.k / 2)}px`,
		});
	
	d3.selectAll('div.note, div.card, div.group, div.matrix')
		.style('border-width', `${1 / t.k}px`);
}
function zoomend (z) {
	const { x: ox, y: oy } = this['__delatzoom'];
	const { x, y } = d3.event.transform;

	if (computeDistance([ox, y], [x, y]) <= 10) {
		Note.releaseAll(true);
		Card.releaseAll(true);
		Group.releaseAll(true);
		Matrix.releaseAll(true);
		return console.log('has not moved');
	}
}

export const zoom = d3.zoom()
// .center([w / 2, h / 2])
.scaleExtent([.1, 1])
.on('start', zoomstart)
.on('zoom', zooming)
.on('end', zoomend)
