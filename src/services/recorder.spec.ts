import "reflect-metadata";
import { container } from "../inversify.config";
import { TYPES } from "../types";
import { RecorderAPI } from "../@types/recorder";
import { interfaces } from "inversify";
import { ScreenRecorderOptions } from "./recorder";
import Newable = interfaces.Newable;

describe("Recorder", () => {
  const recorderConstructor = container.get<Newable<RecorderAPI>>(
    TYPES.RecordingService
  );
  let recorder: RecorderAPI;

  describe("Record to a file", () => {
    const recordingOptions: ScreenRecorderOptions = {
      fps: 21,
      screenSize: [1280, 720],
      virtualDisplayId: 0,
      target: `/tmp/record-${Date.now()}.mp4`,
      sinkName: "default"
    };
    beforeAll(() => {
      recorder = new recorderConstructor(recordingOptions);
    });
    it("Should be able to record the screen", async () => {
      recorder.startRecording();
      await new Promise((res, rej) => setTimeout(() => res(), 10000));
      recorder.stopRecording();
    }, 15000);
  });
  describe("Record to a stream", () => {
    const recordingOptions: ScreenRecorderOptions = {
      fps: 21,
      screenSize: [1280, 720],
      virtualDisplayId: 0,
      target: `rtmp://localhost/live`,
      sinkName: "roll20Sink"
    };
    beforeAll(() => {
      recorder = new recorderConstructor(recordingOptions);
    });
    it("Should be able to record the screen to a file", async () => {
      recorder.startRecording();
      await new Promise((res, rej) => setTimeout(() => res(), 10000));
      recorder.stopRecording();
    }, 15000);
  });
});
