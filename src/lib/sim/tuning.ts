import {
  analyzeOscillationFromHistory,
  buildEmptySignals,
  createRuntimeForConfig,
  findResponseCrossingTime,
  getTuningStudyDuration,
  advanceSimulationStep,
  cloneControllerConfig,
  cloneProcessOptions
} from "@/lib/sim/engine";
import { calculateRunMetrics } from "@/lib/sim/metrics";
import type {
  ControllerAlgorithm,
  ControllerConfig,
  FineTuneAdvice,
  ProcessModelDefinition,
  ProcessOptions,
  TuningRecommendation,
  TuningStudyResult
} from "@/lib/sim/types";
import { average, clamp } from "@/lib/sim/utils";

export type TuningMethod =
  | "cohenCoon"
  | "zieglerNichols"
  | "tyreusLuyben"
  | "relayAutotune"
  | "imcLambda"
  | "bumpTest";

export function buildCleanTuningProcessOptions(model: ProcessModelDefinition): ProcessOptions {
  return {
    ...cloneProcessOptions(model.defaultOptions),
    noiseLevel: 0,
    disturbanceProfile: "none",
    disturbanceIntensity: 0,
    showValveFeedback: false,
    valveDeadband: 0,
    valveStiction: 0,
    valveOvershoot: 0,
    backlash: 0,
    upsetMagnitude: 0,
    upsetProbability: 0
  };
}

export function buildTuningControllerBase(
  model: ProcessModelDefinition,
  currentController?: ControllerConfig
): ControllerConfig {
  const basis = currentController ? cloneControllerConfig(currentController) : cloneControllerConfig(model.defaultController);
  return {
    ...basis,
    algorithm: "PID",
    form: "standard",
    spFilterEnabled: false,
    spFilterTime: 0,
    pvFilterEnabled: false,
    pvFilterTime: 0,
    outputDeadband: 0,
    mode: "auto",
    operatingMode: "single",
    bias: clamp(basis.bias, model.processParams.outputMin, model.processParams.outputMax),
    manualOutput: clamp(basis.bias, model.processParams.outputMin, model.processParams.outputMax),
    outputLimits: {
      min: model.processParams.outputMin,
      max: model.processParams.outputMax
    }
  };
}

export function runTuningStudy(args: {
  model: ProcessModelDefinition;
  method: TuningMethod;
  targetAlgorithm: ControllerAlgorithm;
  stepSize?: number;
  relayAmplitude?: number;
  relayRule?: "zieglerNichols" | "tyreusLuyben";
  lambdaFactor?: number;
  currentController?: ControllerConfig;
}): TuningStudyResult {
  const {
    model,
    method,
    targetAlgorithm,
    stepSize = 8,
    relayAmplitude = 10,
    relayRule = "zieglerNichols",
    lambdaFactor = 2.2,
    currentController
  } = args;

  switch (method) {
    case "cohenCoon":
      return runCohenCoonStudy(model, targetAlgorithm, stepSize, currentController);
    case "zieglerNichols":
      return runUltimateGainStudy(model, targetAlgorithm, "zieglerNichols", currentController, relayAmplitude);
    case "tyreusLuyben":
      return runUltimateGainStudy(model, targetAlgorithm, "tyreusLuyben", currentController, relayAmplitude);
    case "relayAutotune":
      return runRelayAutotuneStudy(model, targetAlgorithm, relayRule, relayAmplitude, currentController);
    case "imcLambda":
      return runImcLambdaStudy(model, targetAlgorithm, lambdaFactor, currentController);
    case "bumpTest":
      return runBumpTestStudy(model, stepSize, currentController);
    default:
      return { method, note: "Unsupported tuning study." };
  }
}

export function calculateCohenCoonRecommendation(
  algorithm: ControllerAlgorithm,
  gainMagnitude: number,
  tauDel: number,
  r: number
): TuningRecommendation {
  if (algorithm === "P") {
    return {
      algorithm,
      kp: (1 / (r * gainMagnitude)) * (1 + r / 3)
    };
  }

  if (algorithm === "PI") {
    return {
      algorithm,
      kp: (1 / (r * gainMagnitude)) * (0.9 + r / 12),
      ti: tauDel * ((30 + 3 * r) / (9 + 20 * r))
    };
  }

  return {
    algorithm,
    kp: (1 / (r * gainMagnitude)) * (4 / 3 + r / 4),
    ti: tauDel * ((32 + 6 * r) / (13 + 8 * r)),
    td: tauDel * (4 / (11 + 2 * r))
  };
}

