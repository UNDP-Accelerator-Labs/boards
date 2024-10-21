const DB = require('../config.js');

exports.get = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`SELECT * FROM cards WHERE project = $1::INT;`, [wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.add = (req, res) => {
	const { content, x, y, source } = req.body.data
	const wallId = req.body.project
	DB.conn.one(`
		INSERT INTO cards (content, x, y, source, project)
		VALUES ($1, $2, $3, $4, $5::INT)
		RETURNING *
	;`, [content, x, y, source, wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err))
}
exports.update = (req, res) => {
	const { content, x, y, tree, id } = req.body.data;
	const wallId = req.body.project;
	DB.conn.none(`
		UPDATE cards 
		SET content = $1::JSONB,
		x = $2,
		y = $3,
		tree = text2ltree($4)
		WHERE id = $5::INT
		AND project = $6::INT
	;`, [content, x, y, tree, id, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err));
}
exports.updateMulti = (req, res) => {
	// TO DO
	const { data } = req.body;
	const wallId = req.body.project;
	const cs = new DB.pgp.helpers.ColumnSet(['?id', 'content', 'color', 'x', 'y', { name: 'tree', cast: 'ltree' }], { table: 'cards' });
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
		DELETE FROM cards
		WHERE id = $1::INT
		AND project = $2::INT
	;`, [noteId, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err));
}