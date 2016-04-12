var _ = require('underscore');
var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var Slack = require('./slack.js');
var Help = require('./help');

var User = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;
var slackFormat = Slack.prototype.slackFormat;

User.prototype.userInfo = function(user, text, res) {
  if (text === '')
    showInfo(user, res);
  else
    setInfo(user, text, res);
};

// Checks to see if they user has info stored then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
User.prototype.checkInfoExistsThenRun = function() {
  var args = _.map(arguments, function(a) {return a;});
  var user = args.shift();
  var successCallback = args.shift();
  var failureCallback = args.shift();

  firebase.child('users').child(user).once('value', function(snapshot) {
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
User.prototype.checkFavoriteExistsThenRun = function() {
  var args = _.map(arguments, function(a) {return a;});
  var user = args.shift();
  var successCallback = args.shift();
  var failureCallback = args.shift();

  firebase.child('users').child(user).child('favorite').once('value', function(snapshot) {
    var favorite = snapshot.val();
    if (favorite) {
      console.log('User favorite exists for: ' + user);
      args.push(favorite);
      return successCallback(args);
    } else
      return failureCallback(args);
  });
}

User.prototype.help = function(res) {
  var text = Help.alfred;
  text += Help.enterInfo;
  text += Help.placeOrder;
  text += Help.orderFinished;
  text += Help.orderCompletion;
  text += Help.extraActions;
  text += Help.favorite;
  text += Help.list;
  text += Help.showInfo;
  text += Help.orderFavorite;
  text += Help.help;

  console.log('Printed help text');
  return res.json(slackFormat(null, text));
}

// ______________________HELPER METHODS_______________________________

function showInfo(user, res) {
  User.prototype.checkInfoExistsThenRun(user, function(args) {
    var info = args[0];

    var text = '```';

    text += ('Name: ' + info.name[0] + ' ' + info.name[1] + '\n');
    text += ('Number: ' + info.number + '\n');
    text += ('Favorite: ');

    if (info.favorite) {
      for (item of info.favorite) {
        // name of item
        var name = Object.keys(item)[0];
        text += name;
        // if it has a spice level
        if (item[name] !== true)
          text += ('(' + item[name].spice + ')');
        text += ', ';
      }
      // remove trailing ', '
      text = text.substring(0, text.length-2);
    } else
      text += 'None';

    text += '```';

    return res.json(slackFormat(user, text));
  }, function() {
    console.log('No info exists for: ' + user);
    return res.json(slackFormat(user, 'No info exists for you'));
  });
}

function setInfo(user, text, res) {
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

  u.name = [first, last];

  // parse number

  // leading space
  if (number[0] === ' ')
    number = number.substring(1, number.length);

  // ensure number is digits only
  if (!(/^\d+$/.test(number))) {
    console.log('Invlaid number: ' + number);
    return res.json(slackFormat(user, number + Errors.INVALID_INFO_TEXT));
  }

  u.number = number;

  firebase.child('users').child(user).update(u);
  console.log('added ' + first + ' ' + last + ', ' + number + ' to ' + user);

  return res.json(slackFormat(user, 'Thank you for the info'));
}
module.exports = User;

