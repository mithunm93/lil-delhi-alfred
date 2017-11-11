import Errors from "./errors";
import secret from "./private";
import { slackFormat, formatOrder, formatError } from "./slack";
import { log, logErr } from "./lib/logger";
import { parse, intents, getOrderFromEntities } from "./lib/watson";

function verifyBody(req) {
  if (!req || !req.body || !req.body.text || !req.body.token || !req.body.user_name) return Errors.MALFORMED_REQUEST;
  // Ensure request came from meraki slack
  else if (req.body.token !== secret.slackSecret) return Errors.UNAUTHORIZED_ACCESS;
}

export default function command(req, res) {
  log("Received message from Meraki slack");

  const error = verifyBody(req);
  if (error) {
    logErr("Request verification failed", error);
    return res.json(formatError(error));
  }

  log("Sending text to watson", req.body.text);
  parse(req.body.text)
    .then(({ response, error }) => {

      if (error) return logErr("Watson message failed", error);

      log("Message received from watson", response);

      // choose the intent with the most confidence
      switch(response.intents.sort((a, b) => b.confidence - a.confidence)[0].intent) {
        case intents.ORDER:
          log(`${intents.ORDER} intent received`);
          // just returning the order for the time being
          const order = getOrderFromEntities(response.entities);
          if (order.error) {
            logErr(order.error);
            return res.json(formatError(order.error, req.body.user));
          }

          log("Message parsed from entities", {
            restaurant: order.restaurant.name,
            menuItems: order.menuItems.map(m => m.name),
            options: order.options,
          });
          return res.json(formatOrder(order, req.body.user));
        default:
          logErr("No matching intent received");
      }
    });
}
