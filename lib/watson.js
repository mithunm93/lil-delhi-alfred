import ConversationV1 from "watson-developer-cloud/conversation/v1";
import uniqBy from "lodash.uniqby";
import flattenDeep from "lodash.flattendeep";
import { promisify } from "bluebird";
import restaurantData from "../data/restaurants.json";
import Errors from "../errors.json";
import secret from "../private.json";

const conversation = new ConversationV1({
  ...secret.watsonSecret,
  version_date: ConversationV1.VERSION_DATE_2017_05_26,
});

const message = promisify(conversation.message, { context: conversation });

const samePhrase = (outerRange, innerRange) => (outerRange[0] === innerRange[0] && outerRange[1] === innerRange[1]);
const phraseContainsPhrase = (outerRange, innerRange) =>
  !samePhrase(outerRange, innerRange) &&
  (outerRange[0] <= innerRange[0] && outerRange[1] >= innerRange[1]);
const push = (obj, key, val) => ({
  ...obj,
  [key]: [...(obj[key] || []), val],
});
const RESTAURANT_ENTITY = "restaurant-name";
const MENU_ITEM_ENTITY = "menu-item-name";
const OPTION_ENTITY = "option-name";
const getOption = (r, m, o) => getMenuItem(r, m) && getMenuItem(r, m).options[o];
const getMenuItem = (r, m) => getRestaurant(r) && getRestaurant(r).menuItems[m];
const getRestaurant = r => restaurantData[r];
const getRestaurantsForMenuItem = m => Object.keys(restaurantData)
  .map(r => (getMenuItem(r, m) ? r : ""))
  .filter(r => r);
// finds the specified option in the restaurant, or undefined if it doesn't exist
const optionInRestaurant = (r, o) => getRestaurant(r) && flattenDeep(
  Object.values(getRestaurant(r).menuItems)
    .map(({ options }) => Object.keys(options)),
)
  .find(optionName => o === optionName);
const isRestaurant = e => e.entity === RESTAURANT_ENTITY;
const isMenuItem = m => m.entity === MENU_ITEM_ENTITY;
const isOption = o => o.entity === OPTION_ENTITY;
// The options are being weighed higher than the menu items currently because there are many times that
// a specified option can be mistaken for a menu item (like salmon teriyaki for the 2 item bento dinner)
// but not many times that a menu item can be mistaken for an option (yet).
const MENU_ITEM_WEIGHT = 1;
const OPTION_WEIGHT = 1.5;
const getWeight = order => (
  (order.menuItems.length * MENU_ITEM_WEIGHT) +
  (flattenDeep(Object.values(order.options)).length * OPTION_WEIGHT)
);

// Group entities by where they occur in the user's query
const groupEntities = entities => Object.values(
  entities
    // sort the array by the length of the word
    .sort((a, b) => (b.location[1] - b.location[0]) - (a.location[1] - a.location[0]))
    // group values by checking if they were derived from the same phrase, discard substring
    .reduce((groupedEntities, entity, i, sortedEntities) => {
      const enclosingEntity = Object.keys(groupedEntities)
      // find an entity that encloses the current entity
        .find(key => phraseContainsPhrase(JSON.parse(key), entity.location));

      // add if the enclosing entity is the same or if it isn't enclosed by another entity
      if (groupedEntities[JSON.stringify(entity.location)] || !enclosingEntity) {
        const temp = push(groupedEntities, JSON.stringify(entity.location), entity);
        return temp;
      }

      return groupedEntities;
    }, {}),
);

