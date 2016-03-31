var Order = require('./order.js');
var User = require('./user.js');

module.exports = function (req, res, next) {

  var text = req.body.text;
  if (!text) return res.status(500).end();
  text = text.toLowerCase();

  console.log('Message received: ' + text);

  var start = text.indexOf('"') +1;
  var message = text.substring(start, text.indexOf('"', start));

  if (text.indexOf('order') !== -1) {
    // check if order request

    // Format of order request should be like so:
    //
    //                                              alfred order "butter chicken(spicy), mango lassi, garlic naan"
    //                                                ^     ^             ^        ^   ^
    // 'alfred' slack trigger ________________________|     |             |        |   |
    // 'order' to indicate placing order ___________________|             |        |   |
    // name of food surrounded in quotes _________________________________|        |   |
    // optional spice level after name (defaults to mild on seamless) _____________|   |
    // comma separated ________________________________________________________________|

    Order.prototype.placeOrder(req.body.user_name, message);
  } else if (text.indexOf('name') !== -1) {
    // check if name set request

    // Format of name set should be like so:
    //
    //                                            alfred my name is "Mithun Manivannan"
    //                                                       ^         ^       ^
    // 'name' to indicate setting your name _________________|         |       |
    // first name _____________________________________________________|       |
    // last name ______________________________________________________________|

    User.prototype.setUser(req.body.user_name, message, res);
  }

  return res.status(200).end();
}
