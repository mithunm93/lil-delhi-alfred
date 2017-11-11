const fs = require("fs");
const uniqBy = require("lodash.uniqby");
const flattenDeep = require("lodash.flattendeep");
const restaurants = require("../data/restaurants.json");

const SIMPLE_REGEX = /^(.+?)(\s*[&'"-].*)?$/;
const NO_PARENS_REGEX = /^(.+?)(\s+\([\s\S]+\))?$/;
const FIRST_TWO_WORDS_REGEX = /^\s*(\S+(\s\S+)?)/;
const WITHOUT_NUMBER_REGEX = /^(\S+?\.\s*)?(.*)$/;
const WITHOUT_TRAILING_SPACES = /^(.+?)\s*$/;
const MAX_LENGTH = 1000;
const MIN_SYN_LENGTH = 3;
const MAX_SYN_LENGTH = 64;
const END_TOKEN = "*";

function writeFiles(name, data) {
  for (let i = 0; i <= data.length / MAX_LENGTH; i++) {
    fs.writeFile(
      `../data/csv/${name}${i}.csv`,
      formatData(data.slice(i * MAX_LENGTH, (i + 1) * MAX_LENGTH)).join("\n"),
      error => console.log(error ? `ERROR: ${error}` : "SUCCESS")
    );
  }
}

// This is requred because some of the values uploaded to watson have a trailing space,
// and watson truncates them when it reads them in. So I'm appending a token to the end that
// will be scraped off when the value is returned from Watson.
const withEndToken = s => `${s}${END_TOKEN}`;
const getPluralVariations = (s) => {
  if (s.length <= MIN_SYN_LENGTH || s.length >= MAX_SYN_LENGTH) return s;
  return (s.substr(s.length - 1) === "s" ? s.substr(0, s.length - 1) : `${s}s`);
}
const formatData = data => data.map(d => `${d.entity},${d.value},${d.synonyms.join(",")}`);
const concat = (a, b) => a.concat(b);
// LOL no Object.values??? lame
const getValues = obj => Object.keys(obj).map(key => obj[key]);
// gets  the upper and lower case version of the synonyms, flatten them, and then stringify each
const flatUniqCase = arr => uniqBy(flattenDeep(
  arr.map(s => ([
    s,
    s.toLowerCase(),
    getPluralVariations(s),
    getPluralVariations(s).toLowerCase(),
  ]))
), val => val);
// no joke some of the options on Seamless show \', which is insane, so we wanna let the
// users just say ' instead.
const replaceQuotes = string => string.replace(/\\\'/g, "'");

const restaurantNames = Object.keys(restaurants).map((restaurantName) => {
  console.log(`Processing: ${restaurantName} restaurant`);
  const value = JSON.stringify(withEndToken(restaurantName));
  const synonyms = flatUniqCase([
    restaurantName,
    SIMPLE_REGEX.exec(restaurantName)[1],
    NO_PARENS_REGEX.exec(restaurantName)[1],
    FIRST_TWO_WORDS_REGEX.exec(restaurantName)[0],
  ]);

  return { entity: "restaurant-name", value, synonyms };
});

const allRestaurantNames = flattenDeep(restaurantNames.map(r => [r.value, ...r.synonyms]));

const menuItemNames = flattenDeep(
  getValues(restaurants)
    .map(({ menuItems, name }) => Object.keys(menuItems)
      .map((menuItemName) => {
        console.log(`Processing: ${menuItemName} from ${name}`);
        const value = JSON.stringify(withEndToken(menuItemName));

        // TODO: I currently don't handle names with a (") in it or names over 64 characters long. I'll
        // probably have to address it before this goes fully functional, but I'd like to have a better
        // understanding of the rest of the architecture I'm gonna build out before doing this.
        if (value.indexOf("\\\"") !== -1 || value.length > MAX_SYN_LENGTH) {
          console.log(`SKIPPING: ${value}`);
          return "";
        }

        // A lot of menu items are preceded by a number or for example "E3. "
        const withoutNumOrSpaceName = replaceQuotes(
          WITHOUT_NUMBER_REGEX.exec(
            WITHOUT_TRAILING_SPACES.exec(menuItemName)[1]
          )[2]);
        const synonyms = flatUniqCase([
          menuItemName,
          SIMPLE_REGEX.exec(withoutNumOrSpaceName)[1],
          NO_PARENS_REGEX.exec(withoutNumOrSpaceName)[1],
        ])
        // remove synonyms that overlap with restaurant names/synonyms
          .filter(syn => !allRestaurantNames.includes(syn) && syn.length >= MIN_SYN_LENGTH)
          .map(s => JSON.stringify(s));

        return { entity: "menu-item-name", value, synonyms };
      })
    )
  )
  .filter(m => m);

const optionNames = uniqBy(flattenDeep(
  getValues(restaurants)
    .map(({ menuItems }) => getValues(menuItems)
      .map(({ options }) => Object.keys(options)
        .map((option) => {
          console.log(`Processing: ${option} option`);

          const value = JSON.stringify(withEndToken(option));
          const optNoPriceOrEscapeOrNumberOrSpace = WITHOUT_NUMBER_REGEX.exec(
            replaceQuotes(NO_PARENS_REGEX.exec(
              WITHOUT_TRAILING_SPACES.exec(option)[1]
            )[1])
          )[2];
          const synonyms = flatUniqCase([
            option,
            optNoPriceOrEscapeOrNumberOrSpace,
            SIMPLE_REGEX.exec(optNoPriceOrEscapeOrNumberOrSpace)[1],
          ])
          // remove synonyms that overlap with restaurant names/synonyms
            .filter(syn => !allRestaurantNames.includes(syn) && syn.length >= MIN_SYN_LENGTH)
            .map(s => JSON.stringify(s));

          return { entity: "option-name", value, synonyms };
        })
      )
    )
), val => val.value);

writeFiles("restaurantNames", restaurantNames);
writeFiles("menuItemNames", menuItemNames);
writeFiles("optionNames", optionNames);
