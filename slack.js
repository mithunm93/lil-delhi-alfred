var request = require('request');
var private = require('./private');

var Slack = {prototype:{}};

Slack.prototype.slackFormat = function(user, text) {
  var t = '';
  if (user !== null)
    t += ('<@' + user + '> ');

  t += text;

  return { text: t };
}
Slack.prototype.send = function(user, text) {
  request.post(private.slack_url, { body:JSON.stringify(Slack.prototype.slackFormat(user, text)) });
};

module.exports = Slack;
