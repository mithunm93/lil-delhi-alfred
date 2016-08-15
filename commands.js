var FirebaseHelper = require('./firebaseHelper.js');
var Slack = require('./slack.js');
var Errors = require('./errors');
var private = require('./private');
var Order = require('./order.js');
var User = require('./user.js');
var Alfie = require('./alfie.js');
var firebase = FirebaseHelper.prototype.ref;
var slackFormat = Slack.prototype.slackFormat;

function commands(args) {
  var req = args[0];
  var res = args[1];

  var text = req.body.text;
  var user = req.body.user_name;
  if (!text) return res.status(500).end();
  text = text.toLowerCase();

  console.log('Message received from ' + user + ': ' + text);

  // find message between double quotes of any kind
  var message = /["“”](.*?)["“”]/.exec(text);
  message = message ? message[1] : '';

  if (text.indexOf('order') !== -1) {
    // check if order request

    if (text.indexOf('forget') !== -1) {
      // are they asking Alfie to forget?

      // Format order forget request should be like so:
      //
      //                                    alfred forget order
      //                                             ^     ^
      // indicating intent to forget ________________|     |
      // specifying we want to forget order _______________|

      Order.prototype.forgetOrder(user, res);
    } else {
      // Format of order request should be like so:
      //
      //                                              alfred order "butter chicken(spicy), mango lassi, garlic naan"
      //                                                ^     ^             ^        ^   ^
      // 'alfred' slack trigger ________________________|     |             |        |   |
      // 'order' to indicate placing order ___________________|             |        |   |
      // name of food surrounded in quotes _________________________________|        |   |
      // optional spice level after name (defaults to mild on seamless) _____________|   |
      // comma separated ________________________________________________________________|

      FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(){
        Order.prototype.placeOrder(user, message, res);
      }, function() {noUserInfoWarning(user, res)});
    }
  } else if (text.indexOf('info') !== -1 || text.indexOf('who dis') !== -1) {
    // check if info set request

    if (text.indexOf('forget') !== -1) {
      // are they asking Alfie to forget?

      // Format order forget request should be like so:
      //
      //                                    alfred forget info
      //                                             ^     ^
      // indicating intent to forget ________________|     |
      // specifying we want to forget info ________________|

      User.prototype.forgetInfo(user, res);
    } else {
      // Format of info set should be like so:
      //
      //                                            alfred my info is "John Smith, 0123456789"
      //                                                       ^         ^    ^  ^     ^
      // 'name' to indicate setting your name _________________|         |    |  |     |
      // first name _____________________________________________________|    |  |     |
      // last name ___________________________________________________________|  |     |
      // comma separated ________________________________________________________|     |
      // strictly numeric phone number ________________________________________________|
      //
      //
      // ____________________ OR __________________________
      //
      // If nothing is specified in quotes, return the user's stored info

      User.prototype.userInfo(user, message, res);
    }
  } else if (text.indexOf('stats') !== -1) {
    // get stats for the user

    FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(){
      if (text.indexOf('full') !== -1) {
        // Format of full stats request should be like so:
        //
        //                                     alfred full stats
        //                                             ^    ^
        // 'full' to indicate overall stats request ___|    |
        // 'stats' to inidcate stats request _______________|
        User.prototype.userStats(null, res);
      } else {
        // Format of stats request should be like so:
        //
        //                                     alfred stats
        //                                             ^
        // 'stats' to inidcate stats request __________|
        User.prototype.userStats(user, res);
      }
    }, function() {noUserInfoWarning(user, res)});
  } else if (text.indexOf('favorite') !== -1) {
    // check if favorite set request

    // Format of favorite request should be like so:
    //
    //                                       alfred set favorite "butter chicken(spicy), mango lassi, garlic naan"
    //                                                      ^             ^        ^   ^
    //                                                      |             |        |   |
    // 'favorite' to indicate setting favorite _____________|             |        |   |
    // name of food surrounded in quotes _________________________________|        |   |
    // optional spice level after name (defaults to mild on seamless) _____________|   |
    // comma separated ________________________________________________________________|
    //
    //
    // ____________________ OR __________________________
    //
    // If nothing is specified in quotes, return the user's stored favorite

    FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(){
      Order.prototype.setFavorite(user, message, res);
    }, function() {noUserInfoWarning(user, res)});
  } else if (text.indexOf('list') !== -1) {
    // check if list request

    // Format of list request should be like so:
    //
    //                                     alfred list
    //                                             ^
    // 'list' to inidcate list request ____________|

    Order.prototype.list(res);
  } else if (text.indexOf('help') !== -1) {
    // chek if requesting help

    // Format of list request should be like so:
    //
    //                                     alfred help
    //                                             ^
    // 'help' to inidcate list request ____________|

    User.prototype.help(res);
  } else if (text.indexOf('status') !== -1) {
    // show the current status of the order

    // Format of status request should be like so:
    //
    //                                     alfred status
    //                                              ^
    // 'status' to indicate status request _________|

    FirebaseHelper.prototype.checkInfoExistsThenRun(user, function(){
      Order.prototype.status(user, res);
    }, function() {noUserInfoWarning(user, res)});
  } else if (text.indexOf('forget') !== -1) {
    // are they asking Alfie to forget the order?
    // this would be easier than typing out "alfie forget order" every
    //   time they want to cancel an order

    // Format order forget request should be like so:
    //
    //                                    alfred forget
    //                                             ^
    // indicating intent to forget order __________|

    Order.prototype.forgetOrder(user, res);
  } else if (text.indexOf('thank') !== -1) {
    // respond to thanking alfie

    // Format of thanking should be like so:
    //
    //                                    alfred thanks
    //                                             ^
    // indicating intent to thank alfie ___________|

    Alfie.prototype.thank(user, res);
  }else {
    // no valid terms were used

    return res.json(slackFormat(user, Errors.INVALID_COMMAND_TEXT));
  }
}

function noUserInfoWarning(user, res) {
  console.log('No info for: ' + user);
  return res.json(slackFormat(user, Errors.NO_INFO_TEXT));
}

module.exports = function (req, res) {
  // Ensure request came from #ot-lil-delhi
  if (req.body.token !== private.slackSecret) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  console.log("Received message from #ot-lil-delhi");

  FirebaseHelper.prototype.authThenRun(commands, req, res);
}
