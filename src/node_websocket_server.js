const NodeCoreUtils = require("./node_core_utils");
const URL = require("url");
const Logger = require("./node_core_logger");
const context = require("./node_core_ctx");
class NodeWebsocketServer {
  constructor(config, req, res) {
    this.config = config;
    this.req = req;
    this.res = res;
    this.id = NodeCoreUtils.generateNewSessionID();
    this.ip = this.req.socket.remoteAddress;
    if (this.req.nmsConnectionType === "ws") {
      this.res.cork = this.res._socket.cork.bind(this.res._socket);
      this.res.uncork = this.res._socket.uncork.bind(this.res._socket);
      //   this.res.on("close", this.onReqClose.bind(this));
      this.res.on("error", this.onReqError.bind(this));
      this.res.on("message", this.onMessage.bind(this));
      this.res.write = this.res.send;
      this.res.end = this.res.close;
      this.TAG = "websocket-connection";
    }
  }
  run() {
    let urlInfo = URL.parse(this.req.url, true);
    Logger.log(
      `[${this.TAG} connect] id=${this.id} ip=${this.ip} args=${JSON.stringify(
        urlInfo.query
      )}`
    );
    context.nodeEvent.emit("preConnect", this.id, this.connectCmdObj);
    context.nodeEvent.emit("postConnect", this.id, this.connectCmdObj);
    console.log("connection through websocket user : " + this.req.url);
  }
  onReqClose() {
    Logger.log(`[${this.TAG} close] id=${this.id}`);
    this.clientCount--;
    console.log("client count : " + this.clientCount);
  }

  onReqError(e) {
    Logger.log(`[${this.TAG} error] id=${this.id} error=${e}`);
  }

  onMessage(data) {
    // console.log(`Received message ${data} from user ${this.id}`);
    // console.log("wss : " + this.wss);
    // this.res._socket.clients.forEach(function each(client) {
    //   if (client !== ws && client.readyState === WebSocket.OPEN) {
    //     client.send(data, "message receive");
    //   }
    // });
  }
}

module.exports = NodeWebsocketServer;
