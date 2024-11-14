'use strict';

const session = require('express-session');

const PgSession = require('connect-pg-simple')(session); // IN CASE WE WANT TO STORE SESSIONS
const express = require('express');
const http = require('http');
// const https = require('https');
const url = require('url');
const path = require('path');
const bodyparser = require('body-parser');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const DB = require('./config.js');

const app = express();

app.set('trust proxy', 1);

const cookie = {
	domain: process.env.NODE_ENV === 'production' ? 'acclabs-boards.azurewebsites.net' : undefined,
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	maxAge: 1 * 1000 * 60 * 60 * 24 * 1, // DEFAULT TO 1 DAY. UPDATE TO 1 YEAR FOR TRUSTED DEVICES
	sameSite: 'lax',
};
const sessionMiddleware = session({
	name: 'postit-session',
	secret: 'my-secure-pass',
	store: new PgSession({ pgPromise: DB.conn }),
	resave: false,
	saveUninitialized: false,
	cookie,
});

app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, './public')));
app.use('/scripts', express.static(path.join(__dirname, './node_modules')));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const routes = require('./routes');

app.get('/', routes.home);

app.get('/wall/:id', routes.wall);
app.get('/all', routes.multiwall);

app.get('/getNotes', routes.notes.get);
app.post('/addNote', routes.notes.add);
app.post('/updateNote', routes.notes.update);
app.post('/updateNotes', routes.notes.updateMulti);
app.delete('/removeNote', routes.notes.remove);

app.get('/getGroups', routes.groups.get);
app.post('/addGroup', routes.groups.add);
app.post('/updateGroup', routes.groups.update);
app.post('/updateGroups', routes.groups.updateMulti);
app.delete('/removeGroup', routes.groups.remove);

app.get('/getCards', routes.cards.get);
app.post('/addCard', routes.cards.add);
app.post('/updateCard', routes.cards.update);
app.post('/updateCards', routes.cards.updateMulti);
app.delete('/removeCard', routes.cards.remove);

app.get('/getDatasources', routes.datasources.get);
app.post('/addDatasource', routes.datasources.add);
app.get('/increaseDatasource', routes.datasources.increase);

app.get('/getMatrixes', routes.matrixes.get);
app.post('/addMatrix', routes.matrixes.add);
app.post('/updateMatrix', routes.matrixes.update);
app.post('/updateMatrixes', routes.matrixes.updateMulti);
app.delete('/removeMatrix', routes.matrixes.remove);

app.post('/addTitle', routes.addTitle);
app.post('/updateTitle', routes.updateTitle);
app.post('/removeTitle', routes.removeTitle);

// TEMP LOGIN MECHANISM
const { login, logout } = require('./routes/login.js');
app.post('/login', login);
app.delete('/logout', logout);
///////////////////////

app.get('*', routes.notfound);

let server = http.createServer(app);
// if (process.env.NODE_ENV === 'production') server = https.createServer(app);

function heartbeat() {
	this.isAlive = true;
}
// SET UP WEBSOCKET SERVER
// SOURCE: https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
const wss = new WebSocketServer({ clientTracking: true, noServer: true });

server.on('upgrade', function (req, socket, head) {
	socket.on('error', err => console.log(err));

	console.log('Parsing session from request...');

	sessionMiddleware(req, {}, () => {
		if (!req.session.uuid) {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		console.log('Session is parsed!');

		socket.removeListener('error', err => console.log(err));

		wss.handleUpgrade(req, socket, head, function (ws) {
			wss.emit('connection', ws, req);
		});
	});
});

wss.on('connection', (ws, req) => {
	const path = url.parse(req.url);
	const params = new URLSearchParams(path.query);
	const project = params.get('project');
	const { uuid } = req.session;
	// DECLARE THE SOCKET IS ALIVE
	ws.isAlive = true;
	// CHECK IF THE ROOM FOR THE PROJECT EXISTS
	// WE SET ROOMS FOR EACH PROJECT SO THAT BOARDS TO NOT GET MIXED UP
	ws.roomId = project;
	app.set(uuid, ws);

	ws.on('error', err => console.log(err));
	ws.on('message', function message(data, isBinary) {
		const parsedData = JSON.parse(data);
		const { project } = parsedData;
		if (!parsedData.client) parsedData.client = req.session.uuid;

		wss.clients.forEach(function each(client) {
			if (client !== ws && client.readyState === WebSocket.OPEN) {
				if (client.roomId === project) client.send(JSON.stringify(parsedData), { binary: isBinary });
			}
		});
	});
	ws.on('pong', heartbeat);
	ws.on('close', function () {
		app.set(uuid, null);
	});
});

const interval = setInterval(function ping () {
	wss.clients.forEach(function each (ws) {
		if (ws.isAlive === false) return ws.terminate();

		ws.isAlive = false;
		ws.ping();
	});
}, 30000);

wss.on('close', function close () {
	clearInterval(interval);
});

server.listen(8000, function () {
	console.log('the app is running on port 8000');
})
