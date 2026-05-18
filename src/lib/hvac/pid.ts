import type { HvacPidConfig, HvacPidResult } from "@/lib/hvac/types";
import { clamp } from "@/lib/hvac/utils";

export class HvacPidController {
  private config: HvacPidConfig;
  private integral = 0;
  private previousPv: number | null = null;
  private previousError = 0;
  private previousMv = 0;
  private derivativeFilter = 0;
  private lastResult: HvacPidResult;

  constructor(config: HvacPidConfig) {
    this.config = { ...config };
    this.previousMv = clamp(config.manualOutput || config.bias, config.outputMin, config.outputMax);
    this.lastResult = {
      mv: this.previousMv,
      pTerm: 0,
      iTerm: 0,
      dTerm: 0,
      error: 0,
      integral: 0,
      saturated: false,
      rawMv: this.previousMv
    };
  }

  get state() {
    return { ...this.config, integral: this.integral, previousMv: this.previousMv };
  }

  get result() {
    return { ...this.lastResult };
  }

  set(patch: Partial<HvacPidConfig>) {
    const previousMode = this.config.mode;
    this.config = { ...this.config, ...patch };
    if (previousMode === "manual" && patch.mode === "auto") {
      this.bumplessSwitchToAuto(this.config.manualOutput);
    }
  }

  reset(initialMv = this.config.bias, initialPv?: number) {
    this.integral = this.config.ki > 0 ? (initialMv - this.config.bias) / this.config.ki : 0;
    this.previousPv = typeof initialPv === "number" ? initialPv : null;
    this.previousError = 0;
    this.previousMv = clamp(initialMv, this.config.outputMin, this.config.outputMax);
    this.derivativeFilter = 0;
    this.lastResult = {
      mv: this.previousMv,
      pTerm: 0,
      iTerm: this.config.ki * this.integral,
      dTerm: 0,
      error: 0,
      integral: this.integral,
      saturated: false,
      rawMv: this.previousMv
    };
  }

  bumplessSwitchToAuto(currentMv: number) {
    const pTerm = this.lastResult.pTerm;
    const dTerm = this.lastResult.dTerm;
    this.integral =
      this.config.ki > 0 ? (currentMv - this.config.bias - pTerm - dTerm) / this.config.ki : 0;
    this.previousMv = clamp(currentMv, this.config.outputMin, this.config.outputMax);
    this.config.mode = "auto";
  }

