import express from "express";
import bodyParser from "body-parser";
import command from "./command";

const app = express();
const port = process.env.PORT || 3000;

// body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/command", command);

// error handler
app.use((err, req, res) => {
   console.error(err.stack);
   res.status(400).send(err.message);
});

app.listen(port, () => console.log("Slack bot listening on port " + port));
