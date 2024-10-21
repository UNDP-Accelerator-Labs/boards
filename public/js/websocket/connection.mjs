import { Note, Group, Card } from '../elements/index.mjs';
import { wallId } from '../helpers/index.mjs';
const host = new URL(window.location).host;
let ws;

export const connectToSocket = function () {
	if (ws) {
		ws.onerror = ws.onopen = ws.onclose = null;
		ws.close();
	}

	ws = new WebSocket(`ws://${host}?project=${wallId}`);
	ws.onerror = function () {
		console.log('WebSocket error');
	};
	ws.onopen = function (evt) {
		console.log('WebSocket connection established');
	};
	ws.onmessage = async function (evt) {
		const res = JSON.parse(evt.data);
		const { project, object, operation, client, data } = res;
		if (project !== wallId) return console.log('something went wrong. recieving information from a different room');

		if (object === 'note') {
			if (operation === 'add') {
				await Note.add({ datum: data, client });
				console.log('added new simple note');
			} else if (operation === 'update') {
				await Note.update({ datum: data, client });
				console.log('updated simple note');
			} else if (operation === 'delete') {
				await Note.remove({ id: data?.id, client });
				console.log('removed note');
			} else if (operation === 'lock') {
				await Note.lock({ id: data?.id, client });
				console.log('locked note');
			} else if (operation === 'release') {
				await Note.release({ id: data?.id, client });
				console.log('locked note');
			}
		} else if (object === 'group') {
			if (operation === 'add') {
				await Group.add({ datum: data, client });
				console.log('added new group');
			} else if (operation === 'update') {
				await Group.update({ datum: data, client });
				console.log('updated group');
			} else if (operation === 'delete') {
				await Group.remove({ id: data?.id, client });
				console.log('removed group');
			} else if (operation === 'lock') {
				await Group.lock({ id: data?.id, client });
				console.log('locked group');
			} else if (operation === 'release') {
				await Group.release({ id: data?.id, client });
				console.log('locked group');
			}
		} else if (object === 'card') {
			if (operation === 'add') {
				await Card.add({ datum: data, client });
				console.log('added new card');
			} else if (operation === 'update') {
				await Card.update({ datum: data, client });
				console.log('updated card');
			} else if (operation === 'delete') {
				await Card.remove({ id: data?.id, client });
				console.log('removed card');
			} else if (operation === 'lock') {
				await Card.lock({ id: data?.id, client });
				console.log('locked card');
			} else if (operation === 'release') {
				await Card.release({ id: data?.id, client });
				console.log('locked card');
			}
		}

	};
	ws.onclose = function () {
		console.log('WebSocket connection closed');
		ws = null;
	};
};

// wsSendButton.onclick = function () {
	

// 	ws.send('Hello World!');
// 	showMessage('Sent "Hello World!"');
// };

export const broadcast = {
	connected: function () {
		if (!ws) {
			console.log('No WebSocket connection');
			return false;
		} else return true;
	},
	object: function (_kwargs) {
		const { object, operation, data } = _kwargs;
		if (this.connected()) {
			ws.send(JSON.stringify({ project: wallId, object, operation, data }));
			console.log('message sent')
		}
	},
}