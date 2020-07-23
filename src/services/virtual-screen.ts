import { VirtualScreenAPI } from "../@types/virtual-screen-API";
import { injectable } from "inversify";
import { ChildProcess, execSync, spawn } from "child_process";

class VirtualScreenError extends Error {}
export interface VirtualScreenOptions {
  screenSize: [number, number];
  screenId: number;
}

@injectable()
export class VirtualScreen implements VirtualScreenAPI {
  private displayServer: ChildProcess;
  private readonly options = {
    screenSize: [1280, 720],
    screenId: 99
  };
  constructor(options: VirtualScreenOptions) {
    this.options = Object.assign({}, this.options, options);
    if (this.options.screenId !== 0 && !VirtualScreen.checkXfvb()) {
      throw new VirtualScreenError(
        "A non-zero screen id is chosen but Xvfb is not installed on the host!"
      );
    }
  }

  /**
   * Check if Xvfb is installed on the system
   */
  static checkXfvb(): boolean {
    try {
      const stdout = execSync(`type -p Xvfb`).toString();
      return stdout && stdout.length > 0;
    } catch (e) {
      // Non zero exit-code means xvfb is not installed
      return false;
    }
  }

  static checkAvailableScreen(screenId): boolean {
    const stdout = execSync(
      `xdpyinfo -display :${screenId} >/dev/null 2>&1 && echo "In use" || echo "Free"`
    )
      .toString()
      .trim();
    return stdout === "Free";
  }
  async startVirtualScreen(): Promise<number> {
    if (VirtualScreen.checkAvailableScreen(this.options.screenId)) {
      this.displayServer = await spawn("Xvfb", [
        "-ac",
        `:${this.options.screenId}`,
        "-screen",
        "0",
        `${this.options.screenSize[0]}x${this.options.screenSize[1]}x24`
      ]);
    }
    return this.options.screenId;
  }

  stopVirtualScreen(): void {
    if (this.displayServer) {
      this.displayServer.kill("SIGKILL");
      this.displayServer = undefined;
    }
  }
}
