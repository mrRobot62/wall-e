/**
 *  Omniwheel - NodeBot
 * 
 *  Webserver 
 * 
 * 
 */
var express = require('express'),
    joinPath = require('path.join'),
    app = express(),
    PORT = 3000,
    localip;

//configure Express
app.use('/view',  express.static(__dirname + '/view'));
app.engine('.html', require('ejs').__express);
app.set('views', joinPath(__dirname, 'view'));
app.set('view engine', 'html');

console.log("__dirname : %s", __dirname);
console.log("JoinPath (%s)", joinPath(__dirname, 'view'));

var server = app.listen(PORT, function() {
    console.log('Listening on port %d', server.address().port);
});

app.get('/', function(req, res) {
  res.render('index', { localip : localip });
});

app.post('/locate', function(req, res) {
  console.log(req.params);
  localip = req.param('local_ip');
});