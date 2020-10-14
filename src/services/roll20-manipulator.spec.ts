import "reflect-metadata";
import { container } from "../inversify.config";
import { Roll20ManipulatorAPI } from "../@types/roll20-manipulator-API";
import { TYPES } from "../types";
import { interfaces } from "inversify";
import * as config from "../../config.json";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { BoundingBox, Cookie } from "puppeteer";
import { hrtime } from "process";
require('dotenv-safe').config();
import Newable = interfaces.Newable;
import { Roll20Account, Roll20ManipulatorOptions } from "./roll20-manipulator";

describe("Roll20-manipulator", () => {
  const roll20Account: Roll20Account = {
    login: process.env.ROLL20_LOGIN,
    password: process.env.ROLL20_PASSWORD
  };
  const SAMPLE_GAME_LINK = "https://app.roll20.net/join/2883710/mEiLZw";
  const manipulatorOptions: Roll20ManipulatorOptions = {
    screenSize: [1280, 720],
    virtualDisplayId: 0,
    headless: false
  };
  const roll20ManipulatorConstructor = container.get<
    Newable<Roll20ManipulatorAPI>
  >(TYPES.Roll20ManipulatorService);
  let roll2OManipulator: Roll20ManipulatorAPI;

  describe("Keeping the instance and cookies up", () => {
    const cookiesPath = "/tmp/cookies";
    beforeEach(async () => {
      roll2OManipulator = new roll20ManipulatorConstructor(
        roll20Account,
        manipulatorOptions
      );
      await roll2OManipulator.initializeBrowser();
      //await roll2OManipulator.login();
    });
    describe("No previous cookies", () => {
      beforeEach(() => {
        if (existsSync(cookiesPath)) {
          unlinkSync(cookiesPath);
        }
      });
      it("Should be able to login into Roll20 when no cookies are found", async () => {
        const start = hrtime();
        await roll2OManipulator.login();
        // Exec time is secs
        const execTime = hrtime(start)[1] / 1000000;
        expect(existsSync(cookiesPath)).toEqual(true);
        const cookies: Cookie[] = JSON.parse(
          readFileSync(cookiesPath, "utf-8")
        );
        expect(
          cookies
            .map(c => c.expires)
            .every(e => new Date(e * 1000) < new Date())
        );
        expect(execTime).toBeGreaterThan(2);
      }, 30000);

      afterEach(async () => {
        await roll2OManipulator.closeBrowser();
      });
    });
    describe("Previous cookies", () => {
      describe("Not expired", () => {
        beforeEach(async () => {
          if (existsSync(cookiesPath)) {
            unlinkSync(cookiesPath);
          }
          await roll2OManipulator.login();
          const cookies: Cookie[] = JSON.parse(
            readFileSync(cookiesPath, "utf-8")
          );
        }, 30000);
        it("Should be able to quick login at the second login", async () => {
          const start = hrtime();
          await roll2OManipulator.login();
          const execTime = hrtime(start)[1] / 10 ** 9;
          console.log(execTime);
          // Second login should take less than 2 seconds
          expect(execTime).toBeLessThan(2);
        }, 30000);
      });
      describe("Expired", () => {
        beforeEach(async () => {
          if (existsSync(cookiesPath)) {
            unlinkSync(cookiesPath);
          }
          await roll2OManipulator.login();
          const cookies: Cookie[] = JSON.parse(
            readFileSync(cookiesPath, "utf-8")
          );
          for (const c of cookies) {
            c.expires = Date.now() / 10000 - 1000;
          }
          writeFileSync(cookiesPath, JSON.stringify(cookies), "utf-8");
        }, 30000);
        it("Should normal login again when cookies are found but expired", async () => {
          const start = hrtime();
          await roll2OManipulator.login();
          const execTime = hrtime(start)[1] / 10 ** 9;
          console.log(execTime);
        }, 30000);
      });
      afterEach(() => {
        roll2OManipulator.closeBrowser();
      });
    });
  });
  describe("Joining a game", () => {
    beforeAll(async () => {
      roll2OManipulator = new roll20ManipulatorConstructor(
        roll20Account,
        manipulatorOptions
      );
      await roll2OManipulator.initializeBrowser();
      await roll2OManipulator.login();
    }, 60000);
    it("Should join a Roll20 game without issues", async () => {
      await roll2OManipulator.joinGame(SAMPLE_GAME_LINK);
    }, 30000);
    afterEach(() => {
      roll2OManipulator.closeBrowser();
    });
  });
  describe("Setting up the streaming settings of a game", () => {
    beforeAll(async () => {
      roll2OManipulator = new roll20ManipulatorConstructor(
        roll20Account,
        manipulatorOptions
      );
      await roll2OManipulator.initializeBrowser();
      await roll2OManipulator.login();
      await roll2OManipulator.joinGame(SAMPLE_GAME_LINK);
    }, 60000);
    it("Should reach eventual settings stability", async () => {
      await roll2OManipulator.setupStreamingSetting();
    }, 60000);
    afterEach(() => {
      //roll2OManipulator.closeBrowser();
    });
  });
  describe("Coordinates calulation", () => {
    beforeAll(() => {
      roll2OManipulator = new roll20ManipulatorConstructor(
        roll20Account,
        manipulatorOptions
      );
    });
    it("Should be able to get the min zoom level required to cover a specific field area", () => {
      const targetArea: BoundingBox = {
        x: 152,
        y: 516,
        width: 1003,
        height: 513
      };
      const baseArea: BoundingBox = {
        width: 1200,
        height: 690,
        x: 0,
        y: 0
      };
      const minZoom = roll2OManipulator.getZoomForArea(targetArea, baseArea);
      expect(baseArea.width / (minZoom / 100)).toBeGreaterThanOrEqual(
        targetArea.width
      );
      expect(baseArea.height / (minZoom / 100)).toBeGreaterThanOrEqual(
        targetArea.height
      );
      console.log(minZoom);
    });
  });
  describe("Ajusting the zoom", () => {
    beforeEach(async () => {
      roll2OManipulator = new roll20ManipulatorConstructor(
        roll20Account,
        manipulatorOptions
      );
      await roll2OManipulator.initializeBrowser();
      await roll2OManipulator.login();
      await roll2OManipulator.joinGame(SAMPLE_GAME_LINK);
      await roll2OManipulator.setupStreamingSetting();
    }, 80000);
    it("Should be able to get the current zoom level", async () => {
      const zLvl = await roll2OManipulator.getZoomLevel();
      expect(zLvl).toEqual(100);
      console.log(zLvl);
    }, 60000);
    it("Should be able to change the current zoom level", async () => {
      const zLvl = await roll2OManipulator.getZoomLevel();
      await roll2OManipulator.changeZoomLevel(zLvl + 50);
      await new Promise(res => setTimeout(() => res(), 10000));
      const zLvl2 = await roll2OManipulator.getZoomLevel();
      expect(zLvl2).toEqual(zLvl + 50);
      await roll2OManipulator.changeZoomLevel(zLvl);
      await new Promise(res => setTimeout(() => res(), 10000));
      const zLvl3 = await roll2OManipulator.getZoomLevel();
      expect(zLvl3).toEqual(zLvl );

    }, 100000);
    it("Should be able to change the current zoom with coordinates as an input", async () => {
      const targetArea: BoundingBox = {
        height: 713,
        width: 995,
        x: 141,
        y: 596
      };
      await roll2OManipulator.coverArea(targetArea);
      //JQuery zoom slider only updates the zoom level text after the animation, wait for it t finish
      await new Promise( (res) => setTimeout(() => res(), 5000));
      expect(await roll2OManipulator.getZoomLevel()).toEqual(89);
    }, 100000);
    it("Should be able to adapt to new plays ara, no matter the aspect ratio and actual size", async () => {
      const targetArea1: BoundingBox = {
        x: 126,
        y: 625,
        width: 996,
        height: 486
      };
      const targetArea2: BoundingBox = {
        x: 960,
        y: 367,
        width: 598,
        height: 306
      };
      const targetArea3: BoundingBox = {
        x: 98,
        y: 254,
        width: 1697,
        height: 828
      };
      await new Promise( (res) => setTimeout(() => res(), 10000));
      await roll2OManipulator.coverArea(targetArea1);
      //JQuery zoom slider only updates the zoom level text after the animation, wait for it t finish
      await new Promise( (res) => setTimeout(() => res(), 5000));
      expect(await roll2OManipulator.getZoomLevel()).toEqual(125);
      await roll2OManipulator.coverArea(targetArea2);
      await new Promise( (res) => setTimeout(() => res(), 5000));
      await roll2OManipulator.coverArea(targetArea3);
      await new Promise( (res) => setTimeout(() => res(), 5000));
      //expect(await roll2OManipulator.getZoomLevel()).toEqual(128);
    }, 100000);
    afterEach(() => {
      roll2OManipulator.closeBrowser();
    });
  });
});
