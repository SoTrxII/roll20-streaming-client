import "reflect-metadata";
import { container } from "../inversify.config";
import { TYPES } from "../types";
import { interfaces } from "inversify";
import { Roll20ClientAPI } from "../@types/roll20-client-API";
import { Roll20ClientOptions } from "./roll20-client";
import * as config from "../../config.json";
import { tmpdir } from "os";

describe("Roll20 Client", () => {
  const SAMPLE_GAME_LINK = "https://app.roll20.net/join/2883710/mEiLZw";
  describe("Streaming to a file", () => {
    let roll20Client: Roll20ClientAPI;
    beforeAll(async () => {
      const options: Roll20ClientOptions = {
        roll20Account: {
          login: config.Roll20.login,
          password: config.Roll20.password
        },
        displayId: 0,
        headless: false,
        screenSize: [1280, 720],
        fps: 21,
        target: `${tmpdir()}/recording-${Date.now()}.mp4`,
        sinkName: "roll20Sink"
      };
      roll20Client = container.get<Roll20ClientAPI>(TYPES.Roll20Client);
      roll20Client.options = options;
      await roll20Client.initialize();
    }, 60000);
    it("Should record the game to a file", async () => {
      await roll20Client.startStreamingGame(SAMPLE_GAME_LINK);
      await new Promise((res, rej) => setTimeout(() => res(), 60000));
      await roll20Client.stopStreamingGame();
    }, 120000);
  });
  describe("Streaming to remote rtmp", () => {
    let roll20Client: Roll20ClientAPI;
    beforeAll(async () => {
      const options: Roll20ClientOptions = {
        roll20Account: {
          login: config.Roll20.login,
          password: config.Roll20.password
        },
        displayId: 0,
        headless: false,
        screenSize: [1280, 720],
        fps: 21,
        target: `rtmp://rtmp.pocot.fr`,
        sinkName: "roll20Sink"
      };
      roll20Client = container.get<Roll20ClientAPI>(TYPES.Roll20Client);
      roll20Client.options = options;
      await roll20Client.initialize();
    }, 60000);
    it("Should start streaming to the RTMP server", async () => {
      await roll20Client.startStreamingGame(SAMPLE_GAME_LINK);
      await new Promise((res, rej) => setTimeout(() => res(), 60000));
      await roll20Client.stopStreamingGame();
    }, 120000);
  });
});
