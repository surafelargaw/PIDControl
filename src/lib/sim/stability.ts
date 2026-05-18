import type { ProcessModelDefinition, RunMetrics, SimulationSample, StabilityAssessment } from "@/lib/sim/types";

export interface StabilityThresholds {
  settlingBandPct: number;
  overshootLimitPct: number;
  maxSteadyStateOffsetPct: number;
  maxSaturationPct: number;
}

export const defaultStabilityThresholds: StabilityThresholds = {
  settlingBandPct: 5,
  overshootLimitPct: 10,
  maxSteadyStateOffsetPct: 5,
  maxSaturationPct: 18
};

export function assessStability(
  model: ProcessModelDefinition,
  history: SimulationSample[],
  metrics: Omit<RunMetrics, "stability">
): StabilityAssessment {
  const latest = history[history.length - 1];
  const steadyOffsetPct = model.span > 0 ? Math.abs(metrics.steadyStateOffset / model.span) * 100 : 0;
  const advisory: string[] = [];

  if (metrics.oscillation.status === "growing") {
    advisory.push("Oscillation amplitude is still growing. This is unsafe for the final control element.");
  } else if (metrics.oscillation.status === "sustained") {
    advisory.push("The loop is cycling at nearly constant amplitude. Treat this as marginal stability.");
  }

  if (metrics.overshootPct > defaultStabilityThresholds.overshootLimitPct) {
    advisory.push(
      `Overshoot is ${metrics.overshootPct.toFixed(1)}%, which is above the training target of ${defaultStabilityThresholds.overshootLimitPct}%.`
    );
  }

  if (metrics.saturationTime > 0) {
    advisory.push(`Output spent ${metrics.saturationTime.toFixed(1)} seconds pinned at a limit.`);
  }

  if (metrics.settlingTime === null) {
    advisory.push("The loop never settled inside the acceptable band during the recorded run.");
  } else {
    advisory.push(`Settled in ${metrics.settlingTime.toFixed(1)} seconds.`);
  }

  if (steadyOffsetPct > defaultStabilityThresholds.maxSteadyStateOffsetPct) {
    advisory.push("Steady-state error is still too large for an operator-grade stable verdict.");
  } else if (steadyOffsetPct > 1) {
    advisory.push(
      "Residual steady-state offset remains inside the broad stable band, but it is above the fine-tuning target. Shorten Ti or check bias/output authority if zero-error control is expected."
    );
  }

  if (latest && Math.abs(latest.noise) > model.span * 0.01) {
    advisory.push("Measurement noise is materially affecting the PV trend. Validate filtering before chasing gains.");
  }

  const saturationPctOfRun = history.length
    ? (history.filter((sample) => sample.saturationState !== "none").length / history.length) * 100
    : 0;
  const first = history[0];
  const duration = latest && first ? latest.time - first.time : 0;
  const settlingBand = Math.abs(model.span) * (defaultStabilityThresholds.settlingBandPct / 100);
  const currentError = latest ? Math.abs(latest.sp - latest.pv) : 0;
  const severelyUnsettled =
    metrics.settlingTime === null &&
    duration > 120 &&
    currentError > settlingBand * 2;
  const severelySaturated = saturationPctOfRun > defaultStabilityThresholds.maxSaturationPct * 1.5;

  let status: StabilityAssessment["status"] = "stable";
  if (
    metrics.oscillation.status === "growing" ||
    severelyUnsettled ||
    severelySaturated
  ) {
    status = "unstable";
  } else if (
    metrics.oscillation.status === "sustained" ||
    metrics.overshootPct > defaultStabilityThresholds.overshootLimitPct ||
    steadyOffsetPct > defaultStabilityThresholds.maxSteadyStateOffsetPct ||
    saturationPctOfRun > defaultStabilityThresholds.maxSaturationPct ||
    metrics.settlingTime === null
  ) {
    status = "marginal";
  }

  return {
    status,
    settling_band_pct: defaultStabilityThresholds.settlingBandPct,
    settling_time_s: metrics.settlingTime,
    overshoot_pct: metrics.overshootPct,
    steady_state_error: metrics.steadyStateOffset,
    oscillation_class: metrics.oscillation.status,
    saturation_pct_of_run: saturationPctOfRun,
    advisory_messages: advisory
  };
}
