var _ = require('underscore');
var private = require('./private');
var moment = require('moment');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require("firebase-token-generator");
var tokenGenerator = new FirebaseTokenGenerator(private.firebaseSecret);

var FirebaseHelper = {prototype:{}};

FirebaseHelper.prototype.ref = new Firebase(private.firebase);

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

// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, userInfo])
FirebaseHelper.prototype.getUserInfo = function() {
  var args = _.toArray(arguments);
  var callback = args.shift();

  console.log('getting user info');
  FirebaseHelper.prototype.ref.child('users').once('value', function(snapshot) {

    var userInfo = shapshot.val();
    args.push(userInfo);
    callback(args);
  }, FirebaseHelper.prototype.failureCallback);
}

FirebaseHelper.prototype.writeFirebaseOrder = function(user, order) {
  var date = moment().utcOffset("-07:00").format('MM-DD-YYYY');
  var writeTo = FirebaseHelper.prototype.ref.child('orders').child(date).child(user);
  var entry = { order: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's order');
}

FirebaseHelper.prototype.writeFirebaseFavorite = function(user, order) {
  var writeTo = FirebaseHelper.prototype.ref.child('users').child(user);
  var entry = { favorite: order };

  writeTo.update(entry, FirebaseHelper.prototype.failureCallback);
  console.log('Firebase write triggered for ' + user + 's favorite');
}

module.exports = FirebaseHelper;
