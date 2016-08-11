var _ = require('underscore');
var FirebaseHelper = require('./firebaseHelper.js');
var Errors = require('./errors');
var Slack = require('./slack.js');
var Help = require('./help');

var User = {prototype: {}};
var firebase = FirebaseHelper.prototype.ref;
var slackFormat = Slack.prototype.slackFormat;

// used for "alfred info"
User.prototype.userInfo = function(user, text, res) {
  if (text === '')
    showInfo(user, res);
  else
    setInfo(user, text, res);
};

// Removes the user's info from Firebase, including their favorite
User.prototype.forgetInfo = function(user, res) {
  FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(args) {
    FirebaseHelper.prototype.removeFirebaseUser(user, function(error) {
      if (error) {
        console.log("ERROR forgetting user info: " + error);
        return res.json(slackFormat(user, "Something went wrong when trying to remove your info"));
      } else {
        console.log("User " + user + "'s information has been removed'");
        return res.json(slackFormat(user, "Your info has been removed"));
      }
    });
  }, function() {
    console.log('No info exists for: ' + user);
    return res.json(slackFormat(user, 'No info exists for you'));
  });
}

// Assembles the help message
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

// Shows the user's info, including name, number, and favorite
// The user needs to have first created a profile with Alfred to
// be able to access their information, otherwise they need to
// setInfo
function showInfo(user, res) {
  FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(args) {
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

// Sets the user's info including name and number
// Both of these values must be specified when setting the info
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

  FirebaseHelper.prototype.writeFirebaseUser(user, u);

  return res.json(slackFormat(user, 'Thank you for the info'));
}
module.exports = User;

