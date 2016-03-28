var Order = require('./order.js');

module.exports = function (req, res, next) {

  var text = req.body.text;
  if (!text) return res.status(500).end();
  text = text.toLowerCase();
  var i;

  console.log('Message received: ' + text);

  // check if order request
  i = text.indexOf('order');
  if (i > -1) {

    // Format of order request should be like so:
    //
    //                                              alfred order "butter chicken(spicy), mango lassi, garlic naan"
    //                                                ^     ^             ^        ^   ^
    // 'alfred' slack trigger ________________________|     |             |        |   |
    // 'order' to indicate placing order ___________________|             |        |   |
    // name of food surrounded in quotes _________________________________|        |   |
    // optional spice level after name (defaults to mild on seamless) _____________|   |
    // comma separated ________________________________________________________________|
    //

    var start = text.indexOf('"') +1;
    var order = text.substring(start, text.indexOf('"', start));
    Order.prototype.placeOrder(req.body.user_name, order);

    return res.status(200).end();
  }
}
