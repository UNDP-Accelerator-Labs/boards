import { endpoint } from './endpoint.mjs';
import { GET, POST, wallId } from '../helpers/index.mjs';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiNDVlMThiYzMtODgwNS00NWUxLThjNTQtYjM1NmJjZWU0OTEyIiwicmlnaHRzIjozLCJpYXQiOjE2OTk3MDQwOTksImF1ZCI6InVzZXI6a25vd24iLCJpc3MiOiJzZGctaW5ub3ZhdGlvbi1jb21tb25zLm9yZyJ9.vKYu1PcT5Z672GUOuxO4ux_E6MTd2PT-GPBgXPgXbl8';
const local = false;

export const loadData = async function (_params) {
	let { platform, ...p } = _params;
	if (platform === 'publications') platform = 'blogapi';

	const { pinboard } = p;
	p.output = 'json';
	p.include_tags = true;
	p.space = 'public';
	if (pinboard) p.space = 'pinned';

	const query = new URLSearchParams();
	for (let k in p) {
		query.append(k, p[k]);
	}

	const { origin, stats, documents } = endpoint(platform, query.toString());
	const promises = [];

	if (stats) promises.push(GET(stats));
	else promises.push(null);
	promises.push(
		GET(documents)
		.then(data => {
			data?.forEach(d => {
				if (platform === 'blogapi') {
					d.doc_id = d.id;
					d.source = d.url;
					delete d.id;
				} else {
					d.source = `${origin}/en/view/pad?id=${d.pad_id}`;
				}
			});
			return data;
		}).catch(err => console.log(err))
	);

	addLoader();
	// FETCH THE DATA
	const data = await Promise.all(promises)
	.catch(err => console.log(err));
	// DETERMINE THE TOTAL STATS
	let total = 0
	if (platform === 'blogapi') total = data[1][0].totalRecords;
	else total = data[0].total;
	// STORE THE API CALL
	const sourceinfo = await POST('/addDatasource', { 
		platform, 
		query: query.toString(), 
		loaded: data[1].length, 
		total, 
		wallId,
	});
	rmLoader();
	return { data, sourceinfo };
}
function addLoader () {}
function rmLoader () {}