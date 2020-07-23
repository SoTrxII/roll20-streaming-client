import "reflect-metadata";
import { container } from "../inversify.config";
import { Roll20ManipulatorAPI } from "../@types/roll20-manipulator-API";
import { TYPES } from "../types";
import { interfaces } from "inversify";
import { Roll20Account, Roll20ManipulatorOptions } from "./roll20-manipulator";
import * as config from "../../config.json";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { Cookie } from "puppeteer";
import { hrtime } from "process";
import Newable = interfaces.Newable;

describe("Roll20-manipulator", () => {
  const roll20Account: Roll20Account = {
    login: config.Roll20.login,
    password: config.Roll20.password
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
    beforeAll(async () => {
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
        expect(execTime).toBeGreaterThan(10);
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
    it("Should join a Roll20 game with issues", async () => {
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
      roll2OManipulator.closeBrowser();
    });
  });
});
