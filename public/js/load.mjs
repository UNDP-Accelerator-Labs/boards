import { zoom } from './canvas/index.mjs';
import { Note, Group, Card, Matrix } from './elements/index.mjs';
import { GET, POST, DELETE, wallId, uuid, tree, computeCoordinates } from './helpers/index.mjs';
import { connectToSocket, broadcast } from './websocket/index.mjs';
import { loadData, addDatasource } from './data/index.mjs';

async function onLoad () {
	const canvas = d3.select('div.canvas')
		.datum({ x: 0, y: 0, k: 1 });
	const w = canvas.node().clientWidth || canvas.node().offsetWidth;
	const h = canvas.node().clientHeight || canvas.node().offsetHeight;
	
	// GET THE DATA
	const matrixes = await GET(`/getMatrixes?wallId=${wallId}`);
	matrixes.sort((a, b) => tree.getDepth(a.tree) - tree.getDepth(b.tree));
	for (let i = 0; i < matrixes.length; i ++) {
		const datum = matrixes[i];
		await Matrix.add({ datum });
	}
	const groups = await GET(`/getGroups?wallId=${wallId}`);
	groups.sort((a, b) => (tree.getDepth(a.tree) - tree.getDepth(b.tree)) || (a.matrix_index - b.matrix_index));
	for (let i = 0; i < groups.length; i ++) {
		const datum = groups[i];
		await Group.add({ datum });
	}
	const notes = await GET(`/getNotes?wallId=${wallId}`);
	for (let i = 0; i < notes.length; i ++) {
		const datum = notes[i];
		await Note.add({ datum });
	}
	const cards = await GET(`/getCards?wallId=${wallId}`);
	for (let i = 0; i < cards.length; i ++) {
		const datum = cards[i];
		await Card.add({ datum });
	}
	const datasources = await GET(`/getDatasources?wallId=${wallId}`);
	addDatasource(datasources);

	const sidebar = d3.select('div.sidebar');
	sidebar.select('div.toggle')
	.on('click', function () {
		this.parentNode.classList.toggle('open');
	});
	sidebar.select('button#loadData')
	.on('click', async function () {
		const fd = new FormData(this.form);
		const params = {}
		for (const pair of fd.entries()) {
			if (pair[1].toString()?.length) params[pair[0]] = pair[1];
		}
		const { data, sourceinfo } = await loadData(params);
		const [ stats, cards ] = data;

		for (let i = 0; i < cards.length; i ++) {
			const { title, vignette: img, snippet: txt, source } = cards[i];
			const content = { title, img, txt, source };
			await Card.add({ datum: { content }, i, bcast: true });
		}

		addDatasource(sourceinfo);
	})

	d3.select('button#addNote')
	.on('click', async _ => {
		await Note.add({ focus: true, bcast: true });
	});
	d3.select('button#addMatrix')
	.on('click', async _ => {
		await Matrix.add({ focus: true, bcast: true });
	});

	// d3.select('button.get-cards')
	// .on('click', async _ => {
	// 	const [ cards ] = await loadData();
	// 	for (let i = 0; i < cards.length; i ++) {
	// 		const { title, vignette: img, snippet: txt, source } = cards[i];
	// 		const content = { title, img, txt, source };
	// 		await Card.add({ datum: { content }, i });
	// 	}
	// });

	// HANDLE LOGIN-THIS IS TEMP
	// d3.select('button.login')
	// .on('click', async _ => {
	// 	const { result, uuid } = await POST('/login');
	// 	if (result !== 'OK') alert('login failed');
	// })
	d3.select('button.logout')
	.on('click', async _ => {
		const checkstatus = await DELETE(`/logout?project=${wallId}`);
		console.log(checkstatus);
	})
	d3.select('button.connect-to-scocket')
	.on('click', async _ => {
		const { result, uuid } = await POST('/login');
		if (result !== 'OK') alert('login failed');
		else {
			connectToSocket();
			console.log('connected to socket');
			d3.select('.connection.overlay').remove();
		}
	})


	d3.select('div.container')
	.on('click', async function () {
		// const evt = d3.event
		// const sel = d3.select(this)
		// if (sel.classed('adding-text')) {
		// 	sel.classed('adding-text', false)
		// 	const text = new title('', evt.x, evt.y)
		// 	await POST('/addTitle', { data: text.datum(), project: wallId })
		// 	text.each(d => d.id = response.id).select('input').node().focus()
		// }
	}).on('dblclick', async _ => {
		const { x: ex, y: ey } = d3.event;
		const ref = d3.select('.canvas');
		const { x: ox, y: oy } = ref.node().getBoundingClientRect();
		const { k } = ref.datum();
		const [ x, y ] = computeCoordinates(k, ex, ey, ox, oy);
		await Note.add({ focus: true, bcast: true, datum: { x, y } });
	}).call(zoom);

	d3.select(document).on('keydown', async _ => {
		const evt = d3.event;
		// console.log(evt)
		if (evt.key === 'Backspace' || evt.keyCode === 8) {
			const note = d3.select('div.note.focus');
			if (note.node()) {
				const { id } = note.datum();
				await Note.remove({ note, id, bcast: true });
			}
		}
		if (evt.key === '+' || evt.keyCode === 187) { //(evt.keyCode === 187 && evt.shiftKey)) {
			d3.event.preventDefault()
			const note = new Note();
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
		// if (evt.key === 't' || evt.keyCode === 84) {
		 	// d3.select('div.container').classed('adding-text', function () { return !d3.select(this).classed('adding-text') })
		// }
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