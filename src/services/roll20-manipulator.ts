import { EventEmitter } from "events";
import { existsSync, promises } from "fs";
import { BoundingBox, Browser, Cookie, launch, Page } from "puppeteer";
import * as debug0 from "debug";
import { Roll20ManipulatorAPI } from "../@types/roll20-manipulator-API";
import { injectable } from "inversify";
import { tmpdir } from "os";
import { Roll20AppWindow } from "../@types/roll20-app-window";

const debug = debug0("manipulator");

class ZoomError extends Error {}
export enum CameraSettings {
  NAMES = "names",
  SMALL = "small",
  REGULAR = "regular",
  LARGE = "large"
}

export enum DisplayToOthersSetting {
  BOTH = "both",
  VIDEOONLY = "videoonly",
  VOICEONLY = "voiceonly",
  NONE = "none"
}

export interface Roll20Account {
  login: string;
  password: string;
}

export interface Roll20ManipulatorOptions {
  screenSize: [number, number];
  virtualDisplayId: number;
  baseUrl?: string;
  loginPage?: string;
  editorPage?: (string) => string;
  roll20Id?: number;
  headless?: boolean;
  sinkName?: string;
  defaultVolume?: number;
  customPayloadUrl?: string;
}
/**
 * Handling of the interaction with the roll20 website
 */
