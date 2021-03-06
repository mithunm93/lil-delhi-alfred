// TODO: account for DST
import _ from "underscore";
import moment from "moment";
import {
  ref,
  authThenRun,
  getUserInfo,
  readTodaysOrders,
  writeFirebaseRead,
  writeFirebaseOrder,
  writeFirebaseFavorite,
  removeFirebaseOrder,
  checkOrderNotPlacedThenRun,
  checkOrderExistsThenRun,
  checkFavoriteExistsThenRun,
} from "./firebaseHelper";
import { send, slackFormat } from "./slack";
import Errors from "./errors";
import LittleDelhi from "./littleDelhi";
import * as User from "./user";
import secret from "./private";

// This method is used by Casper, to post to Slack the status
// of its order placement.
export const orderComplete = (req, res) => {
  // TODO: make a routes table similar to commands
  if (!(req.body && req.body.token === secret.slackSecret)) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  if (req.body.success === "true") {
    console.log("Received successful completion message from Casper!");
    send(null, "Order placed successfully by Casper");
  } else {
    console.log("Received order unsuccessful message from Casper");
    send(null, "Something went wrong in Casper\'s ordering process");
  }
};

// This method is used by Casper, the expected return structure is this:
//   { users: [["first", "last"], ["first1", "last1"], ...],
//     number: "0123456789,
//     items: [{"item1": true}, {"item2": {"spice": "spicy"}}, ... ] }
//
// This exact format is required because Casper is very dumb, and will fail
// silently on pretty much any hiccup.
export const readTodaysFirebaseOrders = (req, res) => {
  // TODO: make a routes table similar to commands, for GETs
  if (!(req.headers && req.headers.token === secret.slackSecret)) {
    console.log("Request does not have proper secret");
    return res.json(slackFormat(null, Errors.UNAUTHORIZED_ACCESS));
  }

  console.log("Received request to get order from authorized sender");
  authThenRun(prepareMessageForCasper, res);
};

// Writes to Firebase the order placed by user formatted like so:
// users : { $user : { order : [$order1, $order2, ...] } }
//
// Repeated calls from the same user on the same day will overwrite
export const placeOrder = (user, uOrder, res) => {
  checkOrderNotPlacedThenRun(
    () => {
      // placing favorite
      if (uOrder === "") {
        checkFavoriteExistsThenRun(user, (args) => {
          console.log(`Favorite received for: ${user}`);
          const favorite = args[0];
          writeFirebaseOrder(user, favorite);
          return res.json(slackFormat(user, orderPlacedMessage(favorite)));
        }, () => {
          console.log(`No favorite for: ${user}`);
          return res.json(slackFormat(user, Errors.NO_FAVORITE_TEXT));
        });
      } else {
        // TODO: better way to return if null
        const fOrder = userToFirebaseFormat(user, uOrder, res);
        if (fOrder) {
          writeFirebaseOrder(user, fOrder);
          res.json(slackFormat(user, orderPlacedMessage(fOrder)));
        }
      }
    },
    () => res.json(slackFormat(user, Errors.ORDER_ALREADY_PLACED_TEXT)),  // order already placed for today
  );
};

// Sets a user's favorite in firebase, this allows the user to simply
// use "alfred order" to place an order as opposed to typing out their
// entire order every time.
export const setFavorite = (user, uOrder, res) => {
  const fOrder = userToFirebaseFormat(user, uOrder, res);
  if (fOrder) {
    writeFirebaseFavorite(user, fOrder);
    res.json(slackFormat(user, "Your favorite has been set"));
  }
};

// Show list of available items
export const list = (res) => {
  let text = "Here are the list of accepted items: ```";
  for (let item in LittleDelhi) {
    if (item !== "spices" && item !== "reversed")
    text += (item + "\n");
  }

  text += "\nSpice levels:\n "
  for (let s in LittleDelhi.spices) text += (s + "\n");

  text += "```";

  console.log("Printing full list");
  return res.json(slackFormat(null, text));
};

// Show current order status, including items and total price.
// This is also the message that is shown wheen a user first places
// their order.
export const status = (user, res) => {
  readTodaysOrders((args) => {
    const fOrders = args[0];
    if (!fOrders || !fOrders[user])
      return res.json(slackFormat(user, Errors.NO_ORDER_TEXT));
    else
      return res.json(slackFormat(user, orderPlacedMessage(fOrders[user].order)));
  });
};

// Forget the user's order from today
export const forgetOrder = (user, res) => {
  checkOrderExistsThenRun(user,
    () => {
      // order exsits, we need to delete it
      removeFirebaseOrder(user, (error) => {
        if (error)
          return res.json(slackFormat(user, "Something went wrong when trying to remove your order"));
        else
          return res.json(slackFormat(user, "Your order has been removed"));
      });
    },
    () => res.json(slackFormat(user, Errors.NO_ORDER_TEXT)), // order doesn't exist
  );
};
// ______________________HELPER METHODS_______________________________

// formats the order from this:
// [{"Paneer Makhani" : { spice: "Spicy" }}, {"Naan" : true}]     (Firebase Format)
//       to this:
// [["Paneer Makhani", "Spicy"], ["Naan", false]]
const firebaseToArrayFormat = fOrder => fOrder.map(
  (item) => {
    name = Object.keys(item)[0];
    spice = item[name]["spice"] || false;
    return [name, spice];
  },
);

// Returns the total cost of all the items in the order
const totalPrice = (fOrder) => {
  // format for easy use
  aOrder = firebaseToArrayFormat(fOrder);

  price = 0;
  aOrder.forEach(
    order => price += LittleDelhi["reversed"][order[0]]["price"],
  );

  return price;
};

