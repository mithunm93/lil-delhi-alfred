var Slack = require('./slack.js');
var slackFormat = Slack.prototype.slackFormat;

var Alfie = {prototype: {}};

Alfie.prototype.thank = function(user, res) {
  return res.json(slackFormat(user, "you're welcome"));
}

module.exports = Alfie;
