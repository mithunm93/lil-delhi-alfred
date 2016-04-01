var _ = require('underscore');
var private = require('./private');
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
  var args = _.map(arguments, function(a) {return a;});
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

module.exports = FirebaseHelper;
