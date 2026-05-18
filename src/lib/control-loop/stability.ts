import type { OscillationClass, StabilityStatus } from "@/lib/sim/types";

export interface ControlTrendSample {
  time: number;
  sp: number;
  pv: number;
  mv: number;
  saturated?: boolean;
}

export interface ControlTrendStability {
  status: StabilityStatus;
  settlingTimeS: number | null;
  overshootPct: number;
  steadyStateError: number;
  oscillationClass: OscillationClass;
  saturationPctOfRun: number;
  currentError: number;
  mvTravel: number;
  advisoryMessages: string[];
}

export function assessControlTrendStability({
  samples,
  span,
  settlingBandPct = 5,
  overshootLimitPct = 12,
  maxSteadyStateOffsetPct = 5,
  maxSaturationPct = 18,
  minimumSamples = 20
}: {
  samples: ControlTrendSample[];
  span: number;
  settlingBandPct?: number;
  overshootLimitPct?: number;
  maxSteadyStateOffsetPct?: number;
  maxSaturationPct?: number;
  minimumSamples?: number;
}): ControlTrendStability {
  const validSamples = samples.filter(
    (sample) =>
      Number.isFinite(sample.time) &&
      Number.isFinite(sample.sp) &&
      Number.isFinite(sample.pv) &&
      Number.isFinite(sample.mv)
  );
  const effectiveSpan = Math.max(
    span,
    ...validSamples.map((sample) => Math.abs(sample.sp - sample.pv)),
    1
  );
  const settlingBand = (settlingBandPct / 100) * effectiveSpan;
  const advisoryMessages: string[] = [];

  if (validSamples.length < minimumSamples) {
    return {
      status: "marginal",
      settlingTimeS: null,
      overshootPct: 0,
      steadyStateError: 0,
      oscillationClass: "none",
      saturationPctOfRun: 0,
      currentError: 0,
      mvTravel: 0,
      advisoryMessages: ["Collecting trend data before issuing a stability verdict."]
    };
  }

  const latest = validSamples[validSamples.length - 1];
  const errors = validSamples.map((sample) => sample.sp - sample.pv);
  const currentError = latest.sp - latest.pv;
  const tail = validSamples.slice(-Math.max(8, Math.ceil(validSamples.length * 0.15)));
  const steadyStateError =
    tail.reduce((total, sample) => total + (sample.sp - sample.pv), 0) / Math.max(tail.length, 1);
  const steadyStateErrorPct = (Math.abs(steadyStateError) / effectiveSpan) * 100;

  let settlingTimeS: number | null = null;
  for (let index = 0; index < validSamples.length; index += 1) {
    const remainingSamples = validSamples.slice(index);
    if (remainingSamples.every((sample) => Math.abs(sample.sp - sample.pv) <= settlingBand)) {
      settlingTimeS = validSamples[index].time - validSamples[0].time;
      break;
    }
  }

  const first = validSamples[0];
  const target = latest.sp;
  const direction = Math.sign(target - first.pv);
  let overshoot = 0;
  if (direction > 0) {
    overshoot = Math.max(0, Math.max(...validSamples.map((sample) => sample.pv)) - target);
  } else if (direction < 0) {
    overshoot = Math.max(0, target - Math.min(...validSamples.map((sample) => sample.pv)));
  } else {
    overshoot = Math.max(0, ...validSamples.map((sample) => Math.abs(sample.pv - target)));
  }
  const overshootPct = (overshoot / effectiveSpan) * 100;

  const recent = validSamples.slice(-Math.min(validSamples.length, 160));
  const recentErrors = recent.map((sample) => sample.sp - sample.pv);
  let zeroCrossings = 0;
  for (let index = 1; index < recentErrors.length; index += 1) {
    const previous = recentErrors[index - 1];
    const current = recentErrors[index];
    if (Math.sign(previous) !== 0 && Math.sign(current) !== 0 && Math.sign(previous) !== Math.sign(current)) {
      zeroCrossings += 1;
    }
  }
  const firstThird = recentErrors.slice(0, Math.max(1, Math.floor(recentErrors.length / 3)));
  const lastThird = recentErrors.slice(-Math.max(1, Math.floor(recentErrors.length / 3)));
  const firstAmplitude = Math.max(...firstThird.map(Math.abs), 0.0001);
  const lastAmplitude = Math.max(...lastThird.map(Math.abs), 0.0001);
  let oscillationClass: OscillationClass = "none";
  if (zeroCrossings >= 5 && lastAmplitude > firstAmplitude * 1.15) {
    oscillationClass = "growing";
  } else if (zeroCrossings >= 4 && lastAmplitude > firstAmplitude * 0.65) {
    oscillationClass = "sustained";
  } else if (zeroCrossings >= 3) {
    oscillationClass = "decaying";
  }

  const saturationPctOfRun =
    (validSamples.filter((sample) => sample.saturated).length / validSamples.length) * 100;
  const mvTravel = validSamples.slice(1).reduce(
    (total, sample, index) => total + Math.abs(sample.mv - validSamples[index].mv),
    0
  );
  const duration = latest.time - first.time;

  if (oscillationClass === "growing") {
    advisoryMessages.push("Oscillation amplitude is growing. Reduce loop aggressiveness before continuing.");
  } else if (oscillationClass === "sustained") {
    advisoryMessages.push("The loop is cycling at a roughly sustained amplitude. Treat this as marginal stability.");
  } else if (oscillationClass === "decaying") {
    advisoryMessages.push("Oscillation appears to be decaying, but keep watching the final element movement.");
  }

  if (overshootPct > overshootLimitPct) {
    advisoryMessages.push(`Overshoot is ${overshootPct.toFixed(1)}%, above the ${overshootLimitPct}% target.`);
  }

  if (settlingTimeS === null) {
    advisoryMessages.push("The loop has not stayed inside the settling band during the visible trend.");
  } else {
    advisoryMessages.push(`Settled inside the ${settlingBandPct}% band in ${settlingTimeS.toFixed(1)} seconds.`);
  }

  if (steadyStateErrorPct > maxSteadyStateOffsetPct) {
    advisoryMessages.push("Steady-state error remains outside the stable training target.");
  }

  if (saturationPctOfRun > maxSaturationPct) {
    advisoryMessages.push(`Output saturation is ${saturationPctOfRun.toFixed(1)}% of the visible trend.`);
  }

  let status: StabilityStatus = "stable";
  if (
    oscillationClass === "growing" ||
    saturationPctOfRun > maxSaturationPct * 1.5 ||
    (duration > 120 && settlingTimeS === null && Math.abs(currentError) > settlingBand * 2)
  ) {
    status = "unstable";
  } else if (
    oscillationClass === "sustained" ||
    oscillationClass === "decaying" ||
    overshootPct > overshootLimitPct ||
    steadyStateErrorPct > maxSteadyStateOffsetPct ||
    saturationPctOfRun > maxSaturationPct ||
    settlingTimeS === null
  ) {
    status = "marginal";
  }

  if (!advisoryMessages.length) {
    advisoryMessages.push("The visible trend is settled, non-oscillatory, and clear of output saturation.");
  }

  return {
    status,
    settlingTimeS,
    overshootPct,
    steadyStateError,
    oscillationClass,
    saturationPctOfRun,
    currentError,
    mvTravel,
    advisoryMessages
  };
}