export function calculateZieglerNicholsRecommendation(algorithm: ControllerAlgorithm, Ku: number, Pu: number) {
  if (algorithm === "P") {
    return { algorithm, kp: Ku / 2 };
  }
  if (algorithm === "PI") {
    return { algorithm, kp: Ku / 2.2, ti: Pu / 1.2 };
  }
  return { algorithm, kp: Ku / 1.7, ti: Pu / 2, td: Pu / 8 };
}

export function calculateTyreusLuybenRecommendation(algorithm: ControllerAlgorithm, Ku: number, Pu: number) {
  if (algorithm === "PI") {
    return { algorithm, kp: Ku / 3.2, ti: 2.2 * Pu };
  }
  return { algorithm, kp: Ku / 2.2, ti: 2.2 * Pu, td: Pu / 6.3 };
}

export function calculateImcLambdaRecommendation(
  algorithm: ControllerAlgorithm,
  gainMagnitude: number,
  tau: number,
  deadTime: number,
  lambdaFactor: number
): TuningRecommendation {
  const lambda = Math.max(deadTime, tau * lambdaFactor);
  const kp = tau / (gainMagnitude * (lambda + deadTime));

  if (algorithm === "P") {
    return { algorithm, kp };
  }
  if (algorithm === "PI") {
    return { algorithm, kp, ti: tau + deadTime / 2 };
  }
  return {
    algorithm,
    kp,
    ti: tau + deadTime / 2,
    td: (tau * deadTime) / Math.max(2 * tau + deadTime, 0.1)
  };
}

export function runCohenCoonStudy(
  model: ProcessModelDefinition,
  targetAlgorithm: ControllerAlgorithm,
  stepSize: number,
  currentController?: ControllerConfig
): TuningStudyResult {
  const processOptions = buildCleanTuningProcessOptions(model);
  const controllerConfig = buildTuningControllerBase(model, currentController);
  controllerConfig.mode = "manual";

  const baselineOutput = clamp(controllerConfig.bias, controllerConfig.outputLimits.min, controllerConfig.outputLimits.max);
  const proposedHigh = clamp(
    baselineOutput + stepSize,
    controllerConfig.outputLimits.min,
    controllerConfig.outputLimits.max
  );
  const proposedLow = clamp(
    baselineOutput - stepSize,
    controllerConfig.outputLimits.min,
    controllerConfig.outputLimits.max
  );
  const steppedOutput =
    Math.abs(proposedHigh - baselineOutput) >= Math.abs(proposedLow - baselineOutput) ? proposedHigh : proposedLow;
  const actualStep = steppedOutput - baselineOutput;

  if (Math.abs(actualStep) < 0.25) {
    return {
      method: "cohenCoon",
      note: "The requested open-loop step is too small after output limiting. Increase the step size or widen the output range."
    };
  }

  const t0 = 5;
  const totalDuration = getTuningStudyDuration(model, 260);
  const runtime = createRuntimeForConfig(model, controllerConfig, processOptions, model.initialPV);

  while (runtime.time < totalDuration) {
    controllerConfig.manualOutput = runtime.time >= t0 ? steppedOutput : baselineOutput;
    advanceSimulationStep(
      runtime,
      runtime.baseDt,
      model,
      { setpoint: model.initialPV, controllerConfig, processOptions },
      buildEmptySignals()
    );
  }

  const history = runtime.history;
  const tailSamples = history.filter((sample) => sample.time >= totalDuration - Math.min(20, totalDuration / 4));
  const initialPv = model.initialPV;
  const finalPv = average(tailSamples.map((sample) => sample.pv));
  const B = finalPv - initialPv;
  const gainMagnitude = Math.abs(B / actualStep);

  if (!Number.isFinite(gainMagnitude) || gainMagnitude < 0.000001) {
    return {
      method: "cohenCoon",
      note: "The open-loop study did not produce a usable process gain. Try a larger step or a different model."
    };
  }

  const t2 = findResponseCrossingTime(history, t0, initialPv, B * 0.5);
  const t3 = findResponseCrossingTime(history, t0, initialPv, B * 0.632);
  if (t2 === null || t3 === null) {
    return {
      method: "cohenCoon",
      note: "The step response did not reach the 50% and 63.2% points needed for the Cohen-Coon parameter fit."
    };
  }

  const denominator = 1 - Math.log(2);
  const t1 = (t2 - Math.log(2) * t3) / denominator;
  const tau = t3 - t1;
  const tauDel = t1 - t0;
  const r = tauDel / tau;

  if (!Number.isFinite(tau) || !Number.isFinite(tauDel) || tau <= 0 || tauDel <= 0 || r <= 0) {
    return {
      method: "cohenCoon",
      note: "The fitted process values were non-physical. Try a different model or step size."
    };
  }

  return {
    method: "cohenCoon",
    note: "Open-loop step test evaluated with the 50% and 63.2% response landmarks.",
    process: {
      stepOutput: actualStep,
      finalChange: B,
      gainMagnitude,
      t0,
      t1,
      t2,
      t3,
      tau,
      tauDel,
      r
    },
    recommended: calculateCohenCoonRecommendation(targetAlgorithm, gainMagnitude, tauDel, r)
  };
}

