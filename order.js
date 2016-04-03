// TODO: account for DST
var moment = require('moment');
var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var LittleDelhi = require('./littleDelhi');
var Slack = require('./slack.js');
var private = require('./private');

var Order = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;
var slackFormat = Slack.prototype.slackFormat;

// This method is used by Casper, the expected return structure is this:
//   { users: [['first', 'last'], ['first1', 'last1'], ...],
//     number: '0123456789,
//     items: [{'item1': true}, {'item2': {'spice': 'spicy'}}, ... ] }
//
// This exact format is required because Casper is very dumb, and will fail
// silently on pretty much any hiccup.
Order.prototype.readTodaysFirebaseOrders = function(req, res) {
  // TODO: make a routes table similar to commands, for GETs
  if (!(req.headers && req.headers.token === private.slackSecret)) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  console.log('Received request to get order from authorized sender');
  FirebaseHelper.prototype.authThenRun(readTodaysFirebaseOrders, res);

};

// Writes to Firebase the order placed by user formatted like so:
// users : { $user : { order : [$order1, $order2, ...] } }
Order.prototype.placeOrder = function(user, order, res) {

  // perform a check to ensure the user has a name and number on file
  firebase.child('users').child(user).once('value', function(snapshot) {
    var info = snapshot.val();

    if (!info) {
      console.log('No info for: ' + user);
      return res.json(slackFormat(user, Errors.NO_INFO_TEXT));
    }

    return parseAndSaveOrder(user, order, res);
  }, FirebaseHelper.prototype.failureCallback);
};

// HELPER METHODS
function pickRandomNumberFromOrder(order, userInfo) {
  var names = Object.keys(order);
  var i = Math.floor(Math.random() * names.length);

  Slack.prototype.send(names[i], 'You will receive the call to pick up the order');

  return userInfo[names[i]].number;
}

function readTodaysFirebaseOrders(args) {
  var res = args[0];

  console.log('reading today\'s orders');
  firebase.child('orders')
          .child(moment().utcOffset("-07:00").format('MM-DD-YYYY'))
          .once('value', function(snapshot) {

    var orders = snapshot.val();
    var toReturn = { users: [], number: '', items: [] }

    if (!orders)
      return res.json(toReturn);

    console.log('getting user info');
    firebase.child('users').once('value', function(snapshot) {
      var userInfo = snapshot.val();

      console.log(Object.keys(orders).length + ' orders received');

      for (o in orders) {
        if (!userInfo[o]) {
          console.log(o + ' has no information stored! Skipping their order');
          continue;
        }

        // I'm the main acccount, don't add me again!
        if (o !== private.selfUser)
          toReturn.users.push(userInfo[o].name);

        for (i of orders[o].order)
          toReturn.items.push(i);
      }

      toReturn.number = pickRandomNumberFromOrder(orders, userInfo);

      return res.json(toReturn);
    });

  }, FirebaseHelper.prototype.failureCallback);
}

function parseAndSaveOrder (user, order, res) {
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
      return res.json(slackFormat(user, name + Errors.INVALID_ORDER_TEXT));
    }
  }

  writeFirebaseOrder(user, toWrite);
  return res.json(slackFormat(user, 'Your order has been taken'));
}

function itemExists(item) {
  return LittleDelhi[item] !== undefined;
}

function writeFirebaseOrder(user, order) {
  var date = moment().utcOffset("-07:00").format('MM-DD-YYYY');
  var writeTo = firebase.child('orders').child(date).child(user);
  var entry = { order: order };

  writeTo.set(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's order');
}
module.exports = Order;
