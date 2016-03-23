var express = require('express');
var bodyParser = require('body-parser');
var schedule = require('node-schedule');
var commands = require('./commands.js');
//var orders = require('./orders.js')

var app = express();
var port = process.env.PORT || 3000;

var Firebase = require('firebase');

var firebase = new Firebase('https://lil-delhi-alfred.firebaseio.com/orders/03222016');

// body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

//console.log('Starting salebot scheduler');
// 10 AM PST every day, heroku server is on GMT
//var j = schedule.scheduleJob({hour: 17, minute: 5}, new Sales().dailyCheck);

app.post('/commands', commands);
app.get('/get_orders', function(req, res) {
  console.log('getting orders');
  firebase.on('value', function(snapshot) {
    console.log(snapshot.val());
    res.json(snapshot.val());
  });
});

// error handler
app.use(function (err, req, res, next) {
   console.error(err.stack);
   res.status(400).send(err.message);
});

app.listen(port, function () {
   console.log('Slack bot listening on port ' + port);
});
