var express = require('express');
var path = require('path');
var bodyparser = require('body-parser');

var app = express();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, './public')));
app.use('/scripts', express.static(path.join(__dirname, './node_modules')));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

var routes = require('./routes')

app.get('/', routes.home)

app.get('/wall/:id', routes.wall)
app.get('/all', routes.multiwall)

app.get('/getNotes', routes.getNotes)

app.post('/addNote', routes.addNote)
app.post('/updateNote', routes.updateNote)
app.post('/removeNote', routes.removeNote)

app.post('/addTitle', routes.addTitle)
app.post('/updateTitle', routes.updateTitle)
app.post('/removeTitle', routes.removeTitle)

app.get('*', routes.notfound);

app.listen(3000, function () {
	console.log('the app is running on port 3000')
})