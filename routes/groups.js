const DB = require('../config.js');

exports.get = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`SELECT * FROM groups WHERE project = $1::INT;`, [wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.add = (req, res) => {
	const { label, x, y, project, tree } = req.body.data;
	const wallId = req.body.project;
	DB.conn.one(`
		INSERT INTO groups (label, x, y, project, tree)
		VALUES ($1, $2, $3, $4::INT, text2ltree($5))
		RETURNING *
	;`, [label, x, y, wallId, tree])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.update = (req, res) => {
	const { label, x, y, tree, id } = req.body.data;
	const wallId = req.body.project;
	DB.conn.none(`
		UPDATE groups 
		SET label = $1,
		x = $2,
		y = $3,
		tree = text2ltree($4)
		WHERE id = $5::INT
		AND project = $6::INT 
	;`, [label, x, y, tree, id, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err));
}
exports.updateMulti = (req, res) => {
	// TO DO
}
exports.remove = (req, res) => {
	const { groupId, wallId } = req.query;
	DB.conn.none(`
		DELETE FROM groups
		WHERE id = $1::INT
		AND project = $2::INT
	;`, [groupId, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err))
}