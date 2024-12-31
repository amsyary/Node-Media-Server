//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//

const Fs = require("fs");
const path = require("path");
const Http = require("http");
const Https = require("https");
const WebSocket = require("ws");

const Express = require("express");
const bodyParser = require("body-parser");
const basicAuth = require("basic-auth-connect");
const NodeFlvSession = require("./node_flv_session");
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_MEDIAROOT = "./media";
const Logger = require("./node_core_logger");
const context = require("./node_core_ctx");
const NodeWebsocketServer = require("./node_websocket_server");
const streamsRoute = require("./api/routes/streams");
const serverRoute = require("./api/routes/server");
const relayRoute = require("./api/routes/relay");
const uploadRoute = require("./api/routes/upload");
const StreamRoom = require("./stream_room");
class NodeHttpServer {
  constructor(config) {
    this.port = config.http.port || HTTP_PORT;
    this.mediaroot = config.http.mediaroot || HTTP_MEDIAROOT;
    this.config = config;
    let app = Express();
    this.clientCount = 0;
    this.streamRooms = new Map();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.all("*", (req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.config.http.allow_origin);
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type,Content-Length, Authorization, Accept,X-Requested-With"
      );
      res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Credentials", true);
      req.method === "OPTIONS" ? res.sendStatus(200) : next();
    });

    app.get("*.flv", (req, res, next) => {
      req.nmsConnectionType = "http";
      this.onConnect(req, res);
    });

    let adminEntry = path.join(__dirname + "/public/admin/index.html");
    if (Fs.existsSync(adminEntry)) {
      app.get("/admin/*", (req, res) => {
        res.sendFile(adminEntry);
      });
    }

    if (this.config.http.api !== false) {
      if (this.config.auth && this.config.auth.api) {
        app.use(
          ["/api/*", "/static/*", "/admin/*"],
          basicAuth(this.config.auth.api_user, this.config.auth.api_pass)
        );
      }
      app.use("/api/streams", streamsRoute(context));
      app.use("/api/server", serverRoute(context));
      app.use("/api/relay", relayRoute(context));
      app.use("/api/videos", uploadRoute(context));
      app.use("/live/screenshots", Express.static("./media/screenshots"));
    }

    app.use(Express.static(path.join(__dirname + "/public")));
    app.use(Express.static(this.mediaroot));
    if (config.http.webroot) {
      app.use(Express.static(config.http.webroot));
    }

    // app.get("/api/upload", (req, res) => {
    //   res.json({ message: "OK Success" });
    // });

    this.httpServer = Http.createServer(app);

    /**
     * ~ openssl genrsa -out privatekey.pem 1024
     * ~ openssl req -new -key privatekey.pem -out certrequest.csr
     * ~ openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
     */
    if (this.config.https) {
      let options = {
        key: Fs.readFileSync(this.config.https.key),
        cert: Fs.readFileSync(this.config.https.cert),
      };
      if (this.config.https.passphrase) {
        Object.assign(options, { passphrase: this.config.https.passphrase });
      }
      this.sport = config.https.port ? config.https.port : HTTPS_PORT;
      this.httpsServer = Https.createServer(options, app);
    }
  }

  run() {
    this.httpServer.listen(this.port, () => {
      Logger.log(`Node Media Http Server started on port: ${this.port}`);
    });

    this.httpServer.on("error", (e) => {
      Logger.error(`Node Media Http Server ${e}`);
    });

    this.httpServer.on("close", () => {
      Logger.log("Node Media Http Server Close.");
    });

    this.wsServer = new WebSocket.Server({ server: this.httpServer });

    this.wsServer.on("connection", (ws, req) => {
      this.clientCount++;
      console.log("client count : " + this.clientCount);
      req.nmsConnectionType = "ws";
      this.onConnect(req, ws);
    });

    this.wsServer.on("listening", () => {
      Logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
    });
    this.wsServer.on("error", (e) => {
      Logger.error(`Node Media WebSocket Server ${e}`);
    });
    this.wsServer.on("close", function close() {
      console.log("disconnected");
    });

    if (this.httpsServer) {
      this.httpsServer.listen(this.sport, () => {
        Logger.log(`Node Media Https Server started on port: ${this.sport}`);
      });

      this.httpsServer.on("error", (e) => {
        Logger.error(`Node Media Https Server ${e}`);
      });

      this.httpsServer.on("close", () => {
        Logger.log("Node Media Https Server Close.");
      });
    }

    context.nodeEvent.on("postPlay", (id, args) => {
      context.stat.accepted++;
    });

    context.nodeEvent.on("postPublish", (id, args) => {
      context.stat.accepted++;
    });

    context.nodeEvent.on("doneConnect", (id, args) => {
      let session = context.sessions.get(id);
      let socket =
        session instanceof NodeFlvSession ? session.req.socket : session.socket;
      context.stat.inbytes += socket.bytesRead;
      context.stat.outbytes += socket.bytesWritten;
    });
  }

  stop() {
    this.httpServer.close();
    if (this.httpsServer) {
      this.httpsServer.close();
    }
    context.sessions.forEach((session, id) => {
      if (session instanceof NodeFlvSession) {
        session.req.destroy();
        context.sessions.delete(id);
      }
    });
  }

  onConnect(req, res) {
    // let session = new NodeFlvSession(this.config, req, res);
    // session.run();
    res.on("message", this.handleMessage.bind(this, res));
    res.on("close", this.onClose.bind(this, res));
    let session = new NodeWebsocketServer(this.config, req, res);
    session.run();
    // res.on("close", () => {
    //   // Decrement client count
    //   this.clientCount--;

    //   // Send updated client count to all clients
    //   console.log("disconnect : client count : " + this.clientCount);
    // });
  }
  handleMessage(ws, message) {
    const data = JSON.parse(message);
    const { action, streamId } = data;
    const initialViewerCount = 0;

    if (action === "createRoom") {
      const room = new StreamRoom(streamId, initialViewerCount);
      room.addViewer(ws);
      this.streamRooms.set(streamId, room);
      this.updateViewerCount(streamId, initialViewerCount);
    } else if (action === "joinRoom") {
      const room = this.streamRooms.get(streamId);
      if (room) {
        room.addViewer(ws);
        console.log("Joining room : " + JSON.stringify(room));
        this.updateViewerCount(streamId, room.getViewerCount());
      }
    } else if (action === "leaveRoom") {
      const room = this.streamRooms.get(streamId);
      if (room) {
        room.removeViewer(ws);
        this.updateViewerCount(streamId, room.getViewerCount());
      }
    } else if (action === "deleteRoom") {
      this.streamRooms.delete(streamId);
      Logger.log(`Livestream Room View Count ${streamId} deleted`);
    }
  }
  updateViewerCount(streamId, count) {
    const room = this.streamRooms.get(streamId);
    if (room) {
      room.viewers.forEach((client) => {
        client.send(JSON.stringify({ action: "updateViewerCount", count }));
      });
    } else {
      console.log("Room not found");
    }
    console.log(`Stream ${streamId} viewer count: ${count}`);
  }
  onClose(ws) {
    console.log("User disconnected");
    this.clientCount--;
    this.streamRooms.forEach((room, streamId) => {
      if (room.viewers.has(ws)) {
        room.removeViewer(ws);
        this.updateViewerCount(streamId, room.getViewerCount());
      }
    });
  }
}

module.exports = NodeHttpServer;
