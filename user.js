var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var Slack = require('./slack.js')

var User = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;

User.prototype.setUser = function(user, text, res) {
  var u = {};
  var i = text.indexOf(' ');

  if (i === -1) {
    console.log('Invalid name: ' + text);
    return res.json(Slack.prototype.slackFormat(user, text + Errors.INVALID_NAME_TEXT));
  }

  var first = text.substring(0, i);
  var last = text.substring(i+1, text.length);

  u[user] = [first, last];
  firebase.child('users').update(u);
  console.log('added ' + first + ' ' + last + ' to ' + user);

  return res.status(200).end();
};

module.exports = User;

