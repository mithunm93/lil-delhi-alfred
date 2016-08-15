var Slack = require('./slack.js');
var Help = require('./help');
var slackFormat = Slack.prototype.slackFormat;

var Alfie = {prototype: {}};

Alfie.prototype.thank = function(user, res) {
  return res.json(slackFormat(user, "you're welcome"));
}

// Assembles the help message
Alfie.prototype.help = function(res) {
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
module.exports = Alfie;
