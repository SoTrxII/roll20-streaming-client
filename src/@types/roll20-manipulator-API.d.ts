import { Cookie } from "puppeteer";

export interface Roll20ManipulatorAPI {
  joinGame(gameUrl: string): Promise<void>;
  initializeBrowser(): Promise<void>;
  getCookies(): Promise<Cookie[]>;
  login(): Promise<void>;
  closeBrowser(): Promise<void>;
  setupStreamingSetting(): Promise<void>;
}
