const fs = require("fs");
const uniqBy = require("lodash.uniqby");
const flattenDeep = require("lodash.flattendeep");
const restaurants = require("../data/restaurants.json");

const SIMPLE_REGEX = /^(.+?)(\s[&'"].*)?$/;
const NO_PARENS_REGEX = /^(.+?)(\s[\(].*)?$/;
const FIRST_TWO_WORDS_REGEX = /^\S+(\s\S+)?/;
const WITHOUT_NUMBER_REGEX = /^(.+\.\s)?(.*)$/;
const WITHOUT_PRICE_REGEX = /^(.+?)(\s\s[\s\S]+)?$/;
const MAX_LENGTH = 2000;

function writeFiles(name, data) {
  for (let i = 0; i <= data.length / MAX_LENGTH; i++) {
    fs.writeFile(
      `../data/csv/${name}${i}.csv`,
      formatData(data.slice(i * MAX_LENGTH, (i + 1) * MAX_LENGTH)).join("\n"),
      error => console.log(error ? `ERROR: ${error}` : "SUCCESS")
    );
  }
}

const formatData = data => data.map(d => `${d.entity},${d.value},${d.synonyms.join(",")}`);
const concat = (a, b) => a.concat(b);
// LOL no Object.values??? lame
const getValues = obj => Object.keys(obj).map(key => obj[key]);
// gets  the upper and lower case version of the synonyms, flatten them, and then stringify each
const flatUniqCase = arr => uniqBy(flattenDeep(arr.map(s => ([s, s.toLowerCase()]))), val => val).map(s => JSON.stringify(s));

const restaurantNames = Object.keys(restaurants).map((restaurantName) => {
  console.log(`Processing: ${restaurantName} restaurant`);
  const value = JSON.stringify(restaurantName);
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
        const value = JSON.stringify(menuItemName);

        // TODO: I currently don't handle names with a (") in it or names over 64 characters long. I'll
        // probably have to address it before this goes fully functional, but I'd like to have a better
        // understanding of the rest of the architecture I'm gonna build out before doing this.
        if (value.indexOf("\\\"") !== -1 || value.length > 64) {
          console.log(`SKIPPING: ${value}`);
          return "";
        }

        // A lot of menu items are preceded by a number or for example "E3. "
        const withoutNumName = WITHOUT_NUMBER_REGEX.exec(menuItemName)[2];
        const synonyms = flatUniqCase([
          menuItemName,
          SIMPLE_REGEX.exec(withoutNumName)[1],
          NO_PARENS_REGEX.exec(withoutNumName)[1],
          FIRST_TWO_WORDS_REGEX.exec(withoutNumName)[0],
        ])
        // remove synonyms that overlap with restaurant names/synonyms
        .filter(syn => !allRestaurantNames.includes(syn));

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

          const value = JSON.stringify(option);
          // no joke some of the options on Seamless show \', which is insane, so we wanna let the
          // users just say ' instead.
          const optNoPriceOrEscape = WITHOUT_PRICE_REGEX.exec(option)[1].replace(/\\\'/g, "'");
          const synonyms = flatUniqCase([
            option,
            optNoPriceOrEscape,
            FIRST_TWO_WORDS_REGEX.exec(optNoPriceOrEscape)[0],
          ]);

          return { entity: "option-name", value, synonyms };
        })
      )
    )
), val => val.value);

writeFiles("restaurantNames", restaurantNames);
writeFiles("menuItemNames", menuItemNames);
writeFiles("optionNames", optionNames);
