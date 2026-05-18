import { analyzeOscillationFromHistory } from "@/lib/sim/engine";
import { assessStability, defaultStabilityThresholds } from "@/lib/sim/stability";
import type { ProcessModelDefinition, RunMetrics, SimulationSample } from "@/lib/sim/types";
import { average, sumTravel } from "@/lib/sim/utils";

export function calculateRunMetrics(
  history: SimulationSample[],
  model: ProcessModelDefinition
): RunMetrics {
  const latest = history[history.length - 1];
  const pvValues = history.map((sample) => sample.pv);
  const coTravel = sumTravel(history, (sample) => sample.co);
  const valveTravel = sumTravel(history, (sample) => sample.valvePosition ?? sample.co);
  const overshootPct = calculateOvershootPct(history);
  const riseTime = calculateRiseTime(history);
  const settlingTime = calculateSettlingTime(history, model.span, defaultStabilityThresholds.settlingBandPct);
  const steadyStateOffset = calculateSteadyStateOffset(history);
  const iae = integrateError(history, (sample) => Math.abs(sample.sp - sample.pv));
  const ise = integrateError(history, (sample) => (sample.sp - sample.pv) ** 2);
  const itae = integrateError(history, (sample) => sample.time * Math.abs(sample.sp - sample.pv));
  const disturbanceRecoveryTime = calculateDisturbanceRecoveryTime(
    history,
    model.span,
    defaultStabilityThresholds.settlingBandPct
  );
  const saturationTime = calculateSaturationTime(history);
  const oscillation = analyzeOscillationFromHistory(history, Math.max(40, latest?.time ? latest.time * 0.4 : 40), model);

  const baseMetrics = {
    currentError: latest ? latest.sp - latest.pv : 0,
    pvRange: pvValues.length ? Math.max(...pvValues) - Math.min(...pvValues) : 0,
    coTravel,
    valveTravel,
    riseTime,
    settlingTime,
    overshootPct,
    steadyStateOffset,
    iae,
    ise,
    itae,
    disturbanceRecoveryTime,
    saturationTime,
    oscillation
  };

  return {
    ...baseMetrics,
    stability: assessStability(model, history, baseMetrics)
  };
}

function calculateOvershootPct(history: SimulationSample[]) {
  if (history.length < 2) {
    return 0;
  }
  const latestSp = history[history.length - 1].sp;
  const initialPv = history[0].pv;
  const move = latestSp - initialPv;
  if (Math.abs(move) < 0.000001) {
    return 0;
  }

  const peak = move > 0 ? Math.max(...history.map((sample) => sample.pv)) : Math.min(...history.map((sample) => sample.pv));
  const overshoot = move > 0 ? peak - latestSp : latestSp - peak;
  return Math.max(0, (overshoot / Math.abs(move)) * 100);
}

function calculateRiseTime(history: SimulationSample[]) {
  if (history.length < 3) {
    return null;
  }
  const start = history[0];
  const end = history[history.length - 1];
  const delta = end.sp - start.pv;
  if (Math.abs(delta) < 0.000001) {
    return null;
  }
  const lowTarget = start.pv + delta * 0.1;
  const highTarget = start.pv + delta * 0.9;
  const low = history.find((sample) => (delta > 0 ? sample.pv >= lowTarget : sample.pv <= lowTarget));
  const high = history.find((sample) => (delta > 0 ? sample.pv >= highTarget : sample.pv <= highTarget));
  if (!low || !high) {
    return null;
  }
  return Math.max(0, high.time - low.time);
}

function calculateSettlingTime(history: SimulationSample[], span: number, settlingBandPct: number) {
  if (!history.length) {
    return null;
  }
  const endSp = history[history.length - 1].sp;
  const band = Math.abs(span) * (settlingBandPct / 100);

  for (let index = 0; index < history.length; index += 1) {
    const sample = history[index];
    const tail = history.slice(index);
    const settled = tail.every((tailSample) => Math.abs(tailSample.pv - endSp) <= band);
    if (settled) {
      return sample.time;
    }
  }
  return null;
}

function calculateSteadyStateOffset(history: SimulationSample[]) {
  if (!history.length) {
    return 0;
  }
  const tail = history.slice(-Math.min(history.length, 50));
  const averagePv = average(tail.map((sample) => sample.pv));
  const averageSp = average(tail.map((sample) => sample.sp));
  return averageSp - averagePv;
}

function integrateError(history: SimulationSample[], selector: (sample: SimulationSample) => number) {
  let total = 0;
  for (let index = 1; index < history.length; index += 1) {
    const dt = history[index].time - history[index - 1].time;
    total += selector(history[index]) * dt;
  }
  return total;
}

function calculateDisturbanceRecoveryTime(history: SimulationSample[], span: number, settlingBandPct: number) {
  const threshold = 0.03;
  let lastChangeTime: number | null = null;

  for (let index = 1; index < history.length; index += 1) {
    if (Math.abs(history[index].disturbance - history[index - 1].disturbance) > threshold) {
      lastChangeTime = history[index].time;
    }
  }

  if (lastChangeTime === null) {
    return null;
  }

  const band = Math.abs(span) * (settlingBandPct / 100);
  const recovery = history.find(
    (sample) => sample.time >= lastChangeTime && Math.abs(sample.pv - sample.sp) <= band
  );

  return recovery ? Math.max(0, recovery.time - lastChangeTime) : null;
}

function calculateSaturationTime(history: SimulationSample[]) {
  let total = 0;
  for (let index = 1; index < history.length; index += 1) {
    if (history[index].saturationState !== "none") {
      total += history[index].time - history[index - 1].time;
    }
  }
  return total;
}
