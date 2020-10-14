import { Container, interfaces } from "inversify";
import { TYPES } from "./types";
import { VirtualScreenAPI } from "./@types/virtual-screen-API";
import { VirtualScreen } from "./services/virtual-screen";
import { Roll20ManipulatorAPI } from "./@types/roll20-manipulator-API";
import { Roll20Manipulator } from "./services/roll20-manipulator";
import { Recorder } from "./services/recorder";
import { RecorderAPI } from "./@types/recorder";
import { Roll20Client } from "./components/roll20-client";
import { Roll20ClientAPI } from "./@types/roll20-client-API";
import { RedisAPI } from "./@types/redis-API";
import { RedisService } from "./services/redis";
import { RemoteCommandReceiverAPI } from "./@types/remote-command-receiver-API";
import { RemoteCommandReceiver } from "./components/remote-command-receiver";
import Newable = interfaces.Newable;

export const container = new Container();

container
  .bind<VirtualScreenAPI>(TYPES.VirtualScreenService)
  .toConstructor(VirtualScreen);
container.bind<RecorderAPI>(TYPES.RecordingService).toConstructor(Recorder);
container
  .bind<Roll20ManipulatorAPI>(TYPES.Roll20ManipulatorService)
  .toConstructor(Roll20Manipulator);

container.bind<Roll20ClientAPI>(TYPES.Roll20Client).toConstantValue(
  new Roll20Client(
    container.get<Newable<VirtualScreenAPI>>(TYPES.VirtualScreenService),
    container.get<Newable<RecorderAPI>>(TYPES.RecordingService),
    container.get<Newable<Roll20ManipulatorAPI>>(
      TYPES.Roll20ManipulatorService
    ),
    {
      roll20Account: {
        login: process.env.ROLL20_LOGIN,
        password: process.env.ROLL20_PASSWORD
      },
      displayId: 99,
      headless: false,
      screenSize: [1280, 720],
      fps: 21,
      target: process.env.STREAMING_TARGET,
      sinkName: "roll20Sink",
      customPayloadUrl: process.env.CUSTOM_PAYLOAD_URL
    }
  )
);
container.bind<RedisAPI>(TYPES.RedisService).toConstantValue(
  new RedisService({
    host: process.env.REDIS_HOST,
    lazyConnect: true
  })
);
container
  .bind<RemoteCommandReceiverAPI>(TYPES.RemoteCommandReceiver)
  .to(RemoteCommandReceiver);
