var request = require('request');
var private = require('./private');

var Slack = {prototype:{}};

Slack.prototype.send = function(text, user) {
  var t = '';
  if (user !== null)
    t += ('<@' + user + '> ');

  t += text;
  request.post(private.slack_url, { body:JSON.stringify({text: t}) });
};

module.exports = Slack;
