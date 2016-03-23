var Firebase = require('firebase');
var request = require('request');

var firebase = new Firebase('https://lil-delhi-alfred.firebaseio.com/');
//main function
function Order() { }

Order.prototype.getFirebaseOrders() {
  firebase.child('lil-delhi-alfred').on('value', function() {
  });
}
