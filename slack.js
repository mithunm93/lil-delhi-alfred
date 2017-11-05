import Errors from "./errors";
import request from "request";
import secret from "./private";

// Formats messages like so:
//  "@<user> <text>"
// usually used for returning messages to slack through res
export const slackFormat = (user, text) => {
  var t = "";
  if (user !== null)
    t += ("<@" + user + "> ");

  t += text;

  return { text: t };
}

const colors = {
  YELLOW: "warning",
  RED: "danger",
  GREEN: "good",
  BLUE: "#4141f4",
};

const calculatePrice = (menuItem, options = []) => [menuItem, ...options]
  .reduce((total, item) => {
    const price = parseInt(item.price, 10);
    return price ? total + price : total;
  }, 0);

const formatUser = user => (user ? `<@${user}> ` : "");

export const formatOrder = (order, user) => {
  const orderTotal = order.menuItems
    .reduce((total, m) => total + calculatePrice(m, order.options[m.name]), 0);
  return ({
    text: `${formatUser(user)}here is your order from *${order.restaurant.name}*`,
    attachments: [
      ...order.menuItems.map(m => ({
        color: colors.GREEN,
        title: m.name,
        text: m.description,
        fields: ((order.options[m.name] || []).length > 0 ? [{
          title: "Options",
          value: order.options[m.name].map(o => o.name).join(", "),
        }] : null),
        footer: `$${calculatePrice(m, order.options[m.name])}`,
        mrkdwn_in: ["pretext"],
      })),
      {
        title: "Total price",
        color: orderTotal < 25 ? colors.GREEN : colors.YELLOW,
        text: `$${orderTotal}`,
        footer: orderTotal > 25 ? "Your order exceeds the $25 limit, it may be removed if the budget is exceeded" : null,
      },
    ],
  });
};

export const formatError = (error, user) => ({
  attachments: [{
    color: colors.RED,
    pretext: `${formatUser(user)}there was a problem with your request`,
    title: error,
  }],
});

// POSTs messages to slack, this is the incoming webhook portion
// of the Slack API, the only place from which we initiate Slack
// messages, the majority of others are simply returned with the
// request from Slack.
export const send = (user, text) => {
  var t = Slack.prototype.slackFormat(user, text);
  // request.post(secret.slack, { body:JSON.stringify(t) });
  console.log("Posted to slack: " + t.text);
};

// Pings Slack to inform people that Alfie is taking orders, this
// is more of a reminder than a hard start for Alfie to start taking
// orders.
export const pingSlack = (req, res) => {
  if (req.body.token !== secret.slackSecret) {
    console.log("Request does not have proper secret");
    return res.json(Slack.prototype.slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  // since this method is only called at 1PM PST, no need to account for time zone (UTC is 7 hours ahead, same day)
  day = new Date().getDay()
  if ( day === 0 || day === 6) 
    return console.log("Don\"t ping on weekend");

  console.log("Taking orders now");
  Slack.prototype.send(null, "Taking orders now");
  return res.status(200).end();
}