  compute(pv: number, sp = this.config.sp, dt: number): HvacPidResult {
    if (this.config.mode === "manual") {
      const manualMv = clamp(this.config.manualOutput, this.config.outputMin, this.config.outputMax);
      this.previousPv = pv;
      this.previousMv = manualMv;
      this.lastResult = {
        mv: manualMv,
        pTerm: this.lastResult.pTerm,
        iTerm: this.config.ki * this.integral,
        dTerm: this.lastResult.dTerm,
        error: this.previousError,
        integral: this.integral,
        saturated: manualMv <= this.config.outputMin || manualMv >= this.config.outputMax,
        rawMv: manualMv
      };
      return this.result;
    }

    const rawError = this.config.reverseAction ? pv - sp : sp - pv;
    const error = Math.abs(rawError) < this.config.deadband ? 0 : rawError;
    const pTerm = this.config.kp * error;

    const previousPv = this.previousPv ?? pv;
    const derivativeSignal = this.config.derivOnMeas ? pv : error;
    const previousDerivativeSignal = this.config.derivOnMeas ? previousPv : this.previousError;
    const derivativeRate = (derivativeSignal - previousDerivativeSignal) / Math.max(dt, 0.0001);
    const n = Math.max(this.config.derivN, 0);
    this.derivativeFilter += (derivativeRate - this.derivativeFilter) * ((dt * n) / (1 + dt * n));
    const dTerm = this.config.derivOnMeas
      ? (this.config.reverseAction ? this.config.kd * this.derivativeFilter : -this.config.kd * this.derivativeFilter)
      : this.config.kd * this.derivativeFilter;

    const rawBeforeIntegral = this.config.bias + pTerm + this.config.ki * this.integral + dTerm;
    const clampedBeforeIntegral = clamp(rawBeforeIntegral, this.config.outputMin, this.config.outputMax);

    if (this.config.antiWindup === "back-calc") {
      const resetTime = Math.max(this.config.backCalcTt, 0.1);
      const backCalc =
        this.config.ki > 0 ? (clampedBeforeIntegral - rawBeforeIntegral) / this.config.ki : 0;
      this.integral += (error + backCalc / resetTime) * dt;
    } else if (this.config.antiWindup === "clamp") {
      const highLimited = rawBeforeIntegral > this.config.outputMax && error > 0;
      const lowLimited = rawBeforeIntegral < this.config.outputMin && error < 0;
      if (!highLimited && !lowLimited) {
        this.integral += error * dt;
      }
    } else {
      this.integral += error * dt;
    }

    this.integral = clamp(this.integral, -2000, 2000);
    const iTerm = this.config.ki * this.integral;
    const rawMv = this.config.bias + pTerm + iTerm + dTerm;
    const clampedMv = clamp(rawMv, this.config.outputMin, this.config.outputMax);
    const rateLimit = Math.max(this.config.rateLimit, 0);
    const mv =
      rateLimit > 0
        ? clamp(clampedMv, this.previousMv - rateLimit * dt, this.previousMv + rateLimit * dt)
        : clampedMv;

    this.previousPv = pv;
    this.previousError = error;
    this.previousMv = mv;
    this.config.sp = sp;
    this.lastResult = {
      mv,
      pTerm,
      iTerm,
      dTerm,
      error,
      integral: this.integral,
      saturated: rawMv !== clampedMv || mv !== clampedMv,
      rawMv
    };
    return this.result;
  }
}

export function createDefaultPid(loopId: "sat" | "pressure" | "outer", template: string) {
  if (loopId === "pressure") {
    return new HvacPidController({
      name: template === "liquidCooled" ? "Secondary Pressure" : "Static Pressure",
      kp: 34,
      ki: 0.55,
      kd: 0,
      sp: template === "liquidCooled" ? 18 : 0.45,
      bias: 55,
      mode: "auto",
      manualOutput: 55,
      outputMin: 15,
      outputMax: 100,
      rateLimit: 35,
      deadband: 0.01,
      antiWindup: "clamp",
      backCalcTt: 12,
      derivOnMeas: true,
      derivN: 8,
      reverseAction: false
    });
  }

  if (loopId === "outer") {
    return new HvacPidController({
      name: "Room Cascade",
      kp: 2.2,
      ki: 0.02,
      kd: 0,
      sp: template === "liquidCooled" ? 78 : 80,
      bias: template === "liquidCooled" ? 68 : 68,
      mode: "manual",
      manualOutput: template === "liquidCooled" ? 68 : 68,
      outputMin: template === "liquidCooled" ? 60 : 55,
      outputMax: template === "liquidCooled" ? 78 : 80,
      rateLimit: 0.25,
      deadband: 0.2,
      antiWindup: "clamp",
      backCalcTt: 30,
      derivOnMeas: true,
      derivN: 5,
      reverseAction: false
    });
  }

  return new HvacPidController({
    name: template === "liquidCooled" ? "CDU Supply" : "Supply Air Temp",
    kp: template === "liquidCooled" ? 3.2 : 2.6,
    ki: template === "liquidCooled" ? 0.055 : 0.035,
    kd: 0,
    sp: template === "liquidCooled" ? 68 : 68,
    bias: template === "liquidCooled" ? 52 : 58,
    mode: "auto",
    manualOutput: template === "liquidCooled" ? 52 : 58,
    outputMin: 0,
    outputMax: 100,
    rateLimit: 20,
    deadband: 0.2,
    antiWindup: "clamp",
    backCalcTt: 20,
    derivOnMeas: true,
    derivN: 8,
    reverseAction: true
  });
}
