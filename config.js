const connection = {
	database: 'postit', /* REPLACE THIS IF YOU USED A DIFFERENT NAME WHEN CREATING YOUR DATABASE FOR QATALOG */ 
	port: 5432, /* REPLACE THIS WITH PORT #, e.g., 5432 OR 5433 */
	host: '',
	user: 'myjyby', /* REPLACE THIS WITH YOUR psql USERNAME */
	password: 'flyingpig' /* REPLACE THIS WITH YOUR psql PASSWORD */
}
const logSQL = true
const initOptions = {
	query(e) {
		if (logSQL) console.log(e.query)
	}
}
const pgp = require('pg-promise')(initOptions)
exports.conn = pgp(connection)
exports.pgp = pgp