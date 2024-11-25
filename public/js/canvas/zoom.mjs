import { Note, Group, Card, Matrix } from '../elements/index.mjs';

function zoomstart () {
	Note.releaseAll(true);
	Card.releaseAll(true);
	Group.releaseAll(true);
	Matrix.releaseAll(true);
}
function zooming () {
	if (d3.select(this).classed('adding-text') || d3.select(this).classed('changing-text')) return
	const t = d3.event.transform;
	d3.select('div.canvas')
		.datum(t)
		.styles({
			'transform': d => `translate(${d.x}px, ${d.y}px) scale(${d.k})`,
			'transform-origin': '0 0',
		})
	.select('div.origin')
		.style('transform', d => `scale(${1 / d.k})`);

	d3.selectAll('div.sticky-area:not(.immutable)')
		.style('height', `${Math.min(75, 30 * 1 / t.k / 2)}px`);
	d3.selectAll('button.pipe')
		.styles({
			'width': `${Math.min(75, 30 * 1 / t.k / 2)}px`,
			'height': `${Math.min(75, 30 * 1 / t.k / 2)}px`,
		});
	d3.selectAll('div.note, div.card, div.group, div.matrix')
		.style('border-width', `${1 / t.k / 2}px`);
}

export const zoom = d3.zoom()
// .center([w / 2, h / 2])
.scaleExtent([.1, 1])
.on('start', zoomstart)
.on('zoom', zooming)
