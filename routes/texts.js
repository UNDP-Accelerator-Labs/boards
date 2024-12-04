const DB = require('../config.js');

exports.get = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`SELECT * FROM texts WHERE project = $1::INT;`, [wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.add = (req, res) => {
	const { content, variables, x, y, tree, pipe_from } = req.body.data;
	const wallId = req.body.project;
	DB.conn.one(`
		INSERT INTO texts (content, variables, x, y, project, tree, pipe_from)
		VALUES ($1, $2::JSONB, $3, $4, $5::INT, text2ltree($6), $7)
		RETURNING *
	;`, [content, JSON.stringify(variables), x, y, wallId, tree || '0', pipe_from])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.update = (req, res) => {
	const { content, variables, x, y, tree, pipe_from, id } = req.body.data;
	const wallId = req.body.project;
	DB.conn.none(`
		UPDATE texts 
		SET content = $1,
		variables = $2::JSONB,
		x = $3,
		y = $4,
		tree = text2ltree($5),
		pipe_from = $6
		WHERE id = $7::INT
		AND project = $8::INT
	;`, [content, variables, x, y, tree, pipe_from, id, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err));
}
exports.updateMulti = (req, res) => {
	const { data } = req.body;
	const wallId = req.body.project;
	const cs = new DB.pgp.helpers.ColumnSet(['?id', 'content', { name: 'variables', cast: 'jsonb' }, 'x', 'y', { name: 'tree', cast: 'ltree' }], { table: 'texts' });
	const sql1 = DB.pgp.helpers.update(data, cs);
	const sql2 = DB.pgp.as.format(`v.id = t.id`);
	const sql3 = DB.pgp.as.format(`project = $1::INT`, [ wallId ]);
	const sql = DB.pgp.as.format(`$1:raw WHERE $2:raw AND $3:raw;`, [sql1, sql2, sql3]);
	DB.conn.none(sql)
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err));
}
exports.remove = (req, res) => {
	const { noteId, wallId } = req.query;
	DB.conn.none(`
		DELETE FROM texts
		WHERE id = $1::INT
		AND project = $2::INT
	;`, [noteId, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err));
}