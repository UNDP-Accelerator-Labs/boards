const fetch = require('node-fetch');
const DB = require('../config.js');

exports.get = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`SELECT * FROM datasources WHERE project = $1::INT;`, [wallId])
	.then(data => {
		data.forEach(sourceinfo => {
			sourceinfo.query = rmToken(sourceinfo.query);
		});
		res.status(200).json(data);
	}).catch(err => console.log(err));
}
exports.add = (req, res) => {
	const { platform, query, loaded, total, wallId } = req.body;

	DB.conn.one(`
		INSERT INTO datasources (platform, query, loaded, total, project)
		VALUES ($1, $2, $3::INT, $4::INT, $5::INT)
		RETURNING *
	;`, [ platform, query, loaded, total, wallId ])
	.then(sourceinfo => {
		sourceinfo.query = rmToken(sourceinfo.query);
		res.status(200).json(sourceinfo);
	}).catch(err => console.log(err));
}
exports.increase = (req, res) => {
	const { id, wallId } = req.query;

	DB.conn.tx(t => {
		return t.one(`
			SELECT platform, query FROM datasources
			WHERE id = $1::INT
				AND project = $2::INT
		;`, [ id, wallId ])
		.then(async result => {
			const { platform, query: savedQuery } = result;
			const query = new URLSearchParams(savedQuery);

			const currpage = +query.get('page');
			query.set('page', currpage + 1);

			const { origin, stats, pads } = endpoint(platform, query.toString());
			const promises = [];
			promises.push(fetch(stats).then(response => response.json()).catch(err => console.log(err)));
			promises.push(
				fetch(pads)
				.then(response => response.json())
				.then(data => {
					// const [ data ] = json;
					data.forEach(d => d.source = `${origin}/en/view/pad?id=${d.pad_id}`);
					return data;
				}).catch(err => console.log(err))
			);

			const data = await Promise.all(promises)
			.catch(err => console.log(err));

			return t.one(`
				UPDATE datasources
				SET query = $1,
					loaded = loaded + $2::INT,
					total = $3::INT
				WHERE id = $4::INT
					AND project = $5::INT
				RETURNING *
			;`, [ query.toString(), data[1].length, data[0].total, id, wallId ])
			.then(sourceinfo => {
				sourceinfo.query = rmToken(sourceinfo.query);
				res.status(200).json({ data, sourceinfo });
			}).catch(err => console.log(err));
		}).catch(err => console.log(err));
	}).catch(err => console.log(err));
}

function rmToken (_query) {
	const query = new URLSearchParams(_query);
	query.delete('token');
	return query.toString();
}

function endpoint (platform, query) {
	const origin = new URL(`https://${platform}.sdg-innovation-commons.org`);
	const stats = new URL('apis/fetch/statistics', origin);
	const pads = new URL('apis/fetch/pads', origin);

	return { 
		origin,
		stats: `${stats.origin}${stats.pathname}?${query}`,
		pads: `${pads.origin}${pads.pathname}?${query}`,
	}
}