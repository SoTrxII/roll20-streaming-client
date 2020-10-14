import { inject, injectable } from "inversify";
import { RemoteCommandReceiverAPI } from "../@types/remote-command-receiver-API";
import { TYPES } from "../types";
import { Roll20ClientAPI } from "../@types/roll20-client-API";
import { RedisAPI } from "../@types/redis-API";
import { Roll20ClientOptions } from "./roll20-client";
import { RedisMessage } from "../@types/redis-message";

export enum SubChannels {
  StartStreaming = "startStreamingRoll20Game",
  StopStreaming = "stopStreamingRoll20Game",
  MovePlayingField = "MoveRoll20RecordedFieldArea"
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
    this.roll2OClient.initialize().catch(console.error);
    this.redis.subscribe(SubChannels.StartStreaming);
    this.redis.subscribe(SubChannels.StopStreaming);
    this.redis.subscribe(SubChannels.MovePlayingField);
    this.redis.on("message", e => this.messageBroker(e[0], JSON.parse(e[1])));
  }

  private async messageBroker(channel: string, message: RedisMessage) {
    console.log("MESSAGE");
    console.log(channel);
    if (channel === SubChannels.StartStreaming) {
      await this.startStreaming(message);
    } else if (channel === SubChannels.StopStreaming) {
      await this.stopStreaming(message);
    } else if (channel === SubChannels.MovePlayingField) {
      await this.coverArea(message);
    }
  }

  private async startStreaming(message: RedisMessage): Promise<void> {
    let hasError = false;
    try {
      await this.roll2OClient.startStreamingGame(message.data.gameUrl);
    } catch (e) {
      hasError = true;
    }

    const returnPayload: RedisMessage = {
      data: null,
      campaignRoll20Ids: message.campaignRoll20Ids,
      campaignId: message.campaignId,
      hasError: hasError
    };
    this.redis.publish(PubChannels.StreamingBegan, returnPayload);
  }

  private async stopStreaming(message: RedisMessage): Promise<void> {
    let hasError = false;
    try {
      await this.roll2OClient.stopStreamingGame();
    } catch (e) {
      hasError = true;
    }
    const returnPayload: RedisMessage = {
      data: null,
      campaignRoll20Ids: message.campaignRoll20Ids,
      campaignId: message.campaignId,
      hasError: hasError
    };
    this.redis.publish(PubChannels.StreamingStopped, returnPayload);
  }

  private async coverArea(message: RedisMessage): Promise<void> {
    try {
      //Pure Fire & Forget, don't return anything
      await this.roll2OClient.coverArea(message.data.bbox);
    } catch (e) {
      console.error(e);
    }
  }
}
