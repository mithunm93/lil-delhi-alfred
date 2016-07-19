var Errors = require('./errors');
var request = require('request');
var private = require('./private');

var Slack = {prototype:{}};

// Formats messages like so:
//  "@<user> <text>"
// usually used for returning messages to slack through res
Slack.prototype.slackFormat = function(user, text) {
  var t = '';
  if (user !== null)
    t += ('<@' + user + '> ');

  t += text;

  return { text: t };
}

// POSTs messages to slack, this is the incoming webhook portion
// of the Slack API, the only place from which we initiate Slack
// messages, the majority of others are simply returned with the
// request from Slack.
Slack.prototype.send = function(user, text) {
  var t = Slack.prototype.slackFormat(user, text);
  request.post(private.slack, { body:JSON.stringify(t) });
  console.log('Posted to slack: ' + t.text);
};

// Pings Slack to inform people that Alfie is taking orders, this
// is more of a reminder than a hard start for Alfie to start taking
// orders.
Slack.prototype.pingSlack = function(req, res) {
  if (req.body.token !== private.slackSecret) {
    console.log("Request does not have proper secret");
    return res.json(Slack.prototype.slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  // since this method is only called at 1PM PST, no need to account for time zone (UTC is 7 hours ahead, same day)
  day = new Date().getDay()
  if ( day === 0 || day === 6) 
    return console.log('Don\'t ping on weekend');

  console.log('Taking orders now');
  Slack.prototype.send(null, 'Taking orders now');
  return res.status(200).end();
}

module.exports = Slack;
