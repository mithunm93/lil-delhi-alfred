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

// This method is used by Casper, to post to Slack the status
// of its order placement.
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
  FirebaseHelper.prototype.authThenRun(prepareMessageForCasper, res);
};

// Writes to Firebase the order placed by user formatted like so:
// users : { $user : { order : [$order1, $order2, ...] } }
//
// Repeated calls from the same user on the same day will overwrite
Order.prototype.placeOrder = function(user, uOrder, res) {

  // placing favorite
  if (uOrder === '') {
    FirebaseHelper.prototype.checkFavoriteExistsThenRun(user, function(args) {
      console.log('Favorite received for: ' + user);
      var favorite = args[0];
      FirebaseHelper.prototype.writeFirebaseOrder(user, favorite);
      return res.json(slackFormat(user, orderPlacedMessage(favorite)));
    }, function() {
      console.log('No favorite for: ' + user);
      return res.json(slackFormat(user, Errors.NO_FAVORITE_TEXT));
    });
  } else {
    // TODO: better way to return if null
    var fOrder = userToFirebaseFormat(user, uOrder, res);
    if (fOrder) {
      FirebaseHelper.prototype.writeFirebaseOrder(user, fOrder);
      res.json(slackFormat(user, orderPlacedMessage(fOrder)));
    }
  }
};

// Sets a user's favorite in firebase, this allows the user to simply
// use "alfred order" to place an order as opposed to typing out their
// entire order every time.
Order.prototype.setFavorite = function(user, uOrder, res) {

  var fOrder = userToFirebaseFormat(user, uOrder, res);
  if (fOrder) {
    FirebaseHelper.prototype.writeFirebaseFavorite(user, fOrder);
    res.json(slackFormat(user, 'Your favorite has been set'));
  }
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

// Show current order status, including items and total price.
// This is also the message that is shown wheen a user first places
// their order.
Order.prototype.status = function(user, res) {
  FirebaseHelper.prototype.readTodaysOrders(function(args) {
    var fOrders = args[0];
    if (!fOrders || !fOrders[user])
      return res.json(slackFormat(user, Errors.NO_ORDER_TEXT));
    else
      return res.json(slackFormat(user, orderPlacedMessage(fOrders[user].order)));
  });
}

// Forget the user's order from today
Order.prototype.forgetOrder = function(user, res) {
  FirebaseHelper.prototype.checkOrderExistsThenRun(user, function(){
    // order exsits, we need to delete it
    FirebaseHelper.prototype.removeFirebaseOrder(user, function(error) {
      if (error)
        return res.json(slackFormat(user, "Something went wrong when trying to remove your order"));
      else
        return res.json(slackFormat(user, "Your order has been removed"));
    });
  }, function() {
    // order doesn't exist
      return res.json(slackFormat(user, Errors.NO_ORDER_TEXT));
  });
}
// ______________________HELPER METHODS_______________________________

// formats the order from this:
// [{"Paneer Makhani" : { spice: "Spicy" }}, {"Naan" : true}]     (Firebase Format)
//       to this:
// [["Paneer Makhani", "Spicy"], ["Naan", false]]
function firebaseToArrayFormat(fOrder) {
  return _.map(fOrder, function (item) {
    name = Object.keys(item)[0];
    spice = item[name]['spice'] || false;
    return [name, spice];
  });
}

// Returns the total cost of all the items in the order
function totalPrice(fOrder) {
  // format for easy use
  aOrder = firebaseToArrayFormat(fOrder);

  price = 0;
  for (var i = 0; i < aOrder.length; i++)
    price += LittleDelhi["reversed"][aOrder[i][0]]['price'];

  return price;
}

// Creates the message that tells users what they have ordered
function orderPlacedMessage(fOrder) {
  var text = 'You have ordered ';

  // format for easy use
  aOrder = firebaseToArrayFormat(fOrder);

  // if more than one item, make a list
  for (var i = 0; i < aOrder.length -1; i++) {
    text += aOrder[i][0];
    if (aOrder[i][1])
      text += '(' + aOrder[i][1] + ')';
    text += ', ';
  }

  if (aOrder.length > 1)
    text += 'and ';

  text += _.last(aOrder)[0]
  if (_.last(aOrder)[1])
    text += '(' +  _.last(aOrder)[1] + ')';

  text += '. $' + totalPrice(fOrder) + ' is your order total.';
  return text;
}

// Converts the order from human readable:
// alfred order "paneer makhani (spicy), naan"
//      to Firebase format:
// [{"Paneer Makhani" : { spice: "Spicy" }}, {"Naan" : true}]
function userToFirebaseFormat(user, uOrder, res) {
  uOrder = uOrder.split(',');
  var toReturn = [];
  var invalidMessages = [];

  for (item of uOrder) {
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
      var hasSpice = itemHasSpiceOptions(name);
      var value = '';

      // We tell the user if they entered an item with a spice level when
      // that item actually doesn't have a spice level. We still place the
      // order, and the user knows this because "toReturn" is parsed back
      // into Firebase terminology and returned to slack after this method.
      if (hasSpice && spice !== '')
        value = { spice: LittleDelhi.spices[spice] };
      else {
        if (!hasSpice)
          invalidMessages.push(name + Errors.NO_SPICE_OPTION_TEXT);
        value = true;
      }
      toPush[LittleDelhi[name].name] = value;
      toReturn.push(toPush);
    } else {
      console.log('Invalid item: ' + name);
      res.json(slackFormat(user, name + Errors.INVALID_ORDER_TEXT));
      return;
    }
  }

  // inform the user of any errors with their order
  if (invalidMessages.length !== 0)
    Slack.prototype.send(user, invalidMessages.join(', '));

  return toReturn;
}