// gets possible restaurants along with their menu items and options
const getMenuItemsWithRestaurant = (restaurants, entities) => flattenDeep(
  restaurants.map((r) => {
    const menuItems = entities
    // don't look for menu items that were aliased by the restaurant
      .filter(entity => !entity.some(e => e.value === r && isRestaurant(e)))
    // grab at most one menu item and one option from this restaurant for each entity
      .map((entity) => {
        const usedEntity = {};
        return entity.filter((e) => {
          if (isMenuItem(e) && getMenuItem(r, e.value) && !usedEntity[MENU_ITEM_ENTITY]) {
            usedEntity[MENU_ITEM_ENTITY] = true;
            return true;
          } else if (isOption(e) && optionInRestaurant(r, e.value) && !usedEntity[OPTION_ENTITY]) {
            usedEntity[OPTION_ENTITY] = true;
            return true;
          }
          return false;
        });
      })
      .filter(e => e.length > 0);

    // if any menu item is empty, that means this is not the right restaurant
    if (menuItems.lenth === 0) return null;

    // this whole block is dedicated to getting every permutation of the list of
    // menu items as possible
    // For example:
    // [ [menuItem1, option ], [option], [menuItem2, option], [menuItem3] ]
    // will return:
    // [ [menuItem1, menuItem2, menuItem3 ], [ menuItem2, menuItem3 ], [ menuItem1, menuItem3 ] ]
    // this allows us to check every combination of the menu items and options to
    // see which one the user was most likely asking for.
    let counter = 0;
    const multiOptionIndeces = menuItems
      .reduce((indeces, m, i) => (
        m.length > 1 ? { ...indeces, [i]: counter++ } : indeces
      ), {});
    const numVariations = Math.pow(2, Object.keys(multiOptionIndeces).length);
    const variations = [];

    for (let i = 0; i < numVariations; i += 1) {
      let bin = parseInt(i, 10).toString(2);
      if (numVariations > 1) {
        bin = `${"0".repeat(Object.keys(multiOptionIndeces).length - bin.length)}${bin}`;
      }
      let temp = [];
      for (let j = 0; j < menuItems.length; j += 1) {
        if (multiOptionIndeces[j] === undefined) {
          const entity = menuItems[j][0];
          if (isMenuItem(entity)) temp.push(entity);
        } else {
          const entity = menuItems[j][bin[multiOptionIndeces[j]]]
          if (isMenuItem(entity)) temp.push(entity);
        }
      }
      variations.push(temp);
    }

    return variations
      .map(menuItems => ({
        restaurant: getRestaurant(r),
        menuItems: menuItems.map(m => getMenuItem(r, m.value)),
        options: getOptions(r, menuItems, entities),
      }));
  },
)).filter(r => r); // get all the entries for which all menu items fit into the restaurant

const getMenuItemsWithoutRestaurant = (entities) => getMenuItemsWithRestaurant(
  // get a unique list of restaurants from the menu items provided
  uniqBy(
    flattenDeep(entities)
      .filter(isMenuItem)
    // get an array of every restaurant that was associated with the list of menu items
      .reduce(
        (r, e) => ([...r, ...getRestaurantsForMenuItem(e.value)]),
        [],
      ),
    val => val,
  ),
  entities,
);

// get the options for each menu item
function getOptions(restaurant, menuItems, entities) {
  // we don't want to double count options that are used for one menu item, so we have to keep track of which
  // ones are used across all items.
  const usedOptions = {};
  return menuItems
  // find the index of each menuItem within entities
    .map(
      menuItem => entities.findIndex(
        entity => entity.find(
          e => samePhrase(menuItem.location, e.location),
        ),
      ),
    )
  // choose the appropriate options for each menu item. The options are selected by looking through
  // all that have been specified before and after the menu item, up until the previous/next menu item.
    .reduce((allOptions, current, i, menuItemIndeces) => {
      const menuItem = menuItems[i].value;
      const start = menuItemIndeces[i - 1] >= 0 ? menuItemIndeces[i - 1] + 1 : 0;
      const end = menuItemIndeces[i + 1] >= 0 ? menuItemIndeces[i + 1] : entities.length;
      let options = [];

      for (let j = start; j < end; j += 1) {
        if (j !== current) {
          options = [
            ...options,
            ...entities[j]
            // get all options that have not yet been used by other menu items
              .map((e, k) => {
                const opt = getOption(restaurant, menuItem, e.value);

                if (isOption(e) && opt && !usedOptions[JSON.stringify([j, k])]) {
                  return { location: [j, k], opt };
                }
                return null;
              })
              .filter(e => e),
          ];
        }
      }

      if (options.length > 0) {
        return {
          ...allOptions,
          // Pick only the first option if it is a single choice category, or all if they're multi choice
          // Add each of the used options to the object so they're not re-used for future menu items
          [menuItem]: flattenDeep(Object.values(
            options
              .reduce((categories, { location, opt }) => {
                if ((opt.singleChoice && !categories[opt.category]) || !opt.singleChoice) {
                  usedOptions[JSON.stringify(location)] = true;
                  return {
                    ...categories,
                    [opt.category]: [
                      ...(categories[opt.category] || []),
                      opt,
                    ],
                  };
                }
                return categories;
              }, {}),
          )),
        };
      };
      return allOptions;
    }, {});
}


