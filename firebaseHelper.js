var _ = require('underscore');
var private = require('./private');
var moment = require('moment');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require("firebase-token-generator");
var tokenGenerator = new FirebaseTokenGenerator(private.firebaseSecret);

var FirebaseHelper = {prototype:{}};

const ALREADY_PLACED_TEXT = 'already_placed'

// The reference to Alfie's Firebase
FirebaseHelper.prototype.ref = new Firebase(private.firebase);

// Generates a new token for authentication with Firebase
FirebaseHelper.prototype.getNewToken = function() {
  return tokenGenerator.createToken({uid: 'lil-delhi-alfred'});
};

FirebaseHelper.prototype.failureCallback = function(error) {
  // TODO: properly return a failure message
  if (error)
    console.log(error.code + ': ' + error.message);
};

// provide a callback function as first argument
//   and any arguments for that callback funciton as the succeeding ones
//
// TODO: make these FirebaseHelper calls more succinct
FirebaseHelper.prototype.authThenRun = function() {
  var args = _.toArray(arguments);
  var callback = args.shift();
  var authData = FirebaseHelper.prototype.ref.getAuth();

  if (authData)
    return callback(args);
  else {
    FirebaseHelper.prototype.ref.authWithCustomToken(FirebaseHelper.prototype.getNewToken(), function(error, authData) {
      if (error)
        FirebaseHelper.prototype.failureCallback(error);
      else {
        console.log("Login Succeeded!", authData);
        return callback(args);
      }
    });
  }
}

// ----------------------- USER HLPERS --------------------------------


// Checks to see if they user has info stored then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
FirebaseHelper.prototype.checkInfoExistsThenRun = function() {
  var args = _.toArray(arguments);
  var user = args.shift();
  var successCallback = args.shift();
  var failureCallback = args.shift();

  FirebaseHelper.prototype.ref.child('users').child(user).once('value', function(snapshot) {
    var info = snapshot.val();
    if (info) {
      console.log('User info exists for: ' + user);
      args.push(info);
      return successCallback(args);
    } else
      return failureCallback(args);
  });
}

// Checks to see if they user has info stored then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
FirebaseHelper.prototype.checkFavoriteExistsThenRun = function() {
  var args = _.toArray(arguments);
  var user = args.shift();
  var successCallback = args.shift();
  var failureCallback = args.shift();

  FirebaseHelper.prototype.ref.child('users').child(user).child('favorite').once('value', function(snapshot) {
    var favorite = snapshot.val();
    if (favorite) {
      console.log('User favorite exists for: ' + user);
      args.push(favorite);
      return successCallback(args);
    } else
      return failureCallback(args);
  });
}

// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, userInfo])
FirebaseHelper.prototype.getUserInfo = function() {
  var args = _.toArray(arguments);
  var callback = args.shift();

  console.log('getting user info');
  FirebaseHelper.prototype.ref.child('users').once('value', function(snapshot) {

    var userInfo = snapshot.val();
    args.push(userInfo);
    callback(args);
  }, FirebaseHelper.prototype.failureCallback);
}

FirebaseHelper.prototype.writeFirebaseUser = function(user, info) {
  FirebaseHelper.prototype.ref.child('users').child(user).update(info);
  console.log('added ' + user + ': ' + info.name + ', ' + info.number);
}

// Removes the user's info, including favorite
FirebaseHelper.prototype.removeFirebaseUser = function(user, callback) {
  FirebaseHelper.prototype.ref.child('users').child(user).remove(callback);
}
// --------------------- ORDER HELPERS --------------------------------

// Checks to see if the order has already been handed off to Casper for today
//   FIRST argument must be success callback (order not placed)
//   SECOND argument must be failure callback
FirebaseHelper.prototype.checkOrderNotPlacedThenRun = function() {
  var args = _.toArray(arguments);
  var successCallback = args.shift();
  var failureCallback = args.shift();

  FirebaseHelper.prototype.readTodaysOrders(function(args) {
    var orders = args[0];

    if (orders[ALREADY_PLACED_TEXT] === undefined) {
      console.log('Order not yet placed today');
      return successCallback(args);
    } else {
      console.log('Order already placed today');
      return failureCallback(args);
    }
  });
}

// Write into Firebase that today's orders have already been placed
FirebaseHelper.prototype.writeFirebaseRead = function() {
  var date = moment().utcOffset("-07:00").format('MM-DD-YYYY');
  var writeTo = FirebaseHelper.prototype.ref.child('orders').child(date);
  var entry = {}
  entry[ALREADY_PLACED_TEXT] = true

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for today\'s orders placed');
}

// Checks to see if the user has placed an order today then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
FirebaseHelper.prototype.checkOrderExistsThenRun = function() {
  var args = _.toArray(arguments);
  var user = args.shift();
  var successCallback = args.shift();
  var failureCallback = args.shift();

  FirebaseHelper.prototype.ref.child('orders')
    .child(moment().utcOffset("-07:00").format('MM-DD-YYYY'))
    .child(user).once('value', function(snapshot) {
    if (snapshot.exists()) {
      console.log('order exists for: ' + user);
      args.push(snapshot.val());
      return successCallback(args);
    } else
      console.log('No order for: ' + user);
      return failureCallback(args);
  });
}

// Removes the order that the user has placed today
FirebaseHelper.prototype.removeFirebaseOrder = function(user, callback) {
  FirebaseHelper.prototype.ref.child('orders')
    .child(moment().utcOffset("-07:00").format('MM-DD-YYYY'))
    .child(user).remove(callback);
}
// Writes the order to Firebase on today's date, under the user's name
FirebaseHelper.prototype.writeFirebaseOrder = function(user, order) {
  var date = moment().utcOffset("-07:00").format('MM-DD-YYYY');
  var writeTo = FirebaseHelper.prototype.ref.child('orders').child(date).child(user);
  var entry = { order: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's order');
}

// Writes the user's favorite into Firebase
FirebaseHelper.prototype.writeFirebaseFavorite = function(user, order) {
  var writeTo = FirebaseHelper.prototype.ref.child('users').child(user);
  var entry = { favorite: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's favorite');
}

// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, orders])
FirebaseHelper.prototype.readTodaysOrders = function() {
  var args = _.toArray(arguments);
  var callback = args.shift();

  console.log('reading today\'s orders');
  FirebaseHelper.prototype.ref.child('orders')
    .child(moment().utcOffset("-07:00").format('MM-DD-YYYY'))
    .once('value', function(snapshot) {

      var orders = snapshot.val();
      args.push(orders)
      callback(args);
  }, FirebaseHelper.prototype.failureCallback);
}
module.exports = FirebaseHelper;
