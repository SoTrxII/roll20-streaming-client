import "reflect-metadata";
import { container } from "./inversify.config";
import { TYPES } from "./types";
import { RemoteCommandReceiverAPI } from "./@types/remote-command-receiver-API";

const http = require("http");
container.get<RemoteCommandReceiverAPI>(TYPES.RemoteCommandReceiver);

//Actually just a way to not exit
const server = http.createServer((req, res) => {
  res.writeHead(200);
});

server.listen(8086);
