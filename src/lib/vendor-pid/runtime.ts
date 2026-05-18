import { buildVendorPidConfig, getVendorPidProfile, getVendorPlant } from "@/lib/vendor-pid/profiles";
import type {
  VendorPidAction,
  VendorPidConfig,
  VendorPidControllerSnapshot,
  VendorPidPlantDefinition,
  VendorPidPlantId,
  VendorPidPlantState,
  VendorPidPracStatus,
  VendorPidProfile,
  VendorPidProfileId,
  VendorPidResult,
  VendorPidRuntime,
  VendorPidSample
} from "@/lib/vendor-pid/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyFirstOrder(previous: number, target: number, tau: number, dt: number) {
  if (tau <= 0) {
    return target;
  }
  return previous + (dt / (tau + dt)) * (target - previous);
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function executionInterval(profile: VendorPidProfile, config: VendorPidConfig) {
  return Math.max(profile.computeKind === "alcInterval" || profile.computeKind === "jciPrac" ? config.interval : config.sampleTime, 0.1);
}

export function vendorError(action: VendorPidAction, sp: number, pv: number, deadband = 0) {
  const error = action === "direct" ? pv - sp : sp - pv;
  return Math.abs(error) <= deadband ? 0 : error;
}

export function proportionalBandToGain(proportionalBand: number) {
  return 100 / Math.max(Math.abs(proportionalBand), 0.0001);
}

function clampOutput(config: VendorPidConfig, value: number) {
  return clamp(value, Math.min(config.outputMin, config.outputMax), Math.max(config.outputMin, config.outputMax));
}

function createInitialResult(config: VendorPidConfig): VendorPidResult {
  const mv = clampOutput(config, config.startupValue || config.bias);
  return {
    mv,
    rawMv: mv,
    pTerm: 0,
    iTerm: 0,
    dTerm: 0,
    error: 0,
    saturated: false,
    executedTick: true,
    tickCount: 0,
    effectiveProportionalBand: null,
    effectiveIntegralTime: null,
    pracStatus: "tracking"
  };
}

function createSnapshot(config: VendorPidConfig): VendorPidControllerSnapshot {
  const heldOutput = clampOutput(config, config.mode === "manual" ? config.manualOutput : config.startupValue || config.bias);
  return {
    config: { ...config },
    integral: 0,
    previousError: 0,
    previousPv: null,
    heldOutput,
    tickCount: 0,
    effectiveProportionalBand: null,
    effectiveIntegralTime: null,
    pracStatus: config.adaptiveMode ? "tracking" : "manual"
  };
}

function applyRateLimit(previous: number, target: number, limitPerSecond: number, dt: number) {
  if (limitPerSecond <= 0) {
    return target;
  }
  return clamp(target, previous - limitPerSecond * dt, previous + limitPerSecond * dt);
}

export class VendorPidController {
  private profile: VendorPidProfile;
  private state: VendorPidControllerSnapshot;
  private nextExecutionAt = 0;
  private derivativeFilter = 0;
  private previousSp: number | null = null;
  private saturationSeconds = 0;
  private lastResult: VendorPidResult;

  constructor(profile: VendorPidProfile, config: VendorPidConfig) {
    this.profile = profile;
    this.state = createSnapshot(config);
    this.lastResult = {
      ...createInitialResult(config),
      effectiveProportionalBand: profile.computeKind === "jciPrac" ? config.proportionalBand : null,
      effectiveIntegralTime: profile.computeKind === "jciPrac" ? config.integralTime : null,
      pracStatus: config.adaptiveMode ? "tracking" : "manual"
    };
    if (profile.computeKind === "jciPrac") {
      this.state.effectiveProportionalBand = config.proportionalBand;
      this.state.effectiveIntegralTime = config.integralTime;
    }
  }

  get snapshot() {
    return {
      ...this.state,
      config: { ...this.state.config }
    };
  }

