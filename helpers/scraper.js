var casper = require("casper").create({
  verbose: true,
  logLevel: "debug",
  pageSettings: {
    loadImages:  false,         // The WebPage instance used by Casper will
    loadPlugins: false,         // use these settings
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.4 (KHTML, like Gecko) Chrome/22.0.1229.94 Safari/537.4"
  }
});
const x = require("casper").selectXPath;
const fs = require("fs");

const private = JSON.parse(fs.read("../private.json"));
const restaurants = JSON.parse(fs.read("../data/restaurants.json") || "{}");

const url = "https://www.seamless.com/corporate/login";
const timeoutFunction = function() { this.emit("error"); };
const timeout = 60000; // 1 minute timeout for each step
const shortDelay = 500; // for waiting between actions

// These Regex are far from concise or perfect, but thanks to regex101.com and a lot of trial
// and error, they work. If Seamless decides to change anything about their pages, these will
// probably break, so let's hope they don't.
const RESTAURANTS_REGEX = /"vendorLocation"[\s\S]*?body=\[(.*?)<.*?<em>Hours: (.*?) - (.*?)<[\s\S]*?">(.*?)<[\s\S]*?<td class="Distance">\$(\S+)[\s\S]*?(\+\$(\S+)[\s\S]*?)?<\/td>/g;
const CATEGORY_REGEX = /title="Hide (.+)"[\s\S]*?<\!--menucategory-->/g;
const ITEMS_REGEX = /header=\[(.+) - \$?(.+)\] body=\[(.*)\s\]/g;
const OPTIONS_CATEGORY_REGEX = /<h3>(.+?)<span>[\s\S]+?<\/ul>/g;
const OPTIONS_REGEX = /price="(([\d]+\.)?[\d]+)_0" type="(.+?)"[\s\S]*?>\*?(.*?)</g;

// casper.getPageContent() sometimes returns &lt; and &gt; instead of < and >, so
// this will decode that.
function decodeString(string) {
  var elem = document.createElement("textarea");
  elem.innerHTML = string;
  return elem.value;
}

// Gets all regex matches within the string
function getAllMatches(regex, string) {
  const allMatches = [];
  var match = regex.exec(string);

  while(match) {
    allMatches.push(match);
    match = regex.exec(string);
  }

  return allMatches;
}

// We need this funciton to handle strings with either ' or " in them,
// since xpath doesn't support escaping
function xpathStringLiteral(s) {
  if (!s) return;
  if (s.indexOf('"') === -1) return '"' + s + '"';
  else if (s.indexOf("'") === -1) return "'" + s + "'";
  return 'concat("' + s.replace(/"/g, '",\'"\',"') + '")';
}

// Wait for a selector, and then some
function waitForWithDelay(selector, delay, callback) {
  casper.waitForSelector(selector, function() {
    this.wait(delay, callback);
  }, timeoutFunction, timeout);
}

// Wait until a selector disappears, and then some
function waitWhileWithDelay(selector, delay, callback) {
  casper.waitWhileSelector(selector, function() {
    this.wait(delay, callback)
  }, timeoutFunction, timeout);
}

// This funciton clicks each item and scrapes the options
function clickItems(items, i, restaurant) {
  const name = Object.keys(items)[i];
  casper.echo("Clicking: " + name + " from " + restaurant);

  // sometimes the name is the same as the category, and "clickLabel" will click on
  // the category label. The 'smoothbox' class is only on the actual item. We also
  // need the xpath translation to handle ' or " in our name because xpath doesn't
  // escape (woo hoo!)
  casper.thenClick(x("//a[text()=" + xpathStringLiteral(name) + " and contains(@class, \'smoothbox\')]"));

  waitForWithDelay("form#orderAttributes", shortDelay,  function() {
    casper.echo("Loaded " + name);

    const options = {};

    getAllMatches(OPTIONS_CATEGORY_REGEX, decodeString(casper.getPageContent()))
      .forEach(function(category) {
        getAllMatches(OPTIONS_REGEX, decodeString(category[0]))
          .forEach(function(info) {
            options[info[4]] = {
              category: category[1],
              name: info[4],
              price: info[1],
              singleChoice: info[3] === "radio",
            };
          });
      });
    items[name].options = options;

    waitForWithDelay("a#TB_closeWindowButton", shortDelay, function() {
      this.clickLabel("close", "a");
    });

    // wait for modal to close
    waitWhileWithDelay("form#orderAttributes", shortDelay, function() {
      casper.echo("Scraped " + name);
      if (++i < Object.keys(items).length)
        clickItems(items, i, restaurant);
      else
        this.emit("items.scraped." + restaurant);
    });

  });
}

// Print the error and die, this script will have to be run again.
casper.on("error", function(msg, trace) {
  this.echo("Error: " + msg, "ERROR");
  this.exit();
});

// Load Seamless
casper.start(url);

// Log in
casper.waitForSelector("form#widgetLoginForm", function() {
  casper.echo("Step 0: main page loaded");
  casper.echo("Logging in");
  this.fill("form#widgetLoginForm", {
    "username": private.username,
    "password":  private.password
  }, true);
}, timeoutFunction, timeout);

// Select time
casper.waitForSelector("form#pageForm", function() {
  casper.echo("Step 1: Time selection loaded");
  casper.echo("Selecting delivery time");
  this.fill("form#pageForm", {"deliveryDate": "Tomorrow"});
  this.fill("form#pageForm", {"time": "5:15 PM"}, true);
}, timeoutFunction, timeout);

// Scrape restaurants
casper.waitForSelector("table#resultstable", function() {
  casper.echo("Step2: Results table loaded");
  casper.echo("Scraping restaurant info");

  getAllMatches(RESTAURANTS_REGEX, decodeString(this.getPageContent()))
    .forEach(function(info) {
      if (restaurants[info[4]]) return;

      restaurants[info[4]] = {
        description: info[1],
        openTime: info[2],
        closeTime: info[3],
        name: info[4],
        deliveryMinimum: info[5],
        deliveryFee: info[7],
      };
    });
}, timeoutFunction, timeout);

// Click each restaurant and scrape each item
casper.then(function() {
  // This script tends to fail if it has to get all the restaurants in one go,
  // so it will probably have to be run a couple times.
  Object.keys(restaurants).filter(function(r) { return !restaurants[r].menuItems; })
    .forEach(function(restaurant) {
      const menuItems = {};
      casper.echo("Getting items for " + restaurant)

      casper.thenClick(x("//a[text()=" + xpathStringLiteral(restaurant) + "]"));

      casper.waitForSelector("div#MyCurrentOrder", function() {
        casper.echo("Scraping items for " + restaurant);

        // Get each category within the menu
        getAllMatches(CATEGORY_REGEX, decodeString(casper.getPageContent()))
          .forEach(function(category) {
            // for each category, scrape all the items
            getAllMatches(ITEMS_REGEX, decodeString(category[0]))
              .forEach(function(info) {
                menuItems[info[1]] = {
                  category: category[1],
                  name: info[1],
                  price: info[2],
                  description: info[3],
                };
              });
          });

        // Get all the options for each item
        if (Object.keys(menuItems).length > 0) {
          clickItems(menuItems, 0, restaurant);
        } else {
          this.emit("items.scraped." + restaurant);
        }
      }, timeoutFunction, timeout);

      casper.on("items.scraped." + restaurant, function() {
        // We save on each restaurant because the script tends to crash if it runs too long, either due to
        // a bad response from Seamless, a timeout, or other miscellaneous issues. This script can run for
        // many hours! Instead of spending time and effor trying to make the system more robust, I save after
        // each restaurant so that in the case that it fails, we can run it again and pick up from where it
        // left off.
        restaurants[restaurant].menuItems = menuItems;
        this.echo("Saving restaurant: " + restaurant);
        casper.echo("Saving restaurants: " + JSON.stringify(restaurants));
        fs.write("../data/restaurants.json", JSON.stringify(restaurants), "w");
        casper.back();
      });
  });
});

// FINISHED
casper.then(function() {
  this.echo("FINISHED");
  this.exit();
});

casper.run();
