import { inject, injectable, interfaces } from "inversify";
import { TYPES } from "../types";
import { Mutex } from "async-mutex";
import { VirtualScreenAPI } from "../@types/virtual-screen-API";
import { Roll20ManipulatorAPI } from "../@types/roll20-manipulator-API";
import { AccurateTime, RecorderAPI } from "../@types/recorder";
import { Roll20Account } from "../services/roll20-manipulator";
import { Roll20ClientAPI } from "../@types/roll20-client-API";
import Newable = interfaces.Newable;
import { BoundingBox } from "puppeteer";

export interface Roll20ClientOptions {
  screenSize?: [number, number];
  fps?: number;
  target: string;
  roll20Account: Roll20Account;
  displayId?: number;
  headless?: boolean;
  sinkName?: string;
  customPayloadUrl?: string;
}
class InvalidClientStateError extends Error {}
@injectable()
export class Roll20Client implements Roll20ClientAPI {
  private recordingLock = new Mutex();
  private isRecording = false;
  private virtualScreenService: VirtualScreenAPI;
  private virtualScreenConstructor: Newable<VirtualScreenAPI>;
  private recordingService: RecorderAPI;
  private recordingServiceConstructor: Newable<RecorderAPI>;
  private roll20Service: Roll20ManipulatorAPI;
  private roll20ServiceConstructor: Newable<Roll20ManipulatorAPI>;

  constructor(
    @inject(TYPES.VirtualScreenService)
    virtualScreenConstructor: Newable<VirtualScreenAPI>,
    @inject(TYPES.RecordingService)
    recordingConstructor: Newable<RecorderAPI>,
    @inject(TYPES.Roll20ManipulatorService)
    roll20ManipulatorConstructor: Newable<Roll20ManipulatorAPI>,
    options: Roll20ClientOptions
  ) {
    this.virtualScreenConstructor = virtualScreenConstructor;
    this.recordingServiceConstructor = recordingConstructor;
    this.roll20ServiceConstructor = roll20ManipulatorConstructor;
    this.options = options;
  }

  protected _options: Roll20ClientOptions = {
    screenSize: [1280, 720],
    displayId: 99,
    target: null,
    fps: 21,
    roll20Account: null,
    headless: true,
    sinkName: "roll20Sink"
  };

  get options() {
    return this._options;
  }

  set options(clientOptions: Roll20ClientOptions) {
    this._options = Object.assign({}, this.options, clientOptions);
    this.recordingService = new this.recordingServiceConstructor({
      screenSize: this._options.screenSize,
      fps: this._options.fps,
      virtualDisplayId: this._options.displayId,
      target: this._options.target,
      sinkName: this._options.sinkName
    });

    this.roll20Service = new this.roll20ServiceConstructor(
      this._options.roll20Account,
      {
        screenSize: this._options.screenSize,
        virtualDisplayId: this._options.displayId,
        headless: this._options.headless,
        sinkName: this._options.sinkName,
        customPayloadUrl: this._options.customPayloadUrl
      }
    );

    this.virtualScreenService = new this.virtualScreenConstructor({
      screenSize: this._options.screenSize,
      screenId: this._options.displayId
    });
  }

  async initialize(): Promise<void> {
    await this.virtualScreenService.startVirtualScreen();
    await this.roll20Service.initializeBrowser();
    await this.roll20Service.login();
  }

  async startStreamingGame(gameUrl: string): Promise<void> {
    const release = await this.recordingLock.acquire();
    try {
      await this._startStreamingGame(gameUrl);
    } finally {
      release();
    }
  }

  async stopStreamingGame(): Promise<AccurateTime> {
    const release = await this.recordingLock.acquire();
    let startDate;
    try {
      startDate =  await this._stopStreamingGame();
    } finally {
      release();
    }
    return startDate;
  }

  async coverArea(target: BoundingBox): Promise<void> {
    if (!this.isRecording)
      throw new InvalidClientStateError(
        "Cannot change area recorder while not recording !"
      );
    await this.roll20Service.coverArea(target);
  }
  private async _startStreamingGame(gameUrl: string): Promise<void> {
    if (this.isRecording) {
      await this._stopStreamingGame();
      this.isRecording = false;
    }
    this.isRecording = true;
    await this.roll20Service.joinGame(gameUrl);
    await this.recordingService.startRecording();
    this.roll20Service.setupStreamingSetting().catch(console.error);
  }

  private async _stopStreamingGame(): Promise<AccurateTime> {
    if (this.isRecording) {
      const startDate = this.recordingService.stopRecording();
      this.isRecording = false;
      return startDate;
    }
  }
}
