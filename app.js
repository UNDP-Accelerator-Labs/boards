"use strict";

const session = require("express-session");

const PgSession = require("connect-pg-simple")(session); // IN CASE WE WANT TO STORE SESSIONS
const express = require("express");
const http = require("http");
// const https = require('https');
const url = require("url");
const path = require("path");
const bodyparser = require("body-parser");
const DB = require("./config.js");
const { WebPubSubServiceClient } = require("@azure/web-pubsub");
const { WebPubSubEventHandler } = require("@azure/web-pubsub-express");

const app = express();

app.set("trust proxy", 1);

const cookie = {
  domain:
    process.env.NODE_ENV === "production"
      ? "acclabs-boards.azurewebsites.net"
      : undefined,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 1 * 1000 * 60 * 60 * 24 * 1, // DEFAULT TO 1 DAY. UPDATE TO 1 YEAR FOR TRUSTED DEVICES
  sameSite: "lax",
};
const sessionMiddleware = session({
  name: "postit-session",
  secret: "my-secure-pass",
  store: new PgSession({ pgPromise: DB.conn }),
  resave: false,
  saveUninitialized: false,
  cookie,
});

app.use(sessionMiddleware);

const { WebPubSubConnectionString, WEBPUBSUB_HUB_NAME } = process.env;

const serviceClient = new WebPubSubServiceClient(
  WebPubSubConnectionString,
  WEBPUBSUB_HUB_NAME
);

let handler = new WebPubSubEventHandler(WEBPUBSUB_HUB_NAME, {
  path: "/eventhandler",
  handleConnect: async (req, res) => {
    console.log("connected");
    res.success();
  },
  onConnected: async (req, res) => {
    console.log("connected... ");
  },
  onDisconnected: async (req, res) => {
    console.log("disconnected...");
  },
  handleUserEvent: async (req, res) => {
    let message = req.data;

    console.log("message", req.context.states, message);
    res.success();
  },
});

app.use(handler.getMiddleware());

app.use(express.static(path.join(__dirname, "./public")));
app.use("/scripts", express.static(path.join(__dirname, "./node_modules")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const routes = require("./routes");

app.get("/", routes.home);
app.post("/changeTitle", routes.changeTitle);

app.get("/wall/:id", routes.wall);
app.get("/all", routes.multiwall);

app.get("/getNotes", routes.notes.get);
app.post("/addNote", routes.notes.add);
app.post("/updateNote", routes.notes.update);
app.post("/updateNotes", routes.notes.updateMulti);
app.delete("/removeNote", routes.notes.remove);

app.get("/getGroups", routes.groups.get);
app.post("/addGroup", routes.groups.add);
app.post("/updateGroup", routes.groups.update);
app.post("/updateGroups", routes.groups.updateMulti);
app.delete("/removeGroup", routes.groups.remove);

app.get("/getCards", routes.cards.get);
app.post("/addCard", routes.cards.add);
app.post("/updateCard", routes.cards.update);
app.post("/updateCards", routes.cards.updateMulti);
app.delete("/removeCard", routes.cards.remove);

app.get("/getDatasources", routes.datasources.get);
app.post("/addDatasource", routes.datasources.add);
app.get("/increaseDatasource", routes.datasources.increase);

app.get("/getMatrixes", routes.matrixes.get);
app.post("/addMatrix", routes.matrixes.add);
app.post("/updateMatrix", routes.matrixes.update);
app.post("/updateMatrixes", routes.matrixes.updateMulti);
app.delete("/removeMatrix", routes.matrixes.remove);

app.post("/addPipe", routes.pipes.add);
app.delete("/removePipe", routes.pipes.remove);

app.post("/addTitle", routes.addTitle);
app.post("/updateTitle", routes.updateTitle);
app.post("/removeTitle", routes.removeTitle);

// TEMP LOGIN MECHANISM
const { login, logout } = require("./routes/login.js");
app.post("/login", login);
app.delete("/logout", logout);
///////////////////////

app.get("/negotiate", async (req, res) => {
  const wallId = req.query.wallId;
  let { uuid } = req.session;

  if (!wallId) {
    res.status(400).send("missing wallId");
    return;
  }
  let token = await serviceClient.getClientAccessToken({
    userId: uuid,
    groups: [wallId],
    roles: [
      `webpubsub.joinLeaveGroup.${wallId}`,
      `webpubsub.sendToGroup.${wallId}`,
    ],
  });
  if (!token) {
    return res.status(400).send("missing token");
  }

  res.json({
    url: token.url,
  });
});

app.get("*", routes.notfound);

let server = http.createServer(app);

server.listen(8000, function () {
  console.log("the app is running on port 8000");
});
