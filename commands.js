module.exports = function (req, res, next) {
  var Order = require('./order.js');

  var text = req.body.text;
  if (!text) return;
  text = text.toLowerCase();
  var i;

  console.log('Message received: ' + text);

  // check if sale check request
  i = text.indexOf('sale');
  if (i > -1) {
    // TODO: need to do error handling
    // TODO: this quotes stuff should really be in another function

    var fancyStart = text.indexOf('“');
    var start = fancyStart == -1 ? text.indexOf('"') : fancyStart;

    if (start++ == -1) {
      console.log('Message format not recognized, the character " was not found at the start of the sale message');
      return;
    }

    var fancyEnd = text.indexOf('”',start);
    var end = fancyEnd == -1 ? text.indexOf('"',start) : fancyEnd;

    if (end == -1) {
      console.log('Message format not recognized, the character " was not found at the end of the sale message');
      return;
    }

    // 'sale' shouldn't be part of the game title
    if (i < start || i > end) {
      new Sales().add(req.body.user_name, text.substring(start, end));
      return res.status(200).end();
    }
  }
}