  setConfig(patch: Partial<VendorPidConfig>) {
    const previousMode = this.state.config.mode;
    this.state.config = { ...this.state.config, ...patch };
    if (previousMode === "manual" && patch.mode === "auto") {
      this.state.integral = this.state.heldOutput - this.state.config.bias - this.lastResult.pTerm - this.lastResult.dTerm;
    }
    if (this.profile.computeKind === "jciPrac") {
      this.state.effectiveProportionalBand = clamp(
        this.state.effectiveProportionalBand ?? this.state.config.proportionalBand,
        this.state.config.proportionalBand * 0.55,
        this.state.config.proportionalBand * 1.8
      );
      this.state.effectiveIntegralTime = clamp(
        this.state.effectiveIntegralTime ?? this.state.config.integralTime,
        this.state.config.integralTime * 0.65,
        this.state.config.integralTime * 2
      );
    }
  }

  compute(pv: number, sp: number, time: number, dt: number): VendorPidResult {
    const config = this.state.config;
    const error = vendorError(config.action, sp, pv, config.deadband);

    if (config.mode === "manual") {
      const mv = clampOutput(config, config.manualOutput);
      this.state.heldOutput = mv;
      this.state.previousPv = pv;
      this.state.previousError = error;
      this.lastResult = {
        ...this.lastResult,
        mv,
        rawMv: mv,
        error,
        saturated: mv <= config.outputMin || mv >= config.outputMax,
        executedTick: true,
        pracStatus: "manual"
      };
      return { ...this.lastResult };
    }

    if (this.state.tickCount > 0 && time + 0.000001 < this.nextExecutionAt) {
      this.lastResult = {
        ...this.lastResult,
        error,
        executedTick: false
      };
      return { ...this.lastResult };
    }

    const interval = executionInterval(this.profile, config);
    const result = this.computeExecutedTick(pv, sp, error, time, interval);
    const limitedMv = applyRateLimit(this.state.heldOutput, result.mv, config.outputRateLimit, interval);
    this.state.heldOutput = limitedMv;
    this.state.previousPv = pv;
    this.state.previousError = error;
    this.previousSp = sp;
    this.state.tickCount += 1;
    this.nextExecutionAt = time + interval;
    this.lastResult = {
      ...result,
      mv: limitedMv,
      saturated: result.saturated || limitedMv !== result.mv,
      executedTick: true,
      tickCount: this.state.tickCount
    };
    return { ...this.lastResult };
  }

  private computeExecutedTick(pv: number, sp: number, error: number, time: number, interval: number): VendorPidResult {
    switch (this.profile.computeKind) {
      case "siemensLoop":
        return this.computeSiemensLoop(error, interval);
      case "tiaCompact":
        return this.computeTiaCompact(pv, error, interval);
      case "honeywellEpid":
        return this.computeHoneywellEpid(pv, error, time, interval);
      case "alcInterval":
        return this.computeAlcInterval(error, interval);
      case "jciPrac":
        return this.computeJciPrac(pv, sp, error, interval);
      default:
        return this.computeAlcInterval(error, interval);
    }
  }

  private finalizeTerms(pTerm: number, iDelta: number, dTerm: number, error: number, interval: number, status: VendorPidPracStatus = "tracking") {
    const config = this.state.config;
    const rawBeforeIntegral = config.bias + pTerm + this.state.integral + dTerm;
    const highLimited = rawBeforeIntegral > config.outputMax && error > 0;
    const lowLimited = rawBeforeIntegral < config.outputMin && error < 0;
    if (!highLimited && !lowLimited) {
      this.state.integral += iDelta;
    }
    this.state.integral = clamp(this.state.integral, -200, 200);

    const rawMv = config.bias + pTerm + this.state.integral + dTerm;
    const mv = clampOutput(config, rawMv);
    const saturated = rawMv !== mv;
    this.saturationSeconds = saturated ? this.saturationSeconds + interval : 0;

    return {
      mv,
      rawMv,
      pTerm,
      iTerm: this.state.integral,
      dTerm,
      error,
      saturated,
      executedTick: true,
      tickCount: this.state.tickCount + 1,
      effectiveProportionalBand: this.state.effectiveProportionalBand,
      effectiveIntegralTime: this.state.effectiveIntegralTime,
      pracStatus: status
    };
  }

