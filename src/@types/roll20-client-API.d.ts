import { Roll20ClientOptions } from "../components/roll20-client";
import { BoundingBox } from "puppeteer";
import { AccurateTime } from "./recorder";

export interface Roll20ClientAPI {
  options: Roll20ClientOptions;

  initialize(): Promise<void>;

  startStreamingGame(gameUrl: string): Promise<void>;

  stopStreamingGame(): Promise<AccurateTime>;

  coverArea(target: BoundingBox): Promise<void>;
}