@injectable()
export class Roll20Manipulator extends EventEmitter
  implements Roll20ManipulatorAPI {
  private static readonly COOKIES_BACKUP_PATH = `${tmpdir()}/cookies`;
  private static readonly MAX_ZOOM_PERCENTAGE = 250;
  private static readonly MIN_ZOOM_PERCENTAGE = 10;
  /**
   * True if chrome is properly initialized
   * @private
   */
  private isBrowserInitialized = false;
  private browser: Browser;
  private page: Page;
  private currentZoomLevel: number;

  /**
   * @param {Object} account Roll20 Account
   * @param {String} gameUrl Roll20 Invitation link
   * @param {Object} options
   */
  constructor(
    private readonly account: Roll20Account,
    private readonly options?: Roll20ManipulatorOptions
  ) {
    super();
    const defaultParameters = {
      screenSize: [1280, 720],
      virtualDisplayId: 99,
      baseUrl: "https://roll20.net/",
      loginPage: "https://app.roll20.net/sessions/new",
      editorPage: campaignId =>
        `https://app.roll20.net/editor/setcampaign/${campaignId}`,
      roll20Id: 2970803,
      headless: false,
      sinkName: "roll20Sink",
      defaultVolume: 35
    };
    /**
     * @member options
     */
    this.options = Object.assign({}, defaultParameters, options);
  }

  /**
   * Hide Bot Camera frame for the recording
   */
  async hideOwnCamera(): Promise<void> {
    const divsHandles = await this.page.$$("#playerzone .player");

    const promisesArray = divsHandles.map(async handle => {
      const regMatch = await handle.$eval(".video", videoNode => {
        const regId = /background-image: url\(\/users\/avatar\/(\d*)\/.*\);/;
        return videoNode.getAttribute("style").match(regId)[1];
      });
      //Hide player div if it's Velvet cam
      if (parseInt(regMatch) === this.options.roll20Id) {
        await this.page.evaluate(obj => {
          return obj.setAttribute("hidden", "hidden");
        }, handle);
      }
    });
    await Promise.all(promisesArray);
  }

  /**
   * Join the Roll20 Game as a player
   * @fires Roll20Manipulator#logged
   * @fires Roll20Manipulator#joined
   */
  async joinGame(gameUrl: string): Promise<void> {
    if (!this.isBrowserInitialized) {
      await this.initializeBrowser();
    }
    await this.login();
    /**
     * Emitted when the manipulator successfully used provided account to log in the site.
     * @event Roll20Manipulator#logged
     */
    this.emit("logged");
    const editorUrl = this.options.editorPage(gameUrl.match(/\/(\d+)/)[1]);
    await this.page.goto(editorUrl, {
      waitUntil: "domcontentloaded"
    });

    //If it's new game, going directly to the editor should lead to an error.
    //Properly join the game and retry
    if(this.page.url().includes("setcampaign")){
      await this.page.goto(gameUrl)
      await this.page.goto(editorUrl, {
        waitUntil: "domcontentloaded"
      });
    }
    /**
     * Emitted when the manipulator successfully joined a roll20 Campaign
     * @event Roll20Manipulator#joined
     */
    this.emit("joined");
  }
  async setupStreamingSetting(): Promise<void> {
    try {
      await this.page.waitForNavigation({
        timeout: 15000
      });
    } catch (e) {
      //timeout exceeded, no effect
    }

    // By default, cameras are normal-sized and we're not sending
    // any audio/video to other players
    await Promise.all([
      this.injectCustomPayload(),
      this.changeVolume(100),
      this.changeCameraSetting(CameraSettings.SMALL),
      this.changeDisplayToOthers(DisplayToOthersSetting.NONE),
      this.hideOwnCamera(),
      this.hideFloatingToolbar(),
      this.transformSideBar(),
      this.hideZoomToggle()
    ]);
    await this.refreshRTC();
  }

  /**
   * Close the browser instance
   */
  async closeBrowser(): Promise<void> {
    await this.browser.close();
  }

  /**
   * Yield a screenshot of the game, and then deletes it after.
   * @yield screenshotPath
   */
  async *takeScreenshot() {
    const screenshotPath = `/tmp/screenshot${Date.now()}.png`;
    await this.page.screenshot({
      path: screenshotPath
    });
    yield screenshotPath;
    await promises.unlink(screenshotPath);
  }

  /**
   * Change the players camera appearance
   * @param setting new camera setto=ing
   */
  async changeCameraSetting(setting: CameraSettings): Promise<void> {
    await this.page.select("select#videoplayersize", setting);
  }

  async changeVolume(volume: number): Promise<void> {
    await this.page.evaluate(volume => {
      ((window as unknown) as Roll20AppWindow).currentPlayer.save({
        globalvolume: volume.toString()
      });
    }, volume);
  }
  async getZoomLevel(): Promise<number> {
    if (!this.currentZoomLevel) {
      const zoomPercentage: string = (await this.page.evaluate(() => {
        return $("#zoomclick .zoomValue").text();
      })) as string;
      this.currentZoomLevel = Number(zoomPercentage.trim().replace("%", ""));
    }
    return this.currentZoomLevel;
  }

  async changeZoomLevel(targetZoomLevel: number): Promise<void> {
    if (
      targetZoomLevel < Roll20Manipulator.MIN_ZOOM_PERCENTAGE ||
      targetZoomLevel > Roll20Manipulator.MAX_ZOOM_PERCENTAGE
    ) {
      throw new ZoomError("Invalid zoom level provided");
    }
    await this.page.evaluate(targetZoomLevel => {
      $("#zoomslider")
        .data("uiSlider")
        .options.slide(null, { value: targetZoomLevel });
    }, targetZoomLevel);
  }
  getZoomForArea(area: BoundingBox, screen: BoundingBox): number {
    const minZoomWidth = (screen.width / area.width) * 100;
    const minZoomHeight = (screen.height / area.height) * 100;
    return Math.floor(
      Math.max(
        Math.min(minZoomHeight, minZoomWidth),
        Roll20Manipulator.MIN_ZOOM_PERCENTAGE
      )
    );
  }
  async moveToLocation(target: BoundingBox): Promise<void> {
    await this.page.evaluate(
      (x, y) => {
        const wrapper = document.querySelector("#editor-wrapper");
        console.log(
          `top : ${y} - ${wrapper.scrollTop} --> ${y - wrapper.scrollTop}`
        );
        console.log(
          `left : ${x} - ${wrapper.scrollLeft} --> ${x - wrapper.scrollLeft}`
        );
        wrapper.scrollTo({
          behavior: "smooth",
          top: y,
          left: x
        });
      },
      target.x,
      target.y
    );
  }
  async coverArea(area: BoundingBox): Promise<void> {
    const screenBbox: BoundingBox = {
      height: this.options.screenSize[1] - 80,
      width: this.options.screenSize[0] - 30,
      x: 0,
      y: 0
    };
    const zoomLevel = this.getZoomForArea(area, screenBbox);
    await this.changeZoomLevel(zoomLevel);
    await new Promise(res => setTimeout(() => res(), 800));
    await this.moveToLocation({
      x: area.x * (zoomLevel / 100),
      y: area.y * (zoomLevel / 100),
      width: area.width,
      height: area.height
    });
    //$.get("https://cdnjs.cloudflare.com/ajax/libs/fabric.js/4.0.0/fabric.min.js", null, eval)
  }

  /**
   * Change video/audio data ent via roll20 RTC
   * @param setting what to display
   */
  async changeDisplayToOthers(setting: DisplayToOthersSetting): Promise<void> {
    await this.page.select("select#videobroadcasttype", setting);
  }

  /**
   * Refresh RTC connection. Allow cameras to display properly (in theory)
   */
  async refreshRTC(): Promise<void> {
    await this.page.evaluate(() => {
      $("#videoreconnect").trigger("click");
    });
  }

  /**
   * Hide the left floating toolbar in R20 UI
   */
  async hideFloatingToolbar(): Promise<void> {
    await this.page.evaluate(() => {
      $("#floatingtoolbar").hide(0);
    });
  }
  async hideZoomToggle(): Promise<void> {
    await this.page.evaluate(() => {
      $("#zoomclick").hide(0);
    });
  }

  async transformSideBar(): Promise<void> {
    await this.page.evaluate(
      (screenWidth, screenHeight) => {
        const sidebar = $("#rightsidebar");
        // Hide all controls and menus
        $("#textchat-input").hide();
        sidebar.find("ul").hide();
        $("#sidebarcontrol").hide();

        //Overlay the sidebar with the rest of the screen, hiding scroll bars
        sidebar.css({
          "background-color": "transparent",
          background: "none",
          "z-index": 2000,
          "border-left": "none",
          "backdrop-filter": "blur(0.7px)"
        });
        $("#editor-wrapper").css({
          width: `${screenWidth}px`,
          overflow: "hidden"
        });
        $("#playerzone").css({ width: `${screenHeight}px` });
        $("#body").css("overflow", "hidden");
        $(".textchatcontainer").css({
          overflow: "hidden",
          "font-size": "14px",
          color: "white",
          "text-shadow": "0px 0px 3px #000, -1px -1px #000, 1px 1px #000"
        });
        function applyChatStyle() {
          const rollsMessagesAndSpacesSelectors = [
            // System messages
            ".textchatcontainer .message.system .spacer",
            // Players messages
            ".textchatcontainer .message",
            // Spaces between messages
            ".textchatcontainer .message .spacer",
            // Dice "regex" (1d100..)
            ".textchatcontainer .formula",
            // Dice results
            ".textchatcontainer .rolled",
            // Destructured formula (i.e 1d100 +2 = ...)
            ".textchatcontainer .message .formula"
          ];
          $(rollsMessagesAndSpacesSelectors.join(",")).css({
            "background-color": "transparent",
            background: "transparent",
            border: "none",
            "mix-blend-mode": "difference",
            color: "white"
          });
        }

        //Remove system message (R20 welcome message)
        $(".message.system").remove();

        //Adding shadow to avatars
        $(".textchatcontainer .avatar").css({
          "box-shadow": "#ccc 1px 1px 6px 1px"
        });
        // A white Background is hard-coded when a text message is received. Overrides that.
        new MutationObserver(() => applyChatStyle()).observe(
          document.querySelector(".textchatcontainer .content"),
          {
            childList: true
          }
        );
        //Hide the "sidebar" to trigger a redraw for the canvas to gain width, and then redraw the jukebox and chat
        $("#sidebarcontrol").trigger("click");
        $("body").toggleClass("sidebarhidden");

        //Scroll to bottom of chat
        const chat = $("#textchat");
        chat.scrollTop(chat.prop("scrollHeight"));
        //Make all non-text elements in the text chat see-through
        applyChatStyle();
        const element_jukebox = $("#jukebox");
        //Reverse jukebox and chat order to put jukebox on top
        element_jukebox.insertBefore("#textchat");

        //Delete everything except the song progress meter in the jukebox div
        element_jukebox
          .find(".content :not(#jukeboxwhatsplaying, #jukeboxwhatsplaying *)")
          .remove();

        // Apply new color scheme and text shadows
        element_jukebox.find("h4").css({
          "font-size": "14px",
          color: "white",
          "text-shadow": "0px 0px 3px #000, -1px -1px #000, 1px 1px #000"
        });
        //Jukebox is higher than the chat
        element_jukebox.css({
          "z-index": 2005,
          overflow: "hidden"
        });
        function moveChatToBottomLeft() {
          $("#textchat")
            .position({
              my: "bottom right",
              at: "bottom right",
              of: "#rightsidebar"
            })
            .css({
              "margin-top": "125px",
              top: "-125px"
            });
        }
        //Every now ad then, R20 is correcting the chat placement, we have to put it back in place
        new MutationObserver(function(mutations) {
          mutations.forEach(function(mutationRecord) {
            element_jukebox.css({
              display: "block"
            });
            moveChatToBottomLeft();
          });
        }).observe(element_jukebox[0], {
          attributes: true,
          attributeFilter: ["style"]
        });
        function applyStyleToJukebox() {
          element_jukebox.find("h4").css({
            "font-size": "14px",
            color: "white",
            "text-shadow": "0px 0px 3px #000, -1px -1px #000, 1px 1px #000"
          });
        }
        //Reapply style to modified jukebox when a new song is added,
        //as R20 basically destroys and rebuilds it
        new MutationObserver(() => applyStyleToJukebox()).observe(
          element_jukebox.find("#jukeboxwhatsplaying")[0],
          {
            childList: true
          }
        );
        moveChatToBottomLeft();
        applyStyleToJukebox();

        // Display Jukebox and chat at the same time by reducing the absolute height of the Jukebox to the bare minimum
        element_jukebox.css({
          display: "block",
          height: `${Math.max(Math.floor(screenHeight / 4.8), 150)}px`,
          top: "0px",
          right: "10px"
        });
      },
      this.options.screenSize[0],
      this.options.screenSize[1]
    );
  }

  /**
   * Boot up the chrome instance and initialize pages
   */
  async initializeBrowser(): Promise<void> {
    console.log(`DISPLAY : ${this.options.virtualDisplayId}`);
    this.browser = await launch({
      headless: this.options.headless,
      env: Object.assign({}, process.env, {
        DISPLAY: `:${this.options.virtualDisplayId}`,
        PULSE_SINK: this.options.sinkName
      }),
      args: [
        "--start-fullscreen",
        `--window-size=${this.options.screenSize[0]},${this.options.screenSize[1]}`,
        "--disable-infobars",
        "--alsa-output-device=pulse",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--no-default-browser-check",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream"
      ],
      ignoreDefaultArgs: ["--mute-audio", "--enable-automation"]
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: this.options.screenSize[0],
      height: this.options.screenSize[1]
    });
    this.isBrowserInitialized = true;
  }

  async getCookies(): Promise<Cookie[]> {
    return this.page.cookies();
  }

  async login(): Promise<void> {
    if (existsSync(Roll20Manipulator.COOKIES_BACKUP_PATH)) {
      const cookies = await this.readCookies();
      for (const cookie of cookies) {
        await this.page.setCookie(cookie);
      }
      if (!this.areExpired(cookies)) {
        // Quick login strategy, only renew session;
        await this.page.goto(this.options.loginPage, {
          waitUntil: "domcontentloaded"
        });
        //Should be redirected to the editor page when successfull
        if (this.options.loginPage !== this.page.url()) {
          return;
        }
      }
    }
    await this.normalLogin();
    await this.writeCookies(await this.getCookies());
  }

  /**
   * Log into Roll20 platform. Mandatory
   */
  async normalLogin(): Promise<void> {
    await this.page.goto(this.options.loginPage, {
      waitUntil: "domcontentloaded"
    });
    await this.page.type('form.login input[name="email"]', this.account.login);
    await this.page.type(
      'form.login input[name="password"]',
      this.account.password
    );
    await this.page.click('form.login button[type="submit"]');
    await this.page.waitFor(3000);
  }

  private async injectCustomPayload() {
    if (this.options.customPayloadUrl !== undefined) {
      await this.page.evaluate((customPayload: string) => {
        $.get(customPayload, null, eval);
      }, this.options.customPayloadUrl);
    }
  }

  private areExpired(cookies: Cookie[]): boolean {
    return cookies
      .filter(c => c.name.includes("roll20") || c.name.includes("session"))
      .map(c => c.expires)
      .some(expires => expires * 1000 < Date.now());
  }

  private async writeCookies(cookies: Cookie[]): Promise<void> {
    await promises.writeFile(
      Roll20Manipulator.COOKIES_BACKUP_PATH,
      JSON.stringify(cookies, null, 2),
      "utf8"
    );
  }

  private async readCookies(): Promise<Cookie[]> {
    return JSON.parse(
      await promises.readFile(Roll20Manipulator.COOKIES_BACKUP_PATH, "utf8")
    );
  }
}