// Creates the message that tells users what they have ordered
const orderPlacedMessage = (fOrder) => {
  let text = "You have ordered ";

  // format for easy use
  aOrder = firebaseToArrayFormat(fOrder);

  // if more than one item, make a list
  for (var i = 0; i < aOrder.length -1; i++) {
    text += aOrder[i][0];
    if (aOrder[i][1])
      text += "(" + aOrder[i][1] + ")";
    text += ", ";
  }

  if (aOrder.length > 1)
    text += "and ";

  text += _.last(aOrder)[0]
  if (_.last(aOrder)[1])
    text += "(" +  _.last(aOrder)[1] + ")";

  text += ". $" + totalPrice(fOrder).toFixed(2) + " is your order total.";
  return text;
};

// Converts the order from human readable:
// alfred order "paneer makhani (spicy), naan"
//      to Firebase format:
// [{"Paneer Makhani" : { spice: "Spicy" }}, {"Naan" : true}]
const userToFirebaseFormat = (user, uOrder, res) => {
  uOrder = uOrder.split(",");
  const toReturn = [];
  const invalidMessages = [];

  for (let item of uOrder) {
    // leading space
    if (item[0] === " ") item = item.substring(1, item.length);

    let spice = "";
    let name = item;
    var j = item.indexOf("(");

    // spice level
    if (j !== -1) {
      spice = item.substring(j+1, item.indexOf(")"));
      name = item.substring(0,j);
      // trailing space before ()
      if (name[name.length-1] === " ")
        name = name.substring(0, name.length-1);
    }

    if (itemExists(name)) {
      const hasSpice = itemHasSpiceOptions(name);
      let value = "";

      // We tell the user if they entered an item with a spice level when
      // that item actually doesn't have a spice level. We still place the
      // order, and the user knows this because "toReturn" is parsed back
      // into Firebase terminology and returned to slack after this method.
      if (hasSpice && spice !== "" && spiceExists(spice))
        value = { spice: LittleDelhi.spices[spice] };
      else {
        if (spice !== "" && !hasSpice)
          invalidMessages.push(name + Errors.NO_SPICE_OPTION_TEXT);
        else if (spice !== "" && !spiceExists(spice))
          invalidMessages.push(spice + Errors.INVALID_SPICE_OPTION_TEXT);
        value = true;
      }
      toReturn.push({ [LittleDelhi[name].name]: value });
    } else {
      console.log(`Invalid item: ${name}`);
      res.json(slackFormat(user, name + Errors.INVALID_ORDER_TEXT));
      return;
    }
  }

  // inform the user of any errors with their order
  if (invalidMessages.length !== 0)
    send(user, invalidMessages.join(", "));

  return toReturn;
};

// This method picks a random phone number from the people that have placed
// an order and returns it. It is used for picking a person to receive the
// call for picking up the delivery.
const pickRandomNumberFromOrder = (fOrder, userInfo) => {
  var names = Object.keys(fOrder);
  var i = Math.floor(Math.random() * names.length);

  send(names[i], "You will receive the call to pick up the order");
  console.log(`${names[i]} will receive the call for the order`);

  return userInfo[names[i]].number;
};

// This method reads the orders from today and gets the user info from Firebase
// to prepare them to send to Casper.
const prepareMessageForCasper = (args) => {
  const res = args[0];
  const toReturn = { users: [], number: "", items: [] }

  readTodaysOrders((args) => {
    var fOrders = args[0];
    if (!fOrders) {
      writeFirebaseRead();
      return res.json(toReturn);
    }

    getUserInfo((args) => {
      var userInfo = args[0];

      console.log(Object.keys(fOrders).length + " orders received");

      // o is the "user_name" in the data structured like this:
      //   user_name : [ {order1: true}, {order2: {spice: "spicy"}}, ... ]
      for (let o in fOrders) {
        if (!userInfo[o]) {
          console.log(o + " has no information stored! Skipping their order");
          delete fOrders[o];
          continue;
        }

        // I'm the main acccount, don't add me again!
        if (o !== secret.selfUser)
          toReturn.users.push(userInfo[o].name);

        // i is an object structered like this:
        //   { order1: true }
        //         OR
        //   { order2: {spice: "spicy"}}
        for (i of fOrders[o].order)
          toReturn.items.push(i);
      }

      var newItems = fillOrders(toReturn.items);
      toReturn.items = toReturn.items.concat(newItems);

      toReturn.number = pickRandomNumberFromOrder(fOrders, userInfo);

      writeFirebaseRead();

      console.log(JSON.stringify(toReturn));
      return res.json(toReturn);
    });
  });
}

// Creates the text for new items added to the order
function newItemsText(newItems) {
  var text = "The minimum of $20 was not met, so these items were added: ";

  itemsText = _.map(firebaseToArrayFormat(newItems), _.first).join(", ");

  return (text + itemsText);
}

// If the total price is below $17, automatically fill with samosas and
// mango lassis until we hit that price, because the order can't be placed
// below that. $20 is the limit, but $17 with tax and tip comes up to $20.
function fillOrders(items) {
  var price = totalPrice(items);
  var newItems = [];

  while (price < 17) {
    var name = (Math.random() >= .33) ? "Samosa" : "Mango Lassi";
    var item = {}
    item[name] = true;
    newItems.push(item);
    price += LittleDelhi["reversed"][name]["price"];
  }

  if (newItems.length > 0)
    send("here", newItemsText(newItems));

  return newItems;
}

// Checks to see if an item exists in the JSON file
const itemExists = item => LittleDelhi[item] !== undefined;

// Checks to see if the item exists and has spice options
const itemHasSpiceOptions = item =>
  itemExists(item) && (LittleDelhi[item]["spiceOptions"] === true);

// checks to see if the spice given is valid
const spiceExists = spice => LittleDelhi.spices[spice] !== undefined;
