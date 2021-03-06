import _ from "underscore";
import * as FirebaseHelper from "./firebaseHelper.js";
import Errors from "./errors";
import * as Slack from "./slack.js";
import LittleDelhi from "./littleDelhi";

const firebase = FirebaseHelper.ref;
const slackFormat = Slack.slackFormat;
const FILTER_BY_ITEMS = ['Naan', 'Garlic Naan', 'Rice Pillau', 'Samosa', 'Mango Lassi'];

// used for "alfred info"
export const userInfo = (user, text, res) =>
  (text === '') ? showInfo(user, res) : setInfo(user, text, res);

// Removes the user's info from Firebase, including their favorite
export const forgetInfo = (user, res) => {
  FirebaseHelper.checkInfoExistsThenRun(user, (args) => {
    FirebaseHelper.removeFirebaseUser(user, (error) => {
      if (error) {
        console.log("ERROR forgetting user info: " + error);
        return res.json(slackFormat(user, "Something went wrong when trying to remove your info"));
      } else {
        console.log("User " + user + "'s information has been removed'");
        return res.json(slackFormat(user, "Your info has been removed"));
      }
    });
  }, () => {
    console.log('No info exists for: ' + user);
    return res.json(slackFormat(user, 'No info exists for you'));
  });
}

// Get user stats:
//
// Overall:
// Top 3 items ordered
// Total money spent
// Top 3 orderers
//
// User:
// Top 3 items ordered
// Total money spent
// Ranking amoung peers in total money spent
export const userStats = (user, res) => {
  FirebaseHelper.readAllOrders((args) => {
    var orders = args[0];

    // get overall stats
    var overallItemFrequency = {};
    var overallMoneySpent = 0;

    var userStats = {};

    var name;
    // assemble the food frequency
    for (let day in orders) {
      for (let person in orders[day]) {
        for (let orderIndex in orders[day][person]['order']) {

          // should have been more careful with my naming scheme.. order order order everywhere
          name = Object.keys(orders[day][person]['order'][orderIndex])[0];

          // overall stats
          // i.e. { 'Paneer Makhani': 2, 'Garlic Naan': 6 ... }
          overallItemFrequency[name] = (overallItemFrequency[name] || 0) + 1;
          overallMoneySpent += LittleDelhi['reversed'][name]['price'];

          // user stats
          // i.e. { jsmith: { 'Paneer Makhani': 2, 'Garlic Naan': 6, 'spent': 210 ... }, jdoe: { 'Mango Lassi': 2, 'spent': 10 ... } }
          userStats[person] = userStats[person] || {orders:{}, spent:0};
          userStats[person]['orders'][name] = (userStats[person]['orders'][name] || 0) + 1;
          userStats[person]['spent'] = userStats[person]['spent'] + LittleDelhi['reversed'][name]['price'];
        }
      }
    }

    var text;
    if (user) {
      // USER
      // Top 3 user items ordered
      var frequency = sortByFrequency(userStats[user]['orders']);

      // Ranking among peers in total money spent
      var spentRankings = _.map(userStats, (userObject, user) => [user, Number(userObject['spent'].toFixed(2))]);
      spentRankings = _.sortBy(spentRankings, tuple => tuple[1]).reverse();
      spentRankings = _.map(spentRankings, tuple => tuple[0]);

      // Find the user's ranking among the list
      var userSpentRank = _.indexOf(spentRankings, user) + 1;

      // Assemble the numbers into a message:
      text = '```Top personal item frequencies:\n'
      text += formatKVTuples(frequency);
      text += 'Total personal amount spent: $';
      text += userStats[user]['spent'].toFixed(2) + '\n';
      text += 'Amount spent ranking: '
      text += userSpentRank;
      text += '```';
    } else {
      // OVERALL
      // Top 3 overall items ordered
      var frequency = sortByFrequency(overallItemFrequency, FILTER_BY_ITEMS);

      // Ranking among peers in total money spent
      var spentRankings = _.map(userStats, (userObject, user) => [user, Number(userObject['spent'].toFixed(2))]);
      spentRankings = _.sortBy(spentRankings, tuple => tuple[1]).reverse();

      // Get the top 3 spenders
      spentRankings.splice(3);

      // Assemble the numbers into a message:
      text = '```Top overall entree frequencies:\n'
      text += formatKVTuples(frequency);
      text += 'Top overall spenders:\n';
      text += formatKVTuples(spentRankings, '$');
      text += 'Total overall amount spent: $';
      text += overallMoneySpent.toFixed(2);
      text += '```';
    }

    return res.json(slackFormat(user || 'here', text));
  });
}