export function runUltimateGainStudy(
  model: ProcessModelDefinition,
  targetAlgorithm: ControllerAlgorithm,
  ruleFamily: "zieglerNichols" | "tyreusLuyben",
  currentController?: ControllerConfig,
  relayAmplitude = 10
): TuningStudyResult {
  const closedLoop = estimateUltimateGainByPControl(model, currentController);
  if (!closedLoop) {
    const relayFallback = runRelayAutotuneStudy(model, targetAlgorithm, ruleFamily, relayAmplitude, currentController);
    if (!relayFallback.recommended) {
      return {
        method: ruleFamily,
        note: "The simulator could not find a usable ultimate-gain oscillation, and the relay fallback also failed."
      };
    }
    return {
      method: ruleFamily,
      note: "Closed-loop P-only oscillation did not converge cleanly, so the app fell back to relay autotune.",
      relay: relayFallback.relay,
      closedLoop: relayFallback.closedLoop,
      recommended: relayFallback.recommended
    };
  }

  return {
    method: ruleFamily,
    note: "Closed-loop P-only study estimated Ku and the oscillation period Pu.",
    closedLoop,
    recommended:
      ruleFamily === "zieglerNichols"
        ? calculateZieglerNicholsRecommendation(targetAlgorithm, closedLoop.Ku, closedLoop.Pu ?? 1)
        : calculateTyreusLuybenRecommendation(targetAlgorithm, closedLoop.Ku, closedLoop.Pu ?? 1)
  };
}

export function runRelayAutotuneStudy(
  model: ProcessModelDefinition,
  targetAlgorithm: ControllerAlgorithm,
  relayRule: "zieglerNichols" | "tyreusLuyben",
  relayAmplitude: number,
  currentController?: ControllerConfig
): TuningStudyResult {
  const processOptions = buildCleanTuningProcessOptions(model);
  const controllerConfig = buildTuningControllerBase(model, currentController);
  controllerConfig.mode = "manual";

  const centerOutput = clamp(controllerConfig.bias, controllerConfig.outputLimits.min, controllerConfig.outputLimits.max);
  const highOutput = clamp(centerOutput + relayAmplitude, controllerConfig.outputLimits.min, controllerConfig.outputLimits.max);
  const lowOutput = clamp(centerOutput - relayAmplitude, controllerConfig.outputLimits.min, controllerConfig.outputLimits.max);
  const effectiveH = (highOutput - lowOutput) / 2;
  if (effectiveH <= 0.1) {
    return {
      method: "relayAutotune",
      note: "The relay half-amplitude collapsed after output limiting. Increase h or widen the output range."
    };
  }

  const setpoint = model.initialPV;
  const directionSign = model.controllerDirection === "direct" ? 1 : -1;
  const totalDuration = getTuningStudyDuration(model, 320);
  const runtime = createRuntimeForConfig(model, controllerConfig, processOptions, setpoint);

  while (runtime.time < totalDuration) {
    const error = setpoint - runtime.process.pv;
    controllerConfig.manualOutput =
      directionSign > 0 ? (error >= 0 ? highOutput : lowOutput) : error >= 0 ? lowOutput : highOutput;
    advanceSimulationStep(
      runtime,
      runtime.baseDt,
      model,
      { setpoint, controllerConfig, processOptions },
      buildEmptySignals()
    );
  }

  const oscillation = analyzeOscillationFromHistory(runtime.history, Math.max(40, totalDuration * 0.35), model);
  if (!oscillation.period || !Number.isFinite(oscillation.amplitude) || oscillation.amplitude <= 0) {
    return {
      method: "relayAutotune",
      note: "The relay study did not produce a clean limit cycle. Try a different model or a larger relay amplitude."
    };
  }

  const Ku = (4 * effectiveH) / (Math.PI * oscillation.amplitude);
  const recommended =
    relayRule === "zieglerNichols"
      ? calculateZieglerNicholsRecommendation(targetAlgorithm, Ku, oscillation.period)
      : calculateTyreusLuybenRecommendation(targetAlgorithm, Ku, oscillation.period);

  return {
    method: "relayAutotune",
    note: "Relay limit-cycle study estimated Ku from Ku = 4h / (pi a).",
    relay: { h: effectiveH, a: oscillation.amplitude },
    closedLoop: { Ku, Pu: oscillation.period, classification: oscillation.status },
    recommended
  };
}

