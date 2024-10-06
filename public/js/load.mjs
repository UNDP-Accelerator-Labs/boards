import { zoom } from './canvas/index.mjs';
import { simpleNote } from './notes/index.mjs';
import { GET, POST, wallId } from './helpers/index.mjs';

async function onLoad () {
	const canvas = d3.select('div.canvas')
		.datum({ x: 0, y: 0, k: 1 });
	const w = canvas.node().clientWidth || canvas.node().offsetWidth;
	const h = canvas.node().clientHeight || canvas.node().offsetHeight;
	
	// GET THE DATA
	const notes = await GET(`/getNotes?wallId=${wallId}`);
	notes.forEach((d, i) => new simpleNote(d));

	d3.select('button.add-note')
	.on('click', async _ => {
		const note = new simpleNote();
		const { id } = await POST('/addNote', { data: note.datum(), project: wallId });
		note.each(d => d.id = id).select('textarea').node().focus();
	});

	d3.select('div.container')
	.on('click', async function () {
		const evt = d3.event
		const sel = d3.select(this)
		if (sel.classed('adding-text')) {
			sel.classed('adding-text', false)
			const text = new title('', evt.x, evt.y)
			await POST('/addTitle', { data: text.datum(), project: wallId })
			text.each(d => d.id = response.id).select('input').node().focus()
		}
	}).call(zoom);

	d3.select(document).on('keydown', async _ => {
		const evt = d3.event
		console.log(evt)
		if (evt.key === 'Backspace' || evt.keyCode === 8) {
			const note = d3.select('div.note.focus')
			if (note.node()) {
				await POST('/removeNote', { data: note.datum(), project: wallId })
				note.remove()
			}
		}
		if (evt.key === '+' || evt.keyCode === 187) { //(evt.keyCode === 187 && evt.shiftKey)) {
			d3.event.preventDefault()
			const note = new simpleNote();
			const { id } = await POST('/addNote', { data: note.datum(), project: wallId });
			note.each(d => d.id = id).select('textarea').node().focus();
		}
		if (evt.key === 'ArrowLeft' || evt.keyCode === 37) {
			d3.select('div.note.focus').style('transform', d => `translate(${d.x -= evt.shiftKey ? 30 : 10}px, ${d.y}px)`)
		}
		if (evt.key === 'ArrowRight' || evt.keyCode === 39) {
			d3.select('div.note.focus').style('transform', d => `translate(${d.x += evt.shiftKey ? 30 : 10}px, ${d.y}px)`)
		}
		if (evt.key === 'ArrowDown' || evt.keyCode === 40) {
			d3.select('div.note.focus').style('transform', d => `translate(${d.x}px, ${d.y += evt.shiftKey ? 30 : 10}px)`)
		}
		if (evt.key === 'ArrowUp' || evt.keyCode === 38) {
			d3.select('div.note.focus').style('transform', d => `translate(${d.x}px, ${d.y -= evt.shiftKey ? 30 : 10}px)`)
		}
		if (evt.key === 't' || evt.keyCode === 84) {
			d3.selectAll('div.note').classed('focus', false)
			d3.select('div.container').classed('adding-text', function () { return !d3.select(this).classed('adding-text') })
		}
		if (evt.key === '0' || evt.keyCode === 48) {
			// zoom.translateTo(d3.select('div.cavnas'), 0, 0)
			// zoom.scaleTo(d3.select('div.cavnas'), 1)
			// zoom.translate(d3.select('div.cavnas'), d3.zoomIdentity.translate(0, 0).scale(1))
			// d3.select('div.canvas').datum({ x: 0, y: 0, k: 1 }).style('transform', d => `translate(${d.x}px, ${d.y}px) scale(${d.k})`)
		}
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', onLoad);
} else {
	(async () => { await onLoad() })();
}