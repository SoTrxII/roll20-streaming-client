import "reflect-metadata";
import { container } from "../inversify.config";
import { VirtualScreenAPI } from "../@types/virtual-screen-API";
import { TYPES } from "../types";
import { VirtualScreen, VirtualScreenOptions } from "./virtual-screen";
import { interfaces } from "inversify";
import Newable = interfaces.Newable;

describe("Virtual Screen", () => {
  const virtualScreenConstructor = container.get<Newable<VirtualScreenAPI>>(
    TYPES.VirtualScreenService
  );
  let virtualScreen: VirtualScreenAPI;
  describe("Using a non headless device", () => {
    beforeAll(() => {
      const options: VirtualScreenOptions = {
        screenSize: [1280, 720],
        screenId: 0
      };
      virtualScreen = new virtualScreenConstructor(options);
    });
    it("Shouldn't be starting up a new screen buffer", async () => {
      await virtualScreen.startVirtualScreen();
      expect(VirtualScreen.checkAvailableScreen(99)).toEqual(true);
      virtualScreen.stopVirtualScreen();
    });
  });
  describe("Using a headless device", () => {
    const SAMPLE_SCREEN_ID = 99;
    beforeAll(() => {
      const options: VirtualScreenOptions = {
        screenSize: [1280, 720],
        screenId: SAMPLE_SCREEN_ID
      };
      virtualScreen = new virtualScreenConstructor(options);
    });
    it("Should be starting up a new screen buffer", async () => {
      await virtualScreen.startVirtualScreen();
      expect(VirtualScreen.checkAvailableScreen(SAMPLE_SCREEN_ID)).toEqual(
        false
      );
      virtualScreen.stopVirtualScreen();
      expect(VirtualScreen.checkAvailableScreen(SAMPLE_SCREEN_ID)).toEqual(
        true
      );
    });
    it("Should ignore attempts to start a screen buffer on the same id more than once", async () => {
      await virtualScreen.startVirtualScreen();
      expect(VirtualScreen.checkAvailableScreen(SAMPLE_SCREEN_ID)).toEqual(
        false
      );
      await virtualScreen.startVirtualScreen();
      expect(VirtualScreen.checkAvailableScreen(SAMPLE_SCREEN_ID)).toEqual(
        false
      );
    });
  });
});
