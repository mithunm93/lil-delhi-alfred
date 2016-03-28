var express = require('express');
var bodyParser = require('body-parser');
var commands = require('./commands.js');
var private = require('./private');
var Order = require('./order')

var app = express();
var port = process.env.PORT || 3000;


// body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/commands', commands);
app.get('/get_orders', Order.prototype.readFirebaseOrders);

// error handler
app.use(function (err, req, res, next) {
   console.error(err.stack);
   res.status(400).send(err.message);
});

app.listen(port, function () {
   console.log('Slack bot listening on port ' + port);
});
