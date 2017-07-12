import * as Slack from "./slack.js";
import Help from "./help";
const slackFormat = Slack.slackFormat;

export const thank = (user, res) => {
  return res.json(slackFormat(user, "you're welcome"));
}

// Assembles the full help message
export const fullHelp = (res) => {
  var text = Help.alfred;
  text += Help.enterInfo;
  text += Help.placeOrder;
  text += Help.orderFinished;
  text += Help.orderCompletion;
  text += Help.extraActions;
  text += Help.favorite;
  text += Help.list;
  text += Help.forget;
  text += Help.status;
  text += Help.stats;
  text += Help.showInfo;
  text += Help.orderFavorite;
  text += Help.thank;
  text += Help.help;

  console.log('Printed full help text');
  return res.json(slackFormat(null, text));
}

// Assemble the short help message
export const shortHelp = (res) => {
  var text = Help.shortHelp;
  text += Help.shortOrder;
  text += Help.shortFavorite;
  text += Help.shortList;
  text += Help.shortForget;
  text += Help.shortStatus;
  text += Help.shortInfo;

  console.log('Printed short help text');
  return res.json(slackFormat(null, text));
}
