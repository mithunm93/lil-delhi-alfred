var Firebase = require('firebase');
var moment = require('moment');

var private = require('./private')

var firebase = new Firebase(private.firebase);

var Order = {prototype: {}};

Order.prototype.readFirebaseOrders = function() {
  console.log('reading orders');
  firebase.on('value', function(snapshot) {
    console.log(snapshot.val());
    res.json(snapshot.val());
  });
}

Order.prototype.placeOrder = function(user, order) {
    order = order.split(',');
    var toWrite = {};

    order.forEach(function(item, i, arr) {
      // leading space
      if (item[0] === ' ')
        item = item.substring(1, item.length);

      var spice;
      var name = item;
      var j = item.indexOf('(');

      // spice level
      if (j !== -1) {
        spice = item.substring(j+1, item.indexOf(')'));
        name = item.substring(0,j);
      }

      toWrite[name] = (spice === undefined) ? true : { spice: spice };
    });

    writeFirebaseOrder(user, toWrite);
}

// HELPER METHODS

function writeFirebaseOrder(user, order) {
  var date = moment().format('MM-DD-YYYY');
  var writeTo = firebase.child('orders').child(date).child(user);

  writeTo.set(order);
  console.log('Firebase write triggered for ' + user + 's order');
}
module.exports = Order;
