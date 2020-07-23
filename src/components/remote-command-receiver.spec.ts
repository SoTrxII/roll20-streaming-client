import "reflect-metadata";
import { container } from "../inversify.config";
import { TYPES } from "../types";
import { RemoteCommandReceiverAPI } from "../@types/remote-command-receiver-API";
import { RedisAPI } from "../@types/redis-API";
import { PubChannels, SubChannels } from "./remote-command-receiver";
import { RedisMessage } from "../@types/redis-message";

describe("Remote Command Receiver", () => {
  let commandReceiver = container.get<RemoteCommandReceiverAPI>(
    TYPES.RemoteCommandReceiver
  );
  let redis: RedisAPI;

  describe("Recording a game", () => {
    beforeAll(async () => {
      redis = container.get<RedisAPI>(TYPES.RedisService);
      await new Promise((res, _) => setTimeout(() => res(), 15000));
    }, 40000);
    it("Should start recording a game when receiving the event", async () => {
      const message: RedisMessage = {
        hasError: false,
        campaignId: String(99),
        campaignRoll20Ids: ["2883710"],
        data: { gameUrl: "https://app.roll20.net/join/2883710/mEiLZw" }
      };
      redis.publish(SubChannels.StartStreaming, message);
      const redisProm = new Promise((res, rej) => {
        redis.subscribe(PubChannels.StreamingBegan);
        redis.on("message", event => {
          const channel = event[0];
          const message = event[1];
          if (channel === PubChannels.StreamingBegan) {
            res(JSON.parse(message));
          }
        });
        setTimeout(() => {
          rej("Timemout !");
        }, 40000);
      });

      const answer = (await redisProm) as RedisMessage;

      expect(answer.hasError).toEqual(false);
      await new Promise((res, _) => setTimeout(() => res(), 30000));
      redis.publish(SubChannels.StopStreaming, message);
      const redisProm2 = new Promise((res, rej) => {
        redis.subscribe(PubChannels.StreamingStopped);
        redis.on("message", event => {
          const channel = event[0];
          const message = event[1];
          if (channel === PubChannels.StreamingStopped) {
            res(JSON.parse(message));
          }
        });
        setTimeout(() => {
          rej("Timemout !");
        }, 30000);
      });

      await redisProm2;
    }, 180000);
    it("Two in a row", async () => {
      const message: RedisMessage = {
        hasError: false,
        campaignId: String(99),
        campaignRoll20Ids: ["2883710"],
        data: { gameUrl: "https://app.roll20.net/join/2883710/mEiLZw" }
      };
      redis.publish(SubChannels.StartStreaming, message);
      await new Promise((res, _) => setTimeout(() => res(), 20000));
      redis.publish(SubChannels.StartStreaming, message);
      const redisProm = new Promise((res, rej) => {
        redis.subscribe(PubChannels.StreamingBegan);
        redis.on("message", event => {
          const channel = event[0];
          const message = event[1];
          if (channel === PubChannels.StreamingBegan) {
            res(JSON.parse(message));
          }
        });
        setTimeout(() => {
          rej("Timemout !");
        }, 30000);
      });

      const answer = (await redisProm) as RedisMessage;

      expect(answer.hasError).toEqual(false);
      await new Promise((res, _) => setTimeout(() => res(), 70000));
    }, 180000);
  });
});
