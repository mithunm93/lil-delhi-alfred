var Firebase = require('firebase');
var moment = require('moment');
var private = require('./private');
var LittleDelhi = require('./littleDelhi');
var Slack = require('./slack.js');
var firebase = new Firebase(private.firebase);

var Order = {prototype: {}};
var INVALID_ORDER_TEXT = ' is not a valid Little Delhi item! Use: "alfred list" to see the list of valid items';
var NO_NAME_TEXT = ' you have not registered your name yet! Use: alfred name "<FIRST> <LAST>", to set your name';

Order.prototype.readTodaysFirebaseOrders = function(req, res) {
  console.log('reading orders');
  firebase.child('orders')
          .child(moment().format('MM-DD-YYYY'))
          .once('value', function(snapshot) {

  //  console.log(snapshot.val());
  //  var toSend = {};

  //  toSend.users = snapshot.val().keys();
  //  snapshot.val().forEach(function(item) {

  //  })

    res.json({ users: [['antonio', 'rocca']],
               items: [{'Garlic Naan': true}, {'Butter Chicken (Chef Recommended)': {'spice': 'Spicy'}}, {'Samosa': true}, {'Mango Lassi': true}, {'Mango Lassi': true}, {'Mango Lassi': true}] });
  });
};

Order.prototype.placeOrder = function(user, order, res) {
  var parseAndSaveOrder = function(user, fullName, order) {
    order = order.split(',');
    var toWrite = {};

    for (item of order) {
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
        // trailing space before ()
        if (name[name.length-1] === ' ')
          name = name.substring(0, name.length-1);
      }

      if (itemExists(name))
        toWrite[name] = (spice === undefined) ? true : { spice: spice };
      else {
        console.log('Invalid item: ' + name);
        return res.json(Slack.prototype.slackFormat(user, name + INVALID_ORDER_TEXT));
      }
    }

    writeFirebaseOrder(user, fullName, toWrite);
    return res.status(200).end();
  }

  firebase.child('users').once('value', function(snapshot) {
    var fullName = snapshot.val()[user];

    if (fullName === undefined) {
      console.log('No name for: ' + user);
      return res.json(Slack.prototype.slackFormat(user, NO_NAME_TEXT));
    }

    return parseAndSaveOrder(user, fullName, order);
  });
};

// HELPER METHODS

function itemExists(item) {
  return LittleDelhi[item] !== undefined;
}

function writeFirebaseOrder(user, fullName, order) {
  var date = moment().format('MM-DD-YYYY');
  var writeTo = firebase.child('orders').child(date).child(user);
  var entry = { name: fullName, order: order };

  writeTo.set(entry);
  console.log('Firebase write triggered for ' + user + 's order');
}
module.exports = Order;
