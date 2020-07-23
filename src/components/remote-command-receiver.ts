import { inject, injectable } from "inversify";
import { RemoteCommandReceiverAPI } from "../@types/remote-command-receiver-API";
import { TYPES } from "../types";
import { Roll20ClientAPI } from "../@types/roll20-client-API";
import { RedisAPI } from "../@types/redis-API";
import { Roll20ClientOptions } from "./roll20-client";
import * as config from "../../config.json";
import { RedisMessage } from "../@types/redis-message";

export enum SubChannels {
  StartStreaming = "startStreamingRoll20Game",
  StopStreaming = "stopStreamingRoll20Game"
}

export enum PubChannels {
  StreamingBegan = "streamingRoll20GameBegan",
  StreamingStopped = "streamingRoll20GameStopped"
}

@injectable()
export class RemoteCommandReceiver implements RemoteCommandReceiverAPI {
  private roll2OClient: Roll20ClientAPI;
  private redis: RedisAPI;

  constructor(
    @inject(TYPES.Roll20Client) client: Roll20ClientAPI,
    @inject(TYPES.RedisService) redis: RedisAPI
  ) {
    this.roll2OClient = client;
    this.redis = redis;
    const options: Roll20ClientOptions = {
      roll20Account: {
        login: config.Roll20.login,
        password: config.Roll20.password
      },
      displayId: 0,
      headless: false,
      screenSize: [1280, 720],
      fps: 21,
      target: `rtmp://localhost/live`,
      sinkName: "roll20Sink"
    };
    this.roll2OClient.options = options;
    this.roll2OClient.initialize().catch(console.error);
    this.redis.subscribe(SubChannels.StartStreaming);
    this.redis.subscribe(SubChannels.StopStreaming);
    this.redis.on("message", e => this.messageBroker(e[0], JSON.parse(e[1])));
  }

  private async messageBroker(channel: string, message: RedisMessage) {
    console.log("MESSAGE");
    console.log(channel);
    if (channel === SubChannels.StartStreaming) {
      let hasError = false;
      try {
        await this.roll2OClient.startStreamingGame(message.data.gameUrl);
      } catch (e) {
        hasError = true;
      }

      const returnPayload: RedisMessage = {
        data: null,
        campaignRoll2OIds: message.campaignRoll2OIds,
        campaignId: message.campaignId,
        hasError: hasError
      };
      this.redis.publish(PubChannels.StreamingBegan, returnPayload);
    } else if (channel === SubChannels.StopStreaming) {
      let hasError = false;
      try {
        await this.roll2OClient.stopStreamingGame();
      } catch (e) {
        hasError = true;
      }
      const returnPayload: RedisMessage = {
        data: null,
        campaignRoll2OIds: message.campaignRoll2OIds,
        campaignId: message.campaignId,
        hasError: hasError
      };
      this.redis.publish(PubChannels.StreamingStopped, returnPayload);
    }
  }
}