export function runImcLambdaStudy(
  model: ProcessModelDefinition,
  targetAlgorithm: ControllerAlgorithm,
  lambdaFactor: number,
  currentController?: ControllerConfig
): TuningStudyResult {
  const cc = runCohenCoonStudy(model, targetAlgorithm, 8, currentController);
  if (!cc.process) {
    return {
      method: "imcLambda",
      note: "IMC/Lambda needs a usable bump-test fit, but the model fit did not converge."
    };
  }

  const recommendation = calculateImcLambdaRecommendation(
    targetAlgorithm,
    cc.process.gainMagnitude,
    cc.process.tau,
    cc.process.tauDel,
    lambdaFactor
  );

  return {
    method: "imcLambda",
    note: `IMC/Lambda selected a calmer closed-loop target with lambda factor ${lambdaFactor.toFixed(1)}.`,
    process: cc.process,
    recommended: recommendation
  };
}

export function runBumpTestStudy(
  model: ProcessModelDefinition,
  stepSize: number,
  currentController?: ControllerConfig
): TuningStudyResult {
  const cc = runCohenCoonStudy(model, "PID", stepSize, currentController);
  if (!cc.process) {
    return {
      method: "bumpTest",
      note: "The open-loop bump test did not produce a usable first-order estimate."
    };
  }

  return {
    method: "bumpTest",
    note: "Open-loop bump test captured gain, deadtime, and lag for operator review.",
    process: cc.process
  };
}

export function estimateUltimateGainByPControl(model: ProcessModelDefinition, currentController?: ControllerConfig) {
  const candidates = [0.1, 0.16, 0.25, 0.4, 0.63, 1, 1.6, 2.5, 4, 6.3, 10, 16, 25, 40, 63, 100];
  let lowerCandidate: { kp: number; analysis: ReturnType<typeof analyzeOscillationFromHistory> } | null = null;
  let upperCandidate: { kp: number; analysis: ReturnType<typeof analyzeOscillationFromHistory> } | null = null;

  for (const candidate of candidates) {
    const analysis = simulatePOnlyOscillation(model, candidate, currentController);
    if (analysis.status === "sustained" || analysis.status === "growing") {
      upperCandidate = { kp: candidate, analysis };
      break;
    }
    lowerCandidate = { kp: candidate, analysis };
  }

  if (!upperCandidate) {
    return null;
  }

  let lower = lowerCandidate ? lowerCandidate.kp : upperCandidate.kp / 2;
  let upper = upperCandidate.kp;
  let best =
    upperCandidate.analysis.status === "sustained"
      ? { kp: upperCandidate.kp, analysis: upperCandidate.analysis }
      : null;

  for (let index = 0; index < 8; index += 1) {
    const mid = (lower + upper) / 2;
    const analysis = simulatePOnlyOscillation(model, mid, currentController);
    if (analysis.status === "sustained") {
      best = { kp: mid, analysis };
      upper = mid;
    } else if (analysis.status === "growing") {
      upper = mid;
    } else {
      lower = mid;
    }
  }

  const selected = best || upperCandidate;
  return {
    Ku: selected.kp,
    Pu: selected.analysis.period,
    classification: selected.analysis.status
  };
}

