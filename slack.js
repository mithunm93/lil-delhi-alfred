var Errors = require('./errors');
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

Slack.prototype.pingSlack = function(req, res) {
  if (req.body.token !== private.slackSecret) {
    console.log("Request does not have proper secret");
    return res.json(Slack.prototype.slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  console.log('Taking orders now');
  Slack.prototype.send(null, 'Taking orders now');
  return res.status(200).end();
}

module.exports = Slack;
