const DB = require('../config.js');

exports.notes = require('./notes.js');
exports.cards = require('./cards.js');
exports.groups = require('./groups.js');
exports.matrixes = require('./matrixes.js');
exports.datasources = require('./datasources.js');
exports.pipes = require('./pipes.js');

exports.home = (req, res) => {
	DB.conn.tx(t => {
		const batch = []
		batch.push(t.any(`SELECT * FROM projects ORDER BY id;`))
		return t.batch(batch)
	}).then(data => {
		const [ projects ] = data;
		res.render('home', { title: 'AccLabs Boards', projects })
	}).catch(err => console.log(err))
}
exports.wall = (req, res) => {
	const { id: wallId } = req.params;

	DB.conn.tx(t => {
		return t.oneOrNone(`SELECT title FROM projects WHERE id = $1;`, [wallId])
		.then(result => {
			if (!result) {
				return t.one(`INSERT INTO projects DEFAULT VALUES RETURNING title;`);
			} else return result;
		}).catch(err => console.log(err));
	}).then(data => {
		const { title } = data;
		res.render('wall', { 
			title,
			wallId: wallId,
		});
	}).catch(err => console.log(err))
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
exports.changeTitle = (req, res) => {
	const { title, project: wallId } = req.body;

	DB.conn.none(`
		UPDATE projects
		SET title = $1
		WHERE id = $2::INT
	`, [ title, wallId ])
	.then(_ => res.status(200).json({ message: 'saved title' }))
	.catch(err => console.log(err));
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