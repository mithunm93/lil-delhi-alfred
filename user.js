var Firebase = require('firebase');
var private = require('./private');
var Slack = require('./slack.js')
var firebase = new Firebase(private.firebase);

var User = {prototype: {}};
var INVALID_NAME_TEXT = 'Your command must be formatted as such: alfred name "<FIRST> <LAST>"';

User.prototype.setUser = function(user, text, res) {
  var u = {};
  var i = text.indexOf(' ');

  if (i === -1) {
    console.log('Invalid name: ' + text);
    return res.json({text: INVALID_NAME_TEXT});
  }

  var first = text.substring(0, i);
  var last = text.substring(i+1, text.length);

  u[user] = [first, last];
  firebase.child('users').set(u);
  console.log('added ' + first + ' ' + last + ' to ' + user);
};

module.exports = User;

