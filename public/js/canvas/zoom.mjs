// import { d3 } from '../helpers/index.mjs';

function zooming () {
	if (d3.select(this).classed('adding-text') || d3.select(this).classed('changing-text')) return
	const t = d3.event.transform
	d3.select('div.canvas')
		.datum(t)
		.style('transform', d => `translate(${d.x}px, ${d.y}px) scale(${d.k})`)
	.select('div.origin')
		.style('transform', d => `scale(${1 / d.k})`)
}

export const zoom = d3.zoom()
// .center([w / 2, h / 2])
.scaleExtent([.1, 1])
.on('zoom', zooming)
