import "reflect-metadata";
import { RedisService } from "./redis";

describe.skip("Redis Pub/Sub Service", () => {
  const redis = new RedisService();
  const CHANNEL = "rollsUpdateRequest";
  const PAYLOAD = {
    meh: "pouet"
  };
  it("Should be able to publish a notification", async () => {
    await redis.subscribe(CHANNEL);
    const messagePromise = new Promise((res, rej): any => {
      redis.on("message", (channel, payload) => {
        console.log("MESSAGE!");
        res([channel, payload]);
      });
    }) as Promise<[string, string]>;

    redis.publish(CHANNEL, PAYLOAD);
    const [channel, payload] = (await messagePromise)[0];
    expect(channel).toBe(CHANNEL);
    expect(payload).toBe(JSON.stringify(PAYLOAD));
  });
});
