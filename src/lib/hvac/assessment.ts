import type { HvacAssessmentSnapshot, HvacSample, HvacScenarioDefinition } from "@/lib/hvac/types";
import { clamp } from "@/lib/hvac/utils";

export class HvacAssessmentEngine {
  private scenario: HvacScenarioDefinition | null = null;
  private initialPv: number | null = null;
  private maxBeyondSp = 0;
  private errorSquared = 0;
  private errorAbs = 0;
  private sampleSeconds = 0;
  private alarmSeconds = 0;
  private alarmIds = new Set<string>();
  private actuatorMovement = 0;
  private saturationSeconds = 0;
  private lastSettledAt: number | null = null;
  private snapshot: HvacAssessmentSnapshot = {
    score: null,
    overshootPct: 0,
    settlingTimeS: null,
    rmse: 0,
    iae: 0,
    ise: 0,
    alarmSeconds: 0,
    alarmCount: 0,
    actuatorMovement: 0,
    saturationSeconds: 0
  };

  reset(scenario: HvacScenarioDefinition | null) {
    this.scenario = scenario;
    this.initialPv = null;
    this.maxBeyondSp = 0;
    this.errorSquared = 0;
    this.errorAbs = 0;
    this.sampleSeconds = 0;
    this.alarmSeconds = 0;
    this.alarmIds = new Set();
    this.actuatorMovement = 0;
    this.saturationSeconds = 0;
    this.lastSettledAt = null;
    this.snapshot = {
      score: null,
      overshootPct: 0,
      settlingTimeS: null,
      rmse: 0,
      iae: 0,
      ise: 0,
      alarmSeconds: 0,
      alarmCount: 0,
      actuatorMovement: 0,
      saturationSeconds: 0
    };
  }

  sample(sample: HvacSample, dtSeconds: number, saturated: boolean) {
    if (this.initialPv === null) {
      this.initialPv = sample.activePv;
    }

    if (sample.simTime <= 60) {
      this.snapshot = { ...this.snapshot, score: this.finalScore() };
      return;
    }

    this.sampleSeconds += dtSeconds;
    this.errorAbs += Math.abs(sample.error) * dtSeconds;
    this.errorSquared += sample.error ** 2 * dtSeconds;
    this.actuatorMovement += Math.abs(sample.primaryMvDelta) * dtSeconds;
    if (saturated) {
      this.saturationSeconds += dtSeconds;
    }
    if (sample.alarms.length) {
      this.alarmSeconds += dtSeconds;
      sample.alarms.forEach((alarm) => this.alarmIds.add(alarm));
    }

    const move = sample.activeSp - this.initialPv;
    if (Math.abs(move) > 0.01) {
      const beyond = move > 0 ? sample.activePv - sample.activeSp : sample.activeSp - sample.activePv;
      this.maxBeyondSp = Math.max(this.maxBeyondSp, beyond);
    }

    if (Math.abs(sample.error) <= 2 && this.lastSettledAt === null) {
      this.lastSettledAt = sample.simTime;
    } else if (Math.abs(sample.error) > 2) {
      this.lastSettledAt = null;
    }

    const rmse = Math.sqrt(this.errorSquared / Math.max(this.sampleSeconds, 0.0001));
    const overshootPct = this.initialPv === null
      ? 0
      : Math.max(0, (this.maxBeyondSp / Math.max(Math.abs(sample.activeSp - this.initialPv), 1)) * 100);

    this.snapshot = {
      score: this.finalScore(overshootPct, rmse),
      overshootPct,
      settlingTimeS: this.lastSettledAt,
      rmse,
      iae: this.errorAbs,
      ise: this.errorSquared,
      alarmSeconds: this.alarmSeconds,
      alarmCount: this.alarmIds.size,
      actuatorMovement: this.actuatorMovement,
      saturationSeconds: this.saturationSeconds
    };
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  finalScore(overshootPct = this.snapshot.overshootPct, rmse = this.snapshot.rmse) {
    if (!this.scenario) {
      return null;
    }
    const criteria = this.scenario.criteria;
    const weights = this.scenario.scoringWeights;
    const settlingRatio =
      this.snapshot.settlingTimeS === null
        ? 1
        : clamp(this.snapshot.settlingTimeS / Math.max(criteria.settlingTimeS, 1), 0, 2);
    const settlingScore = Math.max(0, 100 - settlingRatio * 100);
    const overshootScore = Math.max(0, 100 - overshootPct * 2);
    const rmseScore = Math.max(0, 100 - (rmse / Math.max(criteria.maxRmse, 0.1)) * 50);
    const alarmScore = Math.max(0, 100 - this.alarmIds.size * 10 - Math.max(0, this.alarmSeconds - criteria.alarmLimit));
    const actuatorScore = Math.max(0, 100 - this.actuatorMovement * 0.4);
    const total =
      settlingScore * weights.settling +
      overshootScore * weights.overshoot +
      rmseScore * weights.rmse +
      alarmScore * weights.alarms +
      actuatorScore * (weights.actuator ?? 0);
    return Math.round(clamp(total, 0, 100));
  }
}
