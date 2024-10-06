const DB = require('../config.js')

exports.home = (req, res) => {
	DB.conn.tx(t => {
		const batch = []
		batch.push(t.any(`SELECT * FROM notes;`))
		batch.push(t.any(`SELECT * FROM titles;`))
		return t.batch(batch)
	})
	.then(data => {
		res.render('home', { title: 'post it', notes: JSON.stringify(data[0]), titles: JSON.stringify(data[1]) })
	})
	.catch(err => console.log(err))
}
exports.wall = (req, res) => {
	const wallId = req.params.id
	DB.conn.tx(t => {
		return t.oneOrNone(`SELECT (1) FROM projects WHERE id = $1;`, [wallId])
		.then(result => {
			if (!result) {
				return t.none(`INSERT INTO projects DEFAULT VALUES;`)
				.then(_ => {
					const batch = []
					batch.push(t.any(`SELECT * FROM notes WHERE project = $1;`, [wallId]))
					batch.push(t.any(`SELECT * FROM titles WHERE project = $1;`, [wallId]))
					return t.batch(batch)
				})
			}
			else {
				const batch = []
				batch.push(t.any(`SELECT * FROM notes WHERE project = $1;`, [wallId]))
				batch.push(t.any(`SELECT * FROM titles WHERE project = $1;`, [wallId]))
				return t.batch(batch)
			}
		})
	})
	.then(data => {
		res.render('wall', { title: 'post it', notes: JSON.stringify(data[0]), titles: JSON.stringify(data[1]), wall: wallId })
	})
	.catch(err => console.log(err))
}
exports.multiwall = (req, res) => {
	DB.conn.tx(t => {			
		const batch = []
		batch.push(t.any(`SELECT * FROM notes;`))
		// batch.push(t.any(`SELECT * FROM titles WHERE project = $1;`, [wallId]))
		return t.batch(batch)
	})
	.then(data => {
		res.render('multiwall', { title: 'post it', notes: JSON.stringify(data[0]) })
	})
	.catch(err => console.log(err))
}
exports.getNotes = (req, res) => {
	const { wallId } = req.query;
	DB.conn.any(`SELECT * FROM notes WHERE project = $1::INT;`, [wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err));
}
exports.addNote = (req, res) => {
	const { content, color, x, y } = req.body.data
	const wallId = req.body.project
	DB.conn.one(`
		INSERT INTO notes (content, color, x, y, project)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	;`, [content, color, x, y, wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err))
}
exports.updateNote = (req, res) => {
	const { content, color, x, y, id } = req.body.data
	const wallId = req.body.project
	DB.conn.none(`
		UPDATE notes 
		SET content = $1,
		color = $2,
		x = $3,
		y = $4,
		project = $5::INT
		WHERE id = $6::INT
	;`, [content, color, x, y, wallId, id])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err))
}
exports.removeNote = (req, res) => {
	const { id } = req.body.data
	DB.conn.none(`
		DELETE FROM notes
		WHERE id = $1
	;`, [id])
	.then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err))
}

exports.addTitle = (req, res) => {
	const { content, x, y } = req.body.data
	const wallId = req.body.project
	DB.conn.one(`
		INSERT INTO titles (content, x, y, project)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	;`, [content, x, y, wallId])
	.then(data => res.status(200).json(data))
	.catch(err => console.log(err))
}
exports.updateTitle = (req, res) => {
	const { content, x, y, id } = req.body.data
	const wallId = req.body.project
	DB.conn.none(`
		UPDATE titles 
		SET content = $1,
		x = $2,
		y = $3,
		project = $4
		WHERE id = $5
	;`, [content, x, y, wallId, id])
	.then(_ => res.status(200).json({ response: 'Successfully saved.' }))
	.catch(err => console.log(err))
}
exports.removeTitle = (req, res) => {
	const { id } = req.body.data
	DB.conn.none(`
		DELETE FROM titles
		WHERE id = $1
	;`, [id])
	.then(_ => res.status(200).json({ response: 'Successfully deleted.' }))
	.catch(err => console.log(err))
}

exports.notfound = (req, res) => {
	res.send('This is not the route that you are looking for')
}