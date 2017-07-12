import * as FirebaseHelper from "./firebaseHelper";
import * as Slack from "./slack";
import Errors from "./errors";
import secret from "./private";
import * as Order from "./order";
import * as User from "./user";
import * as Alfie from "./alfie";
const firebase = FirebaseHelper.ref;
const slackFormat = Slack.slackFormat;

const commands = (args) => {
  const req = args[0];
  const res = args[1];

  let text = req.body.text;
  const user = req.body.user_name;
  if (!text) return res.status(500).end();
  text = text.toLowerCase();

  console.log(`Message received from ${user}: ${text}`);

  // find message between double quotes of any kind
  let message = /["“”](.*?)["“”]/.exec(text);
  message = message ? message[1] : "";

  if (text.indexOf("order") !== -1) {
    // check if order request

    if (text.indexOf("forget") !== -1) {
      // are they asking Alfie to forget?

      // Format order forget request should be like so:
      //
      //                                    alfred forget order
      //                                             ^     ^
      // indicating intent to forget ________________|     |
      // specifying we want to forget order _______________|

      Order.forgetOrder(user, res);
    } else {
      // Format of order request should be like so:
      //
      //                                              alfred order "butter chicken(spicy), mango lassi, garlic naan"
      //                                                ^     ^             ^        ^   ^
      // "alfred" slack trigger ________________________|     |             |        |   |
      // "order" to indicate placing order ___________________|             |        |   |
      // name of food surrounded in quotes _________________________________|        |   |
      // optional spice level after name (defaults to mild on seamless) _____________|   |
      // comma separated ________________________________________________________________|

      FirebaseHelper.checkInfoExistsThenRun(
        user,
        () => Order.placeOrder(user, message, res),
        () => noUserInfoWarning(user, res),
      );
    }
  } else if (text.indexOf("info") !== -1 || text.indexOf("who dis") !== -1) {
    // check if info set request

    if (text.indexOf("forget") !== -1) {
      // are they asking Alfie to forget?

      // Format order forget request should be like so:
      //
      //                                    alfred forget info
      //                                             ^     ^
      // indicating intent to forget ________________|     |
      // specifying we want to forget info ________________|

      User.forgetInfo(user, res);
    } else {
      // Format of info set should be like so:
      //
      //                                            alfred my info is "John Smith, 0123456789"
      //                                                       ^         ^    ^  ^     ^
      // "name" to indicate setting your name _________________|         |    |  |     |
      // first name _____________________________________________________|    |  |     |
      // last name ___________________________________________________________|  |     |
      // comma separated ________________________________________________________|     |
      // strictly numeric phone number ________________________________________________|
      //
      //
      // ____________________ OR __________________________
      //
      // If nothing is specified in quotes, return the user's stored info

      User.userInfo(user, message, res);
    }
  } else if (text.indexOf("stats") !== -1) {
    // get stats for the user

    FirebaseHelper.checkInfoExistsThenRun(user, () => {
      if (text.indexOf("full") !== -1) {
        // Format of full stats request should be like so:
        //
        //                                     alfred full stats
        //                                             ^    ^
        // "full" to indicate overall stats request ___|    |
        // "stats" to inidcate stats request _______________|
        User.userStats(null, res);
      } else {
        // Format of stats request should be like so:
        //
        //                                     alfred stats
        //                                             ^
        // "stats" to inidcate stats request __________|
        User.userStats(user, res);
      }
    }, () => noUserInfoWarning(user, res));
  } else if (text.indexOf("favorite") !== -1) {
    // check if favorite set request

    // Format of favorite request should be like so:
    //
    //                                       alfred set favorite "butter chicken(spicy), mango lassi, garlic naan"
    //                                                      ^             ^        ^   ^
    //                                                      |             |        |   |
    // "favorite" to indicate setting favorite _____________|             |        |   |
    // name of food surrounded in quotes _________________________________|        |   |
    // optional spice level after name (defaults to mild on seamless) _____________|   |
    // comma separated ________________________________________________________________|
    //
    //
    // ____________________ OR __________________________
    //
    // If nothing is specified in quotes, return the user's stored favorite

    FirebaseHelper.checkInfoExistsThenRun(
      user,
      () => Order.setFavorite(user, message, res),
      () => noUserInfoWarning(user, res),
    );
  } else if (text.indexOf("list") !== -1) {
    // check if list request

    // Format of list request should be like so:
    //
    //                                     alfred list
    //                                             ^
    // "list" to inidcate list request ____________|

    Order.list(res);
  } else if (text.indexOf("help") !== -1) {
    // chek if requesting help

    if (text.indexOf("full") !== -1) {
      // Format of list request should be like so:
      //
      //                                     alfred help
      //                                             ^
      // "help" to inidcate list request ____________|

      Alfie.fullHelp(res);
    } else {
      Alfie.shortHelp(res);
    }
  } else if (text.indexOf("status") !== -1) {
    // show the current status of the order

    // Format of status request should be like so:
    //
    //                                     alfred status
    //                                              ^
    // "status" to indicate status request _________|

    FirebaseHelper.checkInfoExistsThenRun(
      user,
      () => Order.status(user, res),
      () => noUserInfoWarning(user, res),
    );
  } else if (text.indexOf("forget") !== -1) {
    // are they asking Alfie to forget the order?
    // this would be easier than typing out "alfie forget order" every
    //   time they want to cancel an order

    // Format order forget request should be like so:
    //
    //                                    alfred forget
    //                                             ^
    // indicating intent to forget order __________|

    Order.forgetOrder(user, res);
  } else if (text.indexOf("thank") !== -1) {
    // respond to thanking alfie

    // Format of thanking should be like so:
    //
    //                                    alfred thanks
    //                                             ^
    // indicating intent to thank alfie ___________|

    Alfie.thank(user, res);
  }else {
    // no valid terms were used

    return res.json(slackFormat(user, Errors.INVALID_COMMAND_TEXT));
  }
};

const noUserInfoWarning = (user, res) => {
  console.log(`No info for: ${user}`);
  return res.json(slackFormat(user, Errors.NO_INFO_TEXT));
};

const commandsInit = (req, res) => {
  // Ensure request came from #ot-lil-delhi
  if (req.body.token !== secret.slackSecret) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  console.log("Received message from #ot-lil-delhi");

  FirebaseHelper.auth(commands, req, res);
};

export default commandsInit;