  private computeSiemensLoop(error: number, interval: number): VendorPidResult {
    const config = this.state.config;
    const pTerm = config.pg * error;
    const iDelta = config.ig * error * interval;
    const dTerm = config.dg > 0 ? config.dg * ((error - this.state.previousError) / interval) : 0;
    return this.finalizeTerms(pTerm, iDelta, dTerm, error, interval);
  }

  private computeTiaCompact(pv: number, error: number, interval: number): VendorPidResult {
    const config = this.state.config;
    const weightedError = config.setpointWeight * error + (1 - config.setpointWeight) * this.state.previousError;
    const pTerm = config.kp * weightedError;
    const iDelta = config.ti > 0 ? (config.kp / config.ti) * error * interval : 0;
    const previousPv = this.state.previousPv ?? pv;
    const pvRate = (pv - previousPv) / interval;
    this.derivativeFilter = applyFirstOrder(this.derivativeFilter, pvRate, config.derivativeFilterTime, interval);
    const derivativeSign = config.action === "direct" ? 1 : -1;
    const dTerm = config.td > 0 ? derivativeSign * config.kp * config.td * this.derivativeFilter : 0;
    const result = this.finalizeTerms(pTerm, iDelta, dTerm, error, interval);

    if (result.saturated) {
      const tracking = (result.mv - result.rawMv) / Math.max(config.ti, interval);
      this.state.integral += tracking * interval;
      result.iTerm = this.state.integral;
      result.rawMv = config.bias + result.pTerm + result.iTerm + result.dTerm;
    }
    return result;
  }

  private computeHoneywellEpid(pv: number, error: number, time: number, interval: number): VendorPidResult {
    const config = this.state.config;
    const ramp = config.errorRampTime <= 0 ? 1 : clamp(time / config.errorRampTime, 0.1, 1);
    const rampedError = error * ramp;
    const gain = proportionalBandToGain(config.throttlingRange);
    const pTerm = gain * rampedError;
    const iDelta = config.integralTime > 0 ? (gain / config.integralTime) * rampedError * interval : 0;
    const previousPv = this.state.previousPv ?? pv;
    const pvRate = (pv - previousPv) / interval;
    const derivativeSign = config.action === "direct" ? 1 : -1;
    const dTerm = config.derivativeTime > 0 ? derivativeSign * gain * config.derivativeTime * pvRate : 0;
    return this.finalizeTerms(pTerm, iDelta, dTerm, error, interval);
  }

  private computeAlcInterval(error: number, interval: number): VendorPidResult {
    const config = this.state.config;
    const pTerm = config.kp * error;
    const iDelta = config.ti > 0 ? (config.kp / config.ti) * error * interval : 0;
    const dTerm = config.td > 0 ? config.kp * config.td * ((error - this.state.previousError) / interval) : 0;
    return this.finalizeTerms(pTerm, iDelta, dTerm, error, interval);
  }

