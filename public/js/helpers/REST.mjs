export const GET = async function (_uri, _q) {
	const jsonQueryHeader = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
	return await fetch(_uri, { method: 'GET', headers: jsonQueryHeader })
		.then(response => response.json())
		.catch(err => { if (err) throw (err) });
}
export const POST = async function (_uri, _q) {
	const jsonQueryHeader = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
	return await fetch(_uri, { method: 'POST', headers: jsonQueryHeader, body: JSON.stringify(_q) })
		.then(response => response.json())
		.catch(err => { if (err) throw (err) });
}