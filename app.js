import express from "express";
import bodyParser from "body-parser";
import commands from "./commands";
import * as Order from "./order";
import * as Slack from "./slack";

const app = express();
const port = process.env.PORT || 3000;

// body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/commands", commands);
app.post("/ping_slack", Slack.pingSlack);
app.post("/order_completed", Order.orderComplete);
app.get("/get_orders", Order.readTodaysFirebaseOrders);

// error handler
app.use((err, req, res) => {
   console.error(err.stack);
   res.status(400).send(err.message);
});

app.listen(port, () => console.log("Slack bot listening on port " + port));
