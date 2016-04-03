var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var Slack = require('./slack.js')

var User = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;
var slackFormat = Slack.prototype.slackFormat;

User.prototype.setUser = function(user, text, res) {
  var u = {};
  text = text.split(',');
  
  if (text.length !== 2) {
    console.log('Invalid number of arguments: ' + text);
    return res.json(slackFormat(user, name + Errors.INVALID_INFO_TEXT));
  }
  var name = text[0];
  var number = text[1];

  // parse first and last name
  var i = name.indexOf(' ');

  if (i === -1) {
    console.log('Invalid name: ' + name);
    return res.json(slackFormat(user, name + Errors.INVALID_INFO_TEXT));
  }

  var first = name.substring(0, i);
  var last = name.substring(i+1, name.length);

  u['name'] = [first, last];

  // parse number

  // leading space
  if (number[0] === ' ')
    number = number.substring(1, number.length);

  // ensure number is digits only
  if (!(/^\d+$/.test(number))) {
    console.log('Invlaid number: ' + number);
    return res.json(slackFormat(user, number + Errors.INVALID_INFO_TEXT));
  }

  u['number'] = number;

  firebase.child('users').child(user).update(u);
  console.log('added ' + first + ' ' + last + ', ' + number + ' to ' + user);

  return res.json(slackFormat(user, 'Thank you for the info'));
};

module.exports = User;

