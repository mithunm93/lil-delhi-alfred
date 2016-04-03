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
  var t = Slack.prototype.slackFormat(user, text);
  request.post(private.slack, { body:JSON.stringify(t) });
  console.log('Posted to slack: ' + t.text);
};

module.exports = Slack;
