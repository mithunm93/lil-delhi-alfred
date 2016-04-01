var moment = require('moment');
var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var LittleDelhi = require('./littleDelhi');
var Slack = require('./slack.js');

var Order = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;

// This method is used by Casper, the expected return structure is this:
//   { users: [['first', 'last'], ['first1', 'last1'], ...],
//     items: [{'item1': true}, {'item2': {'spice': 'spicy'}}, ... ] }
//
// This exact format is required because Casper is very dumb, and will fail
// silently on pretty much any hiccup.
Order.prototype.readTodaysFirebaseOrders = function(req, res) {
  console.log('reading orders');
  firebase.child('orders')
          .child(moment().format('MM-DD-YYYY'))
          .once('value', function(snapshot) {

    var orders = snapshot.val();
    var orderNames = Object.keys(orders);
    var toReturn = { users: [], items: [] }
    console.log(orderNames.length + ' orders received');

    if (orderNames.length === 0)
      return res.json(toReturn);

    for (o in orders) {
      toReturn.users.push(orders[o].name);

      for (i of orders[o].order)
        toReturn.items.push(i);
    }

    return res.json(toReturn);
  }, FirebaseHelper.prototype.failureCallback);
};

Order.prototype.placeOrder = function(user, order, res) {
  var parseAndSaveOrder = function(user, fullName, order) {
    order = order.split(',');
    var toWrite = [];

    for (item of order) {
      // leading space
      if (item[0] === ' ')
        item = item.substring(1, item.length);

      var spice = '';
      var name = item;
      var toPush = {};
      var j = item.indexOf('(');

      // spice level
      if (j !== -1) {
        spice = item.substring(j+1, item.indexOf(')'));
        name = item.substring(0,j);
        // trailing space before ()
        if (name[name.length-1] === ' ')
          name = name.substring(0, name.length-1);
      }

      if (itemExists(name)) {
        toPush[name] = (spice === '') ? true : { spice: spice };
        toWrite.push(toPush);
      } else {
        console.log('Invalid item: ' + name);
        return res.json(Slack.prototype.slackFormat(user, name + Errors.INVALID_ORDER_TEXT));
      }
    }

    writeFirebaseOrder(user, fullName, toWrite);
    return res.status(200).end();
  }

  firebase.child('users').once('value', function(snapshot) {
    var fullName = snapshot.val()[user];

    if (fullName === undefined) {
      console.log('No name for: ' + user);
      return res.json(Slack.prototype.slackFormat(user, Errors.NO_NAME_TEXT));
    }

    return parseAndSaveOrder(user, fullName, order);
  }, FirebaseHelper.prototype.failureCallback);
};

// HELPER METHODS

function itemExists(item) {
  return LittleDelhi[item] !== undefined;
}

function writeFirebaseOrder(user, fullName, order) {
  var date = moment().format('MM-DD-YYYY');
  var writeTo = firebase.child('orders').child(date).child(user);
  var entry = { name: fullName, order: order };

  writeTo.set(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's order');
}
module.exports = Order;
