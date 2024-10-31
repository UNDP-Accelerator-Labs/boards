import { endpoint } from './endpoint.mjs';
import { GET, POST, wallId } from '../helpers/index.mjs';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiNDVlMThiYzMtODgwNS00NWUxLThjNTQtYjM1NmJjZWU0OTEyIiwicmlnaHRzIjozLCJpYXQiOjE2OTk3MDQwOTksImF1ZCI6InVzZXI6a25vd24iLCJpc3MiOiJzZGctaW5ub3ZhdGlvbi1jb21tb25zLm9yZyJ9.vKYu1PcT5Z672GUOuxO4ux_E6MTd2PT-GPBgXPgXbl8';
const local = false;

export const loadData = async function (_params) {
	const { platform, ...p } = _params;
	const { pinboard } = p;
	p.output = 'json';
	p.include_tags = true;
	p.space = 'public';
	if (pinboard) p.space = 'pinned';

	const query = new URLSearchParams();
	for (let k in p) {
		query.append(k, p[k]);
	}

	const { origin, stats, pads } = endpoint(platform, query.toString());
	const promises = [];

	promises.push(GET(stats));
	promises.push(
		GET(pads)
		.then(data => {
			// const [ data ] = res;
			data?.forEach(d => d.source = `${origin}/en/view/pad?id=${d.pad_id}`);
			return data;
		})
	);

	addLoader();
	// FETCH THE DATA
	const data = await Promise.all(promises)
	.catch(err => console.log(err));
	// STORE THE API CALL
	const sourceinfo = await POST('/addDatasource', { 
		platform, 
		query: query.toString(), 
		loaded: data[1].length, 
		total: data[0].total, 
		wallId,
	});
	rmLoader();
	return { data, sourceinfo };
}
function addLoader () {}
function rmLoader () {}