  private updateJciAdaptive(error: number) {
    const config = this.state.config;
    if (!config.adaptiveMode) {
      this.state.pracStatus = "manual";
      this.state.effectiveProportionalBand = config.proportionalBand;
      this.state.effectiveIntegralTime = config.integralTime;
      return;
    }

    const pb = this.state.effectiveProportionalBand ?? config.proportionalBand;
    const ti = this.state.effectiveIntegralTime ?? config.integralTime;
    const signChanged = error !== 0 && this.state.previousError !== 0 && Math.sign(error) !== Math.sign(this.state.previousError);
    const errorGrowing = Math.abs(error) > Math.abs(this.state.previousError) + config.deadband * 0.25;
    let nextPb = pb;
    let nextTi = ti;
    let status: VendorPidPracStatus = "tracking";

    if (this.saturationSeconds >= config.saturationTime) {
      nextPb = pb * 1.008;
      nextTi = ti * 1.01;
      status = "saturation tracking";
    } else if (signChanged || (errorGrowing && Math.abs(error) < Math.max(config.deadband * 6, 0.5))) {
      nextPb = pb * 1.018;
      nextTi = ti * 1.014;
      status = "slowing hunting";
    } else if (Math.abs(error) > Math.max(config.deadband * 8, 0.35)) {
      nextPb = pb * 0.992;
      nextTi = ti * 0.994;
      status = "speeding recovery";
    }

    this.state.effectiveProportionalBand = clamp(nextPb, config.proportionalBand * 0.55, config.proportionalBand * 1.8);
    this.state.effectiveIntegralTime = clamp(nextTi, config.integralTime * 0.65, config.integralTime * 2);
    this.state.pracStatus = status;
  }

  private computeJciPrac(pv: number, sp: number, error: number, interval: number): VendorPidResult {
    const config = this.state.config;
    this.updateJciAdaptive(error);
    const effectivePb = this.state.effectiveProportionalBand ?? config.proportionalBand;
    const effectiveTi = this.state.effectiveIntegralTime ?? config.integralTime;
    const gain = proportionalBandToGain(effectivePb);
    const spDelta = this.previousSp === null ? 0 : sp - this.previousSp;
    const weightedError = error - (1 - config.setpointWeight) * (config.action === "direct" ? -spDelta : spDelta);
    const pTerm = gain * weightedError;
    const iDelta = effectiveTi > 0 ? (gain / effectiveTi) * error * interval : 0;
    const previousPv = this.state.previousPv ?? pv;
    const pvRate = (pv - previousPv) / interval;
    const derivativeSign = config.action === "direct" ? 1 : -1;
    const dTerm =
      !config.adaptiveMode && config.derivativeTime > 0
        ? derivativeSign * gain * config.derivativeTime * pvRate
        : 0;
    const result = this.finalizeTerms(pTerm, iDelta, dTerm, error, interval, this.state.pracStatus);

    if (result.saturated) {
      const correction = (result.mv - result.rawMv) * (interval / Math.max(config.saturationTime, interval));
      this.state.integral += correction;
      this.state.integral = clamp(this.state.integral, -200, 200);
      result.iTerm = this.state.integral;
      result.rawMv = config.bias + result.pTerm + result.iTerm + result.dTerm;
      result.pracStatus = this.saturationSeconds >= config.saturationTime ? "saturation tracking" : result.pracStatus;
    }
    result.effectiveProportionalBand = this.state.effectiveProportionalBand;
    result.effectiveIntegralTime = this.state.effectiveIntegralTime;
    return result;
  }
}

function createPlantState(plant: VendorPidPlantDefinition): VendorPidPlantState {
  const deadSteps = Math.max(1, Math.round(plant.deadTime / 0.1));
  return {
    pv: plant.initialPv,
    state1: plant.initialPv,
    state2: plant.initialPv,
    valvePosition: plant.outputBase,
    deadtimeQueue: Array(deadSteps).fill(0)
  };
}

function disturbanceAt(plant: VendorPidPlantDefinition, time: number) {
  if (time < plant.disturbanceStart) {
    return 0;
  }
  if (time < plant.disturbanceStart + plant.disturbanceDuration) {
    const progress = (time - plant.disturbanceStart) / Math.max(plant.disturbanceDuration, 1);
    return plant.disturbanceGain * clamp(progress, 0, 1);
  }
  if (time < plant.disturbanceStart + plant.disturbanceDuration * 1.8) {
    const progress = (time - plant.disturbanceStart - plant.disturbanceDuration) / Math.max(plant.disturbanceDuration * 0.8, 1);
    return plant.disturbanceGain * (1 - clamp(progress, 0, 1) * 0.55);
  }
  return plant.disturbanceGain * 0.45;
}

