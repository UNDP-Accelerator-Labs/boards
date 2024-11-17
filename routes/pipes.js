const DB = require('../config.js');

exports.add = (req, res) => {
	const { from, to } = req.body;
	DB.conn.oneOrNone(`
		INSERT INTO pipes ("from", "to")
		VALUES ($1::INT, $2::INT)
			ON CONFLICT ("to")
			DO UPDATE
				SET "from" = EXCLUDED."from"
		RETURNING *
	;`, [from, to])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.remove = (req, res) => {
	const { to } = req.query;
	DB.conn.tx(t => {
		return t.none(`
			DELETE FROM pipes
			WHERE "to" = $1::INT
		;`, [to]).then(_ => {
			return t.none(`
				UPDATE notes
				SET pipe_from = NULL
				WHERE index(tree, text2ltree($1)) <> -1
			;`, [to]).catch(err => console.log(err));
		}).catch(err => console.log(err));
	}).then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err));
}