export function simulatePOnlyOscillation(
  model: ProcessModelDefinition,
  kp: number,
  currentController?: ControllerConfig
) {
  const processOptions = buildCleanTuningProcessOptions(model);
  const controllerConfig = buildTuningControllerBase(model, currentController);
  controllerConfig.algorithm = "P";
  controllerConfig.form = "standard";
  controllerConfig.kp = kp;
  controllerConfig.td = 0;

  const directionSign = model.controllerDirection === "direct" ? 1 : -1;
  const baselineSp = model.initialPV;
  const stepSp = clamp(
    baselineSp + directionSign * Math.max(model.span * 0.08, model.span * 0.02),
    model.displayMin,
    model.displayMax
  );
  const t0 = 5;
  const totalDuration = getTuningStudyDuration(model, 320);
  const runtime = createRuntimeForConfig(model, controllerConfig, processOptions, baselineSp);

  while (runtime.time < totalDuration) {
    const activeSp = runtime.time >= t0 ? stepSp : baselineSp;
    advanceSimulationStep(
      runtime,
      runtime.baseDt,
      model,
      { setpoint: activeSp, controllerConfig, processOptions },
      buildEmptySignals()
    );
  }

  return analyzeOscillationFromHistory(runtime.history, Math.max(50, totalDuration * 0.4), model);
}

