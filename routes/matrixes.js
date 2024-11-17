const DB = require('../config.js');

exports.get = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`
		WITH g AS (
			SELECT g.*, 
				COALESCE(json_agg(p.to) FILTER (WHERE p.to IS NOT NULL), '[]') AS pipe_to
			FROM groups g
			LEFT JOIN pipes p
				ON p.from = g.id
			WHERE g.project = $1::INT
			GROUP BY g.id
		)

		SELECT m.*, json_agg(g.*) AS cells
		FROM matrixes m
		INNER JOIN g
			ON index(g.tree, text2ltree('m' || m.id)) = nlevel(g.tree) - 1
		WHERE m.project = $1::INT
		GROUP BY m.id
	;`, [wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.add = (req, res) => {
	let { label, x, y, project, rows, cols } = req.body.data;
	const wallId = req.body.project;
	
	DB.conn.one(`
		INSERT INTO matrixes (label, x, y, rows, cols, project)
		VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::INT)
		RETURNING *
	;`, [label, x, y, JSON.stringify(rows), JSON.stringify(cols), wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.update = (req, res) => {
	const { label, x, y, rows, cols, id } = req.body.data;
	const wallId = req.body.project;
	DB.conn.none(`
		UPDATE matrixes 
		SET label = $1,
		x = $2,
		y = $3,
		rows = $4::jsonb,
		cols = $5::jsonb
		WHERE id = $6::INT
		AND project = $7::INT 
	;`, [label, x, y, JSON.stringify(rows), JSON.stringify(cols), id, wallId])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err));
}
exports.updateMulti = (req, res) => {
	// TO DO
}
exports.remove = (req, res) => {
	const { matrixId, wallId } = req.query;
	DB.conn.tx(t => {
		const batch = [];
		// DELETE THE NOTES
		batch.push(t.none(`
			DELETE FROM notes
			WHERE index(tree, text2ltree('m' || $1)) <> -1
				AND project = $2::INT
		;`, [matrixId, wallId]));
		// DELETE THE CARDS
		batch.push(t.none(`
			DELETE FROM cards
			WHERE index(tree, text2ltree('m' || $1)) <> -1
				AND project = $2::INT
		;`, [matrixId, wallId]));
		// DELETE THE GROUPS
		batch.push(t.none(`
			DELETE FROM groups
			WHERE index(tree, text2ltree('m' || $1)) <> -1
				AND project = $2::INT
		;`, [matrixId, wallId]));
		// DELETE THE MATRIX
		batch.push(t.none(`
			DELETE FROM matrixes
			WHERE id = $1::INT
				AND project = $2::INT
		;`, [matrixId, wallId]));

		return t.batch(batch)
		.catch(err => console.log(err));
	}).then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err))
}