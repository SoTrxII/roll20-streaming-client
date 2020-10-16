import {AccurateTime, RecorderAPI} from "../@types/recorder";
import { injectable } from "inversify";
import * as ffmpeg from "fluent-ffmpeg";
import { FfmpegCommand } from "fluent-ffmpeg";
import { EventEmitter } from "events";
import { hrtime } from 'process';

export interface ScreenRecorderOptions {
  screenSize?: [number, number];
  virtualDisplayId?: number;
  fps?: number;
  maxRate?: string | number;
  bufSize?: string | number;
  target: string;
  sinkName?: string;
}

@injectable()
export class Recorder extends EventEmitter implements RecorderAPI {
  protected readonly options: ScreenRecorderOptions = {
    screenSize: [1280, 720],
    virtualDisplayId: 99,
    fps: 21,
    maxRate: "8000k",
    bufSize: "24000k",
    target: null,
    sinkName: "roll20Sink"
  };
  private isKilledOnPurpose: boolean;
  private recordingProcess: FfmpegCommand;
  private sinkMonitor: string;
  private startDate: AccurateTime;

  constructor(options?: ScreenRecorderOptions) {
    super();
    this.options = Object.assign({}, this.options, options);
    this.sinkMonitor =
      this.options.sinkName !== "default"
        ? this.options.sinkName + ".monitor"
        : this.options.sinkName;
  }

  startRecording(): void {
    this.recordingProcess = ffmpeg()
      .input(`:${this.options.virtualDisplayId}.0+0,0`)
      .inputOption(
        `-s ${this.options.screenSize[0]}x${this.options.screenSize[1]}`
      )
      .inputOption("-draw_mouse 0")
      .inputOption(`-framerate ${this.options.fps}`)
      .inputFormat("x11grab")
      .input(`${this.sinkMonitor}`)
      .inputFormat("pulse");

    //Events
    this.recordingProcess
      .on("start", commandLine => {
        console.log(commandLine);
        this.startDate = hrtime();
        this.emit("start", commandLine);
      })
      .on("stdout", stdoutLine => {
        //console.log(stdoutLine);
      })
      .on("progress", progress => {
        this.emit("progress", progress);
      })
      .on("stderr", stderrLine => {
        this.emit("stderr", stderrLine);
        //console.error(stderrLine);
      })
      .on("error", err => {
        console.error(err);
        if (!this.isKilledOnPurpose) {
          this.emit("error", err);
        } else {
          this.isKilledOnPurpose = false;
        }
      })
      .on("end", () => {
        this.emit("end");
      });
    //Output options
    this.recordingProcess
      //.outputOption("-qscale 0")
      .outputOption("-b:v 1984k")
      .outputOption("-ac 2")
      .outputOption("-b:a 128k")
      .outputOption("-c:a aac")
      .outputOption("-ar 44100")
      .outputOption(`-g ${this.options.fps * 2}`)
      .outputOption("-c:v libx264")
      .outputOption(`-vf format=yuv420p`)
      .outputOption(`-maxrate ${this.options.maxRate}`)
      .outputOption(`-bufsize ${this.options.bufSize}`)
      .outputOption("-preset ultrafast")
      .format("flv")
      .save(this.options.target);
  }

  stopRecording(): AccurateTime {
    //Mask the exit error as we are killing it on purpose.
    this.isKilledOnPurpose = true;
    this.recordingProcess.kill("SIGKILL");
    return this.startDate;
  }
}
