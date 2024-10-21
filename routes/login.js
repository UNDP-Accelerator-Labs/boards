const uuid = require('uuid');

exports.login = (req, res) => {
	//
	// "Log in" user and set uuid to session.
	//
	const id = uuid.v4();
	console.log(`Updating session for user ${id}`);
	req.session.uuid = id;
	res.send({ result: 'OK', message: 'Session updated' });
};

exports.logout = (req, res) => {
	const { project } = req.query;
	const { session } = req;
	const { uuid } = session;
	const ws = req.app.get(uuid);
	console.log('Destroying session');
	session.destroy(function () {
		if (ws && ws.roomId === project) ws.close();
		res.send({ result: 'OK', message: 'Session destroyed' });
	});
};