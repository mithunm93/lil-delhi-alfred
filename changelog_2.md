Alfred 2.0 changelog

- Added `status`, which repeats the order back to the user when it is placed. Can also be used like `alfred status` to check what order has been placed today by the user.
- Added `forget`, which allows the user to remove an order they have placed for the day, or used with `info`, clears the user's info like name and number from Alfie.
- Added order filling, which will fill an order up to the minimum amount using mango lassis and samosas if the order doesn't reach $20
- Added spice validation, which checks to make sure that the item the user ordered actually allows a spice to be chosen and that the spice entered is a valid one, if a spice was entered.
- Added "order already placed" message if someone tries to place an order after the order has been taken by Casper
- Added `stats`, which allows people to view some interesting stats about their lil-delhi ordering
- Added a shorter help message that doesn't flood the screen
- Added "who dis" support
- Added `thank you` support, so people can thank Alfie if they feel like it
- Miscellaneous code clean up and additional logging
