import { Note, Group, Card } from '../elements/index.mjs';

function zoomstart () {
	Note.releaseAll(true);
	Group.releaseAll(true);
	Card.releaseAll(true);
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
}

export const zoom = d3.zoom()
// .center([w / 2, h / 2])
.scaleExtent([.1, 1])
.on('start', zoomstart)
.on('zoom', zooming)
