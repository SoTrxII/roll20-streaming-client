import { Roll20ClientOptions } from "../components/roll20-client";

export interface Roll20ClientAPI {
  options: Roll20ClientOptions;

  initialize(): Promise<void>;

  startStreamingGame(gameUrl: string): Promise<void>;

  stopStreamingGame(): Promise<void>;
}