// ______________________HELPER METHODS_______________________________

// returns the array of tuples formated as such:
// ' - <array[0][0]>: <pre><array[0][1]>\n<array[1][0]>: <pre><array[1][1]>\n...'
function formatKVTuples(array, pre) {
  pre = pre || '';
  var text = '';
  for (var i=0;i<array.length;i++)
    text += ' - ' + array[i][0] + ': ' + pre + array[i][1] + '\n';
  return text;
}

// Sorts the given JS object by item frequency, assuming 'orders' is structured like so:
// { 'Paneer Makhani': 2, 'Garlic Naan': 6 ... }
// Can additionally filter by the provided array
function sortByFrequency(orders, filterBy) {
  // filter out the orders we don't want
  if (filterBy)
    orders = _.omit(orders, filterBy);

  // convert to array of tuples for sorting
  orders = _.map(orders, (frequency, name) => [name, frequency]);

  // sort by descending frequency
  orders = _.sortBy(orders, tuple => tuple[1]).reverse();

  // only leave the first 3
  orders.splice(3);

  return orders;
}

// Shows the user's info, including name, number, and favorite
// The user needs to have first created a profile with Alfred to
// be able to access their information, otherwise they need to
// setInfo
function showInfo(user, res) {
  FirebaseHelper.checkInfoExistsThenRun(user, (args) => {
    var info = args[0];

    var text = '```';

    text += ('Name: ' + info.name[0] + ' ' + info.name[1] + '\n');
    text += ('Number: ' + info.number + '\n');
    text += ('Favorite: ');

    if (info.favorite) {
      for (let item of info.favorite) {
        // name of item
        var name = Object.keys(item)[0];
        text += name;
        // if it has a spice level
        if (item[name] !== true)
          text += ('(' + item[name].spice + ')');
        text += ', ';
      }
      // remove trailing ', '
      text = text.substring(0, text.length-2);
    } else
      text += 'None';

    text += '```';

    return res.json(slackFormat(user, text));
  }, () => {
    console.log('No info exists for: ' + user);
    return res.json(slackFormat(user, 'No info exists for you'));
  });
}

// Sets the user's info including name and number
// Both of these values must be specified when setting the info
function setInfo(user, text, res) {
  var u = {};
  text = text.split(',');

  if (text.length !== 2) {
    console.log('Invalid number of arguments: ' + text);
    return res.json(slackFormat(user, name + Errors.INVALID_INFO_TEXT));
  }
  var name = text[0];
  var number = text[1];

  // parse first and last name
  var i = name.indexOf(' ');

  if (i === -1) {
    console.log('Invalid name: ' + name);
    return res.json(slackFormat(user, name + Errors.INVALID_INFO_TEXT));
  }

  var first = name.substring(0, i);
  var last = name.substring(i+1, name.length);

  u.name = [first, last];

  // parse number

  // leading space
  if (number[0] === ' ')
    number = number.substring(1, number.length);

  // ensure number is digits only
  if (!(/^\d+$/.test(number))) {
    console.log('Invlaid number: ' + number);
    return res.json(slackFormat(user, number + Errors.INVALID_INFO_TEXT));
  }

  u.number = number;

  FirebaseHelper.writeFirebaseUser(user, u);

  return res.json(slackFormat(user, 'Thank you for the info'));
}
