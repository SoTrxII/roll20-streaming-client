export interface RecorderAPI {
  startRecording(): void;

  stopRecording(): AccurateTime;
}
type AccurateTime = [number, number];