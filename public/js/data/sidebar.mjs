import { GET, wallId } from '../helpers/index.mjs';
import { Card } from '../elements/index.mjs';

export const addDatasource = function (sourceinfo) {
	if (!Array.isArray(sourceinfo)) sourceinfo = [sourceinfo];
	const container = d3.select('div.sidebar div.inner div.content')
	.addElems('div', 'datasource loaded', sourceinfo, d => d.id);

	container.addElems('h2')
	.html(d => `Loaded collection <small>${d.loaded < d.total ? `(${d.loaded}/ ${d.total})` : '(completed)'}</small>`);
	container.addElems('div', 'row', d => {
		return [
			[ 'platform', d.platform ],
			[ 'query', d.query?.replace(/\&/g, '<br/>') ],
			[ 'loaded', `${d.loaded}/ ${d.total}` ]
		]
	}).addElems('span', null, d => d)
	.html(d => d);

	container.addElems('button', 'btn', d => +d.loaded < +d.total ? [d] : [])
	.on('click', async d => {
		const { id } = d;
		const { data, sourceinfo } = await GET(`/increaseDatasource?id=${id}&wallId=${wallId}`);
		const [ stats, cards ] = data;

		const offsetcards = d3.selectAll('div.card').size();
			
		for (let i = 0; i < cards.length; i ++) {
			const { title, vignette: img, snippet: txt, source } = cards[i];
			const content = { title, img, txt, source };
			await Card.add({ datum: { content }, i: i + offsetcards, bcast: true });
		}
		addDatasource(sourceinfo);
	}).html('Load more');
}