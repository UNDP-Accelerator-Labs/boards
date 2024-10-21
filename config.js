const connection = {
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	ssl: process.env.DB_HOST !== 'localhost',
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