export function getOrderFromEntities(entities) {

  // group the entities by the phrase from the user that they were derived from.
  const groupedEntities = groupEntities(entities)
    .sort((a, b) => a[0].location[0] - b[0].location[0]);

  // get all the detected restaurants
  const restaurants = groupedEntities.reduce(
    (r, entity) => ([...r, ...entity.filter(isRestaurant)]),
    [],
  );

  const order = (
    (restaurants.length > 0) ?
      getMenuItemsWithRestaurant(restaurants.map(r => r.value), groupedEntities) :
      getMenuItemsWithoutRestaurant(groupedEntities)
  )
  // return the most likely option from the user
    .sort((a, b) => (getWeight(b) - getWeight(a)))[0];

  const error = verifyOrder(order);
  if (error) return { error };

  return {
    restaurant: order.restaurant,
    menuItems: order.menuItems,
    options: order.options,
  };
}

function verifyOrder(order) {
  if (!order) return Errors.NO_MENU_ITEMS;
  return null;
}

/*
 * response: P.shape({
 *   entities: P.arrayOf(P.Shape({
 *     confidence: P.number,          // percentile of confidence, 1 == 100%
 *     entity: P.string,              // entity name in Watson
 *     location: P.arrayOf(P.number), // [startIndex, endIndex], this is essentially a unique
 *                                    //   identifier for the item, it's where it occurs in
                                      //   user's request
 *     value: P.string,               // the value that was detected from the user's text
 *   })),
 *   intents: P.arrayOf(P.shape({
 *     confidence: P.number,          // percentile of confidence, 1 == 100%
 *     intent: P.string,              // the intent that was detected from the user's text
 *   })),
 *   input: P.shape({
 *     text: P.string,                // the text directly from the user
 *   }),
 * })
 *
 * Example:
 * text: "alfie i want an extra spicy vegetable korma, and a mango lassi"
 * JSON:
 * {
 *   "intents": [{"intent":"order","confidence":1}],
 *   "entities":[
 *     {"entity":"option-name","location":[16,27],"value":"Extra Spicy","confidence":1},
 *     {"entity":"menu-item-name","location":[28,43],"value":"Vegetable Korma","confidence":1},
 *     {"entity":"menu-item-name","location":[28,43],"value":"86. Vegetable Korma","confidence":1},
 *     {"entity":"option-name","location":[51,62],"value":"Mango Lassi   ($4.95)","confidence":1},
 *     {"entity":"menu-item-name","location":[51,62],"value":"Mango Lassi","confidence":1},
 *     {"entity":"option-name","location":[28,37],"value":"Vegetable","confidence":1},
 *     {"entity":"restaurant-name","location":[68,80],"value":"Little Delhi","confidence":1},
 *   ],
 *   "input":{"text":"alfie i want an extra spicy vegetable korma, and a mango lassi from little delhi"},
 *   "output":{"text":["I didn't understand. You can try rephrasing."],"nodes_visited":["Anything else"],"log_messages":[]},
 *   "context":{
 *     "conversation_id":--------REDACTED---------,
 *     "system":{
 *       "dialog_stack":[{"dialog_node":"root"}],
 *       "dialog_turn_counter":1,
 *       "dialog_request_counter":1,
 *       "_node_output_map":{"Anything else":[0]},
 *       "branch_exited":true,
 *       "branch_exited_reason":"completed",
 *     },
 *   },
 * }
 *
 */
// const pizzaText = "alfie order medium pesto pizza with complimentary fresh garlic and roasted red peppers and a rosen new york cheesecake";
export const parse = text => message({ input: { text } })
  .then((response, error) => {
    // chop off the end token of all the values
    const newResponse = {
      ...response,
      entities: response.entities
        .map(e => ({
          ...e,
          value: e.value.substr(0, e.value.length - 1),
        })),
    };
    return ({ response: newResponse, error });
  });

export const intents = {
  ORDER: "order",
};

export const entities = {
  RESTAURANT_NAME: "restaurant-name",
  MENU_ITME_NAME: "menu-item-name",
  OPTION_NAME: "option-name",
};
