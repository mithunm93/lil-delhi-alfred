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

module.exports = FirebaseHelper;
