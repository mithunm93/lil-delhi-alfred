// TODO: account for DST
var _ = require('underscore');
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

Order.prototype.orderComplete = function(req, res) {
  // TODO: make a routes table similar to commands
  if (!(req.body && req.body.token === private.slackSecret)) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  if (req.body.success === 'true') {
    console.log('Received successful completion message from Casper!');
    Slack.prototype.send(null, 'Order placed successfully by Casper');
  } else {
    console.log('Received order unsuccessful message from Casper');
    Slack.prototype.send(null, 'Something went wrong in Casper\'s ordering process');
  }
}

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
        return res.json(slackFormat(user, orderPlacedMessage(favorite)));
      }, function() {
        console.log('No favorite for: ' + user);
        return res.json(slackFormat(user, Errors.NO_FAVORITE_TEXT));
      });
    } else {
      // TODO: better way to return if null
      var parsedOrder = parseOrder(user, order, res);
      if (parsedOrder) {
        writeFirebaseOrder(user, parsedOrder);
        res.json(slackFormat(user, orderPlacedMessage(parsedOrder)));
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
  for (item in LittleDelhi) {
    if (item !== 'spices' && item !== 'reversed')
    text += (item + '\n');
  }

  text += '\nSpice levels:\n '
  for (s in LittleDelhi.spices)
    text += (s + '\n');

  text += '```';

  console.log('Printing full list');
  return res.json(slackFormat(null, text));
}

// ______________________HELPER METHODS_______________________________

function formatParsedOrder(pOrder) {
  return _.map(pOrder, function (item) {
    name = Object.keys(item)[0];
    spice = item[name]['spice'] || false;
    return [name, spice];
  });
}

function totalPrice(order) {
  // format for easy use
  fOrder = formatParsedOrder(order);

  price = 0;
  for (var i = 0; i < fOrder.length; i++)
    price += LittleDelhi["reversed"][fOrder[i][0]]['price'];

  return price;
}

function orderPlacedMessage(order) {
  var text = 'You have ordered '

  // format for easy use
  fOrder = formatParsedOrder(order);

  // if more than one item, make a list
  for (var i = 0; i < fOrder.length -1; i++) {
    text += fOrder[i][0];
    if (fOrder[i][1])
      text += '(' + fOrder[i][1] + ')';
    text += ', ';
  }

  if (order.length > 1)
    text += 'and ';

  text += _.last(fOrder)[0]
  if (_.last(fOrder)[1])
    text += '(' +  _.last(fOrder)[1] + ')';

  text += '. $' + totalPrice(order) + ' is your order total.';
  return text;
}

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
      toPush[LittleDelhi[name].name] = (spice === '') ? true : { spice: LittleDelhi.spices[spice] };
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
  console.log(names[i] + ' will receive the call for the order');

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

      // o is the 'user_name' in the data structured like this:
      //   user_name : [ {order1: true}, {order2: {spice: 'spicy'}}, ... ]
      for (o in orders) {
        if (!userInfo[o]) {
          console.log(o + ' has no information stored! Skipping their order');
          continue;
        }

        // I'm the main acccount, don't add me again!
        if (o !== private.selfUser)
          toReturn.users.push(userInfo[o].name);

        // i is an object structered like this:
        //   { order1: true }
        //         OR
        //   { order2: {spice: 'spicy'}}
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
