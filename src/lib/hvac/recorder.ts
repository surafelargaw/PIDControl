import type { HvacSample } from "@/lib/hvac/types";

export class HvacTrendRecorder {
  private samples: HvacSample[] = [];
  private lastRecordedSecond = -1;
  private readonly maxSamples = 3600;

  reset() {
    this.samples = [];
    this.lastRecordedSecond = -1;
  }

  record(sample: HvacSample) {
    const second = Math.floor(sample.simTime);
    if (second <= this.lastRecordedSecond) {
      return;
    }
    this.lastRecordedSecond = second;
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  get all() {
    return [...this.samples];
  }

  getWindow(windowSeconds: number) {
    if (!this.samples.length || windowSeconds <= 0) {
      return this.all;
    }
    const latest = this.samples[this.samples.length - 1].simTime;
    return this.samples.filter((sample) => sample.simTime >= latest - windowSeconds);
  }
}
