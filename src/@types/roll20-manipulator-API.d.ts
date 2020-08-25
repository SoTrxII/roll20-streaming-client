import {BoundingBox, Cookie} from "puppeteer";


export interface Roll20ManipulatorAPI {
  joinGame(gameUrl: string): Promise<void>;
  initializeBrowser(): Promise<void>;
  getCookies(): Promise<Cookie[]>;
  getZoomLevel(): Promise<number>;
  login(): Promise<void>;
  closeBrowser(): Promise<void>;
  setupStreamingSetting(): Promise<void>;
  changeZoomLevel(targetZoomLevel: number): Promise<void>;
  getZoomForArea(area: BoundingBox, screen: BoundingBox): number;
  coverArea(area: BoundingBox): Promise<void>;
}
