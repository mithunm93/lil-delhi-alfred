// TODO: account for DST
var moment = require('moment');
var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var LittleDelhi = require('./littleDelhi');
var Slack = require('./slack.js');
var User = require('./user.js');
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
  User.prototype.checkInfoExistsThenRun(user, function(args) {
    var user = args[0];
    var order = args[1];
    var res = args[2];

    // placing favorite
    if (order === '') {
      User.prototype.checkFavoriteExistsThenRun(user, function(args) {
        console.log('Favorite received for: ' + user);
        var favorite = args[0];
        writeFirebaseOrder(user, favorite);
        return res.json(slackFormat(user, 'Your order has been placed'));
      }, function() {
        console.log('No favorite for: ' + user);
        return res.json(slackFormat(user, Errors.NO_FAVORITE_TEXT));
      });
    } else {
      // TODO: better way to return if null
      var parsedOrder = parseOrder(user, order, res);
      if (parsedOrder) {
        writeFirebaseOrder(user, parsedOrder);
        res.json(slackFormat(user, 'Your order has been placed'));
      }
      return;
    }

  }, noUserInfoWarning, user, order, res);
};

Order.prototype.setFavorite = function(user, order, res) {
  // perform a check to ensure the user has a name and number on file
  User.prototype.checkInfoExistsThenRun(user, function(args) {
    var user = args[0];
    var order = args[1];
    var res = args[2];

    var parsedOrder = parseOrder(user, order, res);
    if (parsedOrder) {
      writeFirebaseFavorite(user, parsedOrder);
      res.json(slackFormat(user, 'Your favorite has been set'));
    }
    return;
  }, noUserInfoWarning, user, order, res);
}

// Show list of available items
Order.prototype.list = function(res) {
  var text = 'Here are the list of accepted items: ```';
  for (item in LittleDelhi)
    text += (item + '\n');
  text += '```';

  console.log('Printing full list');
  return res.json(slackFormat(null, text));
}

// ______________________HELPER METHODS_______________________________

function parseOrder(user, order, res) {
  order = order.split(',');
  var toReturn = [];

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
      toReturn.push(toPush);
    } else {
      console.log('Invalid item: ' + name);
      res.json(slackFormat(user, name + Errors.INVALID_ORDER_TEXT));
      return;
    }
  }

  return toReturn;
}

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

function itemExists(item) {
  return LittleDelhi[item] !== undefined;
}

function writeFirebaseOrder(user, order) {
  var date = moment().utcOffset("-07:00").format('MM-DD-YYYY');
  var writeTo = firebase.child('orders').child(date).child(user);
  var entry = { order: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's order');
}

function writeFirebaseFavorite(user, order) {
  var writeTo = firebase.child('users').child(user);
  var entry = { favorite: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's favorite');
}

function noUserInfoWarning(args) {
  var user = args[0];
  var res = args[2];
  console.log('No info for: ' + user);
  return res.json(slackFormat(user, Errors.NO_INFO_TEXT));
}
module.exports = Order;
