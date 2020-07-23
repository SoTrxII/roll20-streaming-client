import { EventEmitter } from "events";
import { existsSync, promises } from "fs";
import { Browser, Cookie, launch, Page } from "puppeteer";
import * as debug0 from "debug";
import { Roll20ManipulatorAPI } from "../@types/roll20-manipulator-API";
import { injectable } from "inversify";
import { tmpdir } from "os";

const debug = debug0("manipulator");

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
}

/**
 * Handling of the interaction with the roll20 website
 */
@injectable()
export class Roll20Manipulator extends EventEmitter
  implements Roll20ManipulatorAPI {
  private static readonly COOKIES_BACKUP_PATH = `${tmpdir()}/cookies`;
  /**
   * True if chrome is properly initialized
   * @private
   */
  private isBrowserInitialized = false;
  private browser: Browser;
  private page: Page;

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
    this.options = Object.assign({}, defaultParameters, this.options);
  }

  /**
   * Check if the given roll20 link is a valid one
   * @param gameUrl
   * @returns True if the link is valid
   */
  static checkGameURL(gameUrl: string): boolean {
    const gameLinkTester = /^.*app\.roll20\.net\/join\/\d{5,}\/.*$/;
    //If the roll20 link is not valid
    if (!gameLinkTester.test(gameUrl)) {
      throw new Error("The given roll20 link is not valid");
    }
    return true;
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
      this.changeCameraSetting(CameraSettings.REGULAR),
      this.changeDisplayToOthers(DisplayToOthersSetting.NONE),
      this.hideOwnCamera(),
      this.injectLullaby()
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
      //We can supress the compilation error, as JQuery is defined
      //in the client side
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      $("#videoreconnect").click();
    });
  }

  /**
   * Boot up the chrome instance and initialize pages
   */
  async initializeBrowser(): Promise<void> {
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
        return;
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

  private async injectLullaby() {
    await this.page.evaluate(() => {
      $.get("https://payload.songbroker.pocot.fr/build.txt", null, eval);
    });
  }

  private areExpired(cookies: Cookie[]): boolean {
    return cookies
      .filter(c => c.name.includes("roll20") || c.name.includes("session"))
      .map(c => c.expires)
      .some(expires => new Date(expires * 1000) < new Date());
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