// This method picks a random phone number from the people that have placed
// an order and returns it. It is used for picking a person to receive the
// call for picking up the delivery.
function pickRandomNumberFromOrder(fOrder, userInfo) {
  var names = Object.keys(fOrder);
  var i = Math.floor(Math.random() * names.length);

  Slack.prototype.send(names[i], 'You will receive the call to pick up the order');
  console.log(names[i] + ' will receive the call for the order');

  return userInfo[names[i]].number;
}

// This method reads the orders from today and gets the user info from Firebase
// to prepare them to send to Casper.
function prepareMessageForCasper(args) {
  var res = args[0];
  var toReturn = { users: [], number: '', items: [] }

  FirebaseHelper.prototype.readTodaysOrders(function(args) {
    var fOrders = args[0];
    if (!fOrders) return res.json(toReturn);

    FirebaseHelper.prototype.getUserInfo(function(args) {
      var userInfo = args[0];

      console.log(Object.keys(fOrders).length + ' orders received');

      // o is the 'user_name' in the data structured like this:
      //   user_name : [ {order1: true}, {order2: {spice: 'spicy'}}, ... ]
      for (o in fOrders) {
        if (!userInfo[o]) {
          console.log(o + ' has no information stored! Skipping their order');
          delete fOrders[o];
          continue;
        }

        // I'm the main acccount, don't add me again!
        if (o !== private.selfUser)
          toReturn.users.push(userInfo[o].name);

        // i is an object structered like this:
        //   { order1: true }
        //         OR
        //   { order2: {spice: 'spicy'}}
        for (i of fOrders[o].order)
          toReturn.items.push(i);
      }

      toReturn.number = pickRandomNumberFromOrder(fOrders, userInfo);

      return res.json(toReturn);
    });
  });
}

// Checks to see if an item exists in the JSON file
function itemExists(item) {
  return LittleDelhi[item] !== undefined;
}

// Checks to see if the item exists and has spice options
function itemHasSpiceOptions(item) {
  return itemExists(item) && (LittleDelhi[item]["spiceOptions"] === true);
}

module.exports = Order;
