# lil-delhi-alfred

Hello! I'm here to help you order Little Delhi through Seamless from Slack.

How to use me:
 1. Set up your user information like this:
```alfred info "John Smith, 0123456789"```
Remember to only use numeric characters for the phone number

 2. Place your order like this:
```alfred order "butter chicken (spicy), mango lassi, samosa"```
Note that you can specify a spice level, leaving it blank just leaves it as default

 3. The order will be placed around 4pm, and one of the orderers will be chosen at random to receive the call for the food

Some of my other features are:
- Set a favorite list of items so that you don't have to specify your order each time:
```alfred favorite "butter chicken (spicy), mango lassi, samosa"```
You can then place future orders with just `alfred order`. You can see your current favorite items by using `alfred info`

- See the list of available little delhi items with `alfred list`

- See the info I have on file by using `alfred info`

- Place your order from your favorite list by using `alfred order`

- See this help list by using `alfred help`