export function generateFineTuneAdvice(
  model: ProcessModelDefinition,
  currentController: ControllerConfig,
  history: ReturnType<typeof createRuntimeForConfig>["history"],
  processOptions?: ProcessOptions
): FineTuneAdvice[] {
  const metrics = calculateRunMetrics(history, model);
  const advice: FineTuneAdvice[] = [];
  const cycling = metrics.oscillation.status === "sustained" || metrics.oscillation.status === "growing";
  const highOvershoot = metrics.overshootPct > 10;
  const outputLimited = metrics.saturationTime > 10;
  const outputLimitAlreadyExplained = outputLimited && metrics.stability.status !== "stable";
  const operatorOffsetTargetPct = 1;
  const steadyOffsetPct = model.span > 0 ? (Math.abs(metrics.steadyStateOffset) / model.span) * 100 : 0;
  const currentErrorPct = model.span > 0 ? (Math.abs(metrics.currentError) / model.span) * 100 : 0;
  const persistentResidualOffset = Math.max(steadyOffsetPct, currentErrorPct) > operatorOffsetTargetPct;
  const offsetSignal =
    Math.abs(metrics.steadyStateOffset) >= Math.abs(metrics.currentError)
      ? metrics.steadyStateOffset
      : metrics.currentError;
  const offsetDirection = offsetSignal >= 0 ? "below" : "above";
  const offsetAmount = Math.abs(offsetSignal);
  const buildOffsetAdvice = (): FineTuneAdvice => ({
    title: "Remove residual offset",
    detail:
      currentController.algorithm === "P"
        ? `PV is averaging about ${offsetAmount.toFixed(model.precision)} ${model.units} ${offsetDirection} SP. P-only control needs a remaining error to make output; switch to PI/PID or adjust bias if integral action is not allowed.`
        : `PV is averaging about ${offsetAmount.toFixed(model.precision)} ${model.units} ${offsetDirection} SP. The loop may be inside the broad stable band, but reset action is too weak for zero-error control. Shorten Ti from ${currentController.ti.toFixed(0)}s in small steps and verify the output is not saturated or authority-limited.`
  });
  const slowOrOffset =
    metrics.settlingTime === null ||
    Math.abs(metrics.steadyStateOffset) > model.span * 0.05 ||
    Math.abs(metrics.currentError) > model.span * 0.05;

  if (metrics.stability.status === "unstable") {
    if (cycling || highOvershoot) {
      advice.push({
        title: "Reduce aggressiveness first",
        detail:
          "Lower Kp by 20-40% or increase Ti by 25-50% before making smaller tweaks. Avoid stronger integral action until the PV starts converging safely."
      });
    } else if (outputLimited) {
      advice.push({
        title: "Recover output authority first",
        detail:
          "The loop is unstable because the output is pinned at a limit, not because the PID simply needs more gain. Check bias, output limits, actuator authority, and process load before tuning harder."
      });
    } else if (slowOrOffset) {
      advice.push({
        title: "Correct the slow response",
        detail:
          "The PV is not converging fast enough. If the output is not saturated, increase Kp in small steps or shorten Ti slightly; if it is saturated, fix final-element authority first."
      });
    } else {
      advice.push({
        title: "Stabilize before optimizing",
        detail:
          "The trend is outside the stable training limits. Make one conservative tuning change, reset the run, and confirm the PV begins moving toward SP before chasing speed."
      });
    }
  } else if (metrics.stability.status === "marginal") {
    if (cycling || highOvershoot) {
      advice.push({
        title: "Add damping margin",
        detail:
          "The loop is close to the edge. Reduce Kp by 10-20% or increase Ti modestly, then confirm the next run still settles after a disturbance."
      });
    } else if (outputLimited) {
      advice.push({
        title: "Check output authority and bias",
        detail:
          "The response is marginal because the output is spending time at a limit. Check bias and output authority first, then reduce Kp or lengthen Ti if the loop is winding into the limit."
      });
    } else if (persistentResidualOffset) {
      advice.push(buildOffsetAdvice());
    } else if (slowOrOffset) {
      advice.push({
        title: "Speed recovery carefully",
        detail:
          "The loop is calm but not yet tight to setpoint. Increase Kp slightly or shorten Ti in small steps, then reset the run and confirm overshoot and valve travel stay acceptable."
      });
    } else {
      advice.push({
        title: "Watch one more trend window",
        detail:
          "The loop is near the stable target. Keep the current tuning, let another response window build, and only adjust if offset, overshoot, or actuator travel persists."
      });
    }
  }

  if (
    metrics.stability.status === "stable" &&
    persistentResidualOffset &&
    !cycling &&
    !highOvershoot &&
    !outputLimited
  ) {
    advice.push(buildOffsetAdvice());
  }

  if (metrics.overshootPct > 10) {
    advice.push({
      title: "Dampen the overshoot",
      detail: `Overshoot is ${metrics.overshootPct.toFixed(1)}%. Reduce Kp, increase Ti, or add modest Td only if the PV is clean. A longer SP filter time can also soften setpoint-step overshoot.`
    });
  }

  if (metrics.settlingTime && metrics.settlingTime > 60 && metrics.overshootPct < 5) {
    advice.push({
      title: "Speed up recovery carefully",
      detail: "The response is very calm but slow. Increase Kp slightly or shorten Ti to recover faster without adding heavy overshoot."
    });
  }

  if (metrics.saturationTime > 10 && !outputLimitAlreadyExplained) {
    advice.push({
      title: "Check output limits and bias",
      detail:
        "The output is spending too long at a limit. Check bias and output authority first, then reduce Kp or lengthen Ti if the loop is winding into the limit."
    });
  }

  if (metrics.oscillation.status === "sustained" || metrics.oscillation.status === "growing") {
    advice.push({
      title: "You are sitting on the edge",
      detail:
        "Cycling means the loop needs less aggression. Cut Kp 20-40%, increase Ti 25-50%, and avoid shortening Ti until the oscillation decays."
    });
  }

  const derivativeActive = currentController.algorithm === "PID" && currentController.td > 0;
  const noisyDerivative =
    derivativeActive &&
    ((processOptions?.noiseLevel ?? 0) >= 10 ||
      history.slice(-80).some((sample) => Math.abs(sample.noise) > model.span * 0.006));

  if (noisyDerivative || (derivativeActive && metrics.coTravel > 1200 && metrics.overshootPct < 4)) {
    advice.push({
      title: "Consider less derivative activity",
      detail:
        "Noisy derivative action can make CO chatter. Reduce Td, add or increase PV filter time, or lower Kp before chasing the noise with more integral."
    });
  }

  if (
    processOptions &&
    processOptions.disturbanceProfile !== "none" &&
    processOptions.disturbanceIntensity > 0 &&
    metrics.disturbanceRecoveryTime === null &&
    metrics.stability.status !== "unstable"
  ) {
    advice.push({
      title: "Improve disturbance recovery",
      detail:
        "The loop stayed stable but did not clearly recover from the load change. Increase Kp slightly or shorten Ti carefully, then recheck overshoot."
    });
  }

  if (!advice.length) {
    advice.push({
      title: "Balanced response",
      detail: "This run looks well damped for operator training. Save it as a golden tuning and compare it against a noisier scenario next."
    });
  }

  return advice;
}
