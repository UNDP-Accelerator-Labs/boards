const DB = require('../config.js');

exports.add = (req, res) => {
	const { from, to } = req.body.data;
	DB.conn.none(`
		INSERT INTO pipes ("from", "to")
		VALUES ($1::INT, $2::INT)
		RETURNING *
	;`, [from, to])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}