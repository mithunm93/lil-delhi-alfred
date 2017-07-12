import _ from "underscore";
import secret from "./private";
import moment from "moment";
import Firebase from "firebase";
import FirebaseTokenGenerator from "firebase-token-generator";

const tokenGenerator = new FirebaseTokenGenerator(secret.firebaseSecret);
const ALREADY_PLACED_TEXT = "already_placed"

// The reference to Alfie's Firebase
export const ref = new Firebase(secret.firebase);

// Generates a new token for authentication with Firebase
const getNewToken = () => tokenGenerator.createToken({uid: "lil-delhi-alfred"});

export const failureCallback = (error) => {
  // TODO: properly return a failure message
  if (error) console.log(`${error.code}: ${error.message}`);
};

// provide a callback function as first argument
//   and any arguments for that callback funciton as the succeeding ones
//
// TODO: make these FirebaseHelper calls more succinct
export const auth = (callback, req, res) => {
  const authData = ref.getAuth();
  if (authData) return callback([req, res]);

  return ref.authWithCustomToken(
    getNewToken(),
    (error, authData) => {
      if (error) failureCallback(error);
      console.log("Login Succeeded!", authData);
      return callback([req, res]);
    },
  );
};


// ----------------------- USER HLPERS --------------------------------


// Checks to see if they user has info stored then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
export const checkInfoExistsThenRun = (user, success, failure) => {
  ref.child("users").child(user).once("value", (snapshot) => {
    var info = snapshot.val();
    if (info) {
      console.log("User info exists for: " + user);
      return success([info]);
    } else
      return failure([]);
  });
}

// Checks to see if they user has info stored then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
export const checkFavoriteExistsThenRun = (user, success, failure) => {
  ref.child("users").child(user).child("favorite").once("value", (snapshot) => {
    var favorite = snapshot.val();
    if (favorite) {
      console.log("User favorite exists for: " + user);
      return successCallback([favorite]);
    } else
      return failureCallback([]);
  });
}

// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, userInfo])
export const getUserInfo = (callback) => {
  console.log("getting user info");
  ref.child("users").once("value", (snapshot) => {

    var userInfo = snapshot.val();
    callback([userInfo]);
  }, failureCallback);
}

export const writeFirebaseUser = (user, info) => {
  ref.child("users").child(user).update(info);
  console.log("added " + user + ": " + info.name + ", " + info.number);
}

// Removes the user's info, including favorite
export const removeFirebaseUser = (user, callback) => {
  ref.child("users").child(user).remove(callback);
}
// --------------------- ORDER HELPERS --------------------------------

// Checks to see if the order has already been handed off to Casper for today
//   FIRST argument must be success callback (order not placed)
//   SECOND argument must be failure callback
export const checkOrderNotPlacedThenRun = (success, failure) => {
  readTodaysOrders((args) => {
    var orders = args[0];

    if (!orders || orders[ALREADY_PLACED_TEXT] === undefined) {
      console.log("Order not yet placed today");
      return success();
    } else {
      console.log("Order already placed today");
      return failure();
    }
  });
}

// Write into Firebase that today's orders have already been placed
export const writeFirebaseRead = () => {
  var date = moment().utcOffset("-07:00").format("MM-DD-YYYY");
  var writeTo = ref.child("orders").child(date);
  var entry = {}
  entry[ALREADY_PLACED_TEXT] = true

  writeTo.update(entry, failureCallback);
  console.log("Firebase write triggered for today\'s orders placed");
}

// Checks to see if the user has placed an order today then executes the callback
//   FIRST argument must be user to check
//   SECOND argument must be success callback
//   THIRD argument must be failure callback
export const checkOrderExistsThenRun = (user, success, failure) => {
  ref.child("orders")
    .child(moment().utcOffset("-07:00").format("MM-DD-YYYY"))
    .child(user).once("value", (snapshot) => {
    if (snapshot.exists()) {
      console.log("order exists for: " + user);
      return success([snapshot.val()]);
    } else
      console.log("No order for: " + user);
      return failureCallback([]);
  });
}

// Removes the order that the user has placed today
export const removeFirebaseOrder = (user, callback) => {
  ref.child("orders")
    .child(moment().utcOffset("-07:00").format("MM-DD-YYYY"))
    .child(user).remove(callback);
}
// Writes the order to Firebase on today's date, under the user's name
export const writeFirebaseOrder = (user, order) => {
  var date = moment().utcOffset("-07:00").format("MM-DD-YYYY");
  var writeTo = ref.child("orders").child(date).child(user);
  var entry = { order: order };

  writeTo.update(entry, failureCallback);
  console.log("Firebase write triggered for " + user + "'s order");
}

// Writes the user's favorite into Firebase
export const writeFirebaseFavorite = (user, order) => {
  var writeTo = ref.child("users").child(user);
  var entry = { favorite: order };

  writeTo.update(entry, failureCallback);
  console.log("Firebase write triggered for " + user + "s favorite");
}

// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, orders])
export const readTodaysOrders = (callback) => {
  console.log("reading today\'s orders");
  ref.child("orders")
    .child(moment().utcOffset("-07:00").format("MM-DD-YYYY"))
    .once("value", (snapshot) => {

      var orders = snapshot.val();
      callback([orders]);
  }, failureCallback);
}

// Read all the orders in Firebase
//
// provide a callback as the first argument that takes arguments like this:
//
//   functionCallback(arguments[1-last, orders])
export const readAllOrders = (callback) => {
  console.log("reading all orders");
  ref.child("orders")
    .once("value", (snapshot) => {

      var orders = snapshot.val();
      callback([orders]);
  }, failureCallback);
}