function stepPlant(plant: VendorPidPlantDefinition, state: VendorPidPlantState, mv: number, time: number, dt: number) {
  state.valvePosition = applyFirstOrder(state.valvePosition, mv, 1.6, dt);
  const normalizedOutput = (state.valvePosition - plant.outputBase) / 100;
  const delayedOutput = state.deadtimeQueue.shift() ?? 0;
  state.deadtimeQueue.push(normalizedOutput);
  const target = plant.initialPv + delayedOutput * plant.processGain + disturbanceAt(plant, time);
  state.state1 = applyFirstOrder(state.state1, target, plant.lag1, dt);
  state.state2 = plant.lag2 > 0 ? applyFirstOrder(state.state2, state.state1, plant.lag2, dt) : state.state1;
  state.pv = clamp(state.state2, plant.displayMin, plant.displayMax);
  return state.pv;
}

function buildSample(runtime: VendorPidRuntime, result: VendorPidResult): VendorPidSample {
  return {
    time: round(runtime.time, 3),
    sp: round(runtime.setpoint, 4),
    pv: round(runtime.plantState.pv, 4),
    secondaryPv: round(runtime.plantState.state1, 4),
    mv: round(result.mv, 4),
    valvePosition: round(runtime.plantState.valvePosition, 4),
    rawMv: round(result.rawMv, 4),
    pTerm: round(result.pTerm, 4),
    iTerm: round(result.iTerm, 4),
    dTerm: round(result.dTerm, 4),
    error: round(result.error, 4),
    saturated: result.saturated,
    executedTick: result.executedTick,
    effectiveProportionalBand: result.effectiveProportionalBand === null ? null : round(result.effectiveProportionalBand, 4),
    effectiveIntegralTime: result.effectiveIntegralTime === null ? null : round(result.effectiveIntegralTime, 4),
    pracStatus: result.pracStatus
  };
}

export function createVendorPidRuntime(
  profileId: VendorPidProfileId,
  plantId: VendorPidPlantId,
  configPatch: Partial<VendorPidConfig> = {}
): VendorPidRuntime {
  const profile = getVendorPidProfile(profileId);
  const plant = getVendorPlant(plantId);
  const config = { ...buildVendorPidConfig(profileId, plantId), ...configPatch };
  const controller = new VendorPidController(profile, config);
  const plantState = createPlantState(plant);
  const initialResult = controller.compute(plantState.pv, plant.setpoint, 0, 0.1);
  const runtime: VendorPidRuntime = {
    profile,
    plant,
    plantState,
    controller,
    time: 0,
    setpoint: plant.setpoint,
    history: [],
    maxSamples: 18000,
    lastResult: initialResult
  };
  runtime.history.push(buildSample(runtime, initialResult));
  return runtime;
}

export function stepVendorPidRuntime(runtime: VendorPidRuntime, dt = 0.1) {
  stepPlant(runtime.plant, runtime.plantState, runtime.lastResult.mv, runtime.time, dt);
  const result = runtime.controller.compute(runtime.plantState.pv, runtime.setpoint, runtime.time + dt, dt);
  runtime.time = round(runtime.time + dt, 4);
  runtime.lastResult = result;
  runtime.history.push(buildSample(runtime, result));
  if (runtime.history.length > runtime.maxSamples) {
    runtime.history.splice(0, runtime.history.length - runtime.maxSamples);
  }
}

export function simulateVendorPid(
  profileId: VendorPidProfileId,
  plantId: VendorPidPlantId,
  seconds: number,
  configPatch: Partial<VendorPidConfig> = {}
) {
  const runtime = createVendorPidRuntime(profileId, plantId, configPatch);
  while (runtime.time < seconds) {
    stepVendorPidRuntime(runtime);
  }
  return runtime;
}

export function getVendorPidWindow(runtime: VendorPidRuntime, seconds: number) {
  const start = seconds <= 0 ? 0 : runtime.time - seconds;
  return runtime.history.filter((sample) => sample.time >= start);
}
