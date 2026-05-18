export type HvacTemplate = "directEvap" | "airCooled" | "liquidCooled";
export type HvacLoopId = "sat" | "pressure" | "outer";
export type HvacPidMode = "auto" | "manual";
export type HvacAntiWindupMode = "off" | "clamp" | "back-calc";
export type HvacAlarmPriority = "info" | "medium" | "high" | "critical";

export interface HvacPidConfig {
  name: string;
  kp: number;
  ki: number;
  kd: number;
  sp: number;
  bias: number;
  mode: HvacPidMode;
  manualOutput: number;
  outputMin: number;
  outputMax: number;
  rateLimit: number;
  deadband: number;
  antiWindup: HvacAntiWindupMode;
  backCalcTt: number;
  derivOnMeas: boolean;
  derivN: number;
  reverseAction: boolean;
}

export interface HvacPidResult {
  mv: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  error: number;
  integral: number;
  saturated: boolean;
  rawMv: number;
}

export interface HvacPlantCommands {
  primaryMv: number;
  pressureMv: number;
  econDamperCmd: number;
}

export interface HvacPlantSnapshot {
  template: HvacTemplate;
  supplyAirTemp: number;
  supplyAirTempPv: number;
  supplyRH: number;
  supplyHumidityRatio: number;
  returnAirTemp: number;
  roomTemp: number;
  staticPressure: number;
  staticPressurePv: number;
  faceDamperActual: number;
  bypassDamperActual: number;
  fanVFDActual: number;
  econDamperActual: number;
  valveActual: number;
  pumpVFDActual: number;
  bypassValveActual: number;
  rackInletTemp: number;
  cduSupplyTemp: number;
  cduSupplyTempPv: number;
  secondaryPressure: number;
  secondaryPressurePv: number;
  outdoorDryBulb: number;
  outdoorWetBulb: number;
  outdoorRH: number;
  itLoadKw: number;
  padEffectiveness: number;
  padFouling: number;
  sensorBiasSat: number;
  bypassDamperJammed: boolean;
  bypassJamPosition: number;
  transportDelayS: number;
  sensorTauS: number;
  returnTauS: number;
  coilEffectiveness: number;
  chilledWaterSupplyTemp: number;
  coolantInTemp: number;
}

export interface HvacPlantModel {
  readonly template: HvacTemplate;
  applyState(patch: Partial<HvacPlantSnapshot>): void;
  step(dtSeconds: number, commands: HvacPlantCommands): HvacPlantSnapshot;
  getSnapshot(): HvacPlantSnapshot;
  getLoopPv(loopId: HvacLoopId): number;
}

export interface HvacDiagnosticMessage {
  id: string;
  severity: "info" | "warning" | "error" | "success";
  title: string;
  body: string;
}

export interface HvacAlarm {
  id: string;
  title: string;
  priority: HvacAlarmPriority;
  active: boolean;
  acknowledged: boolean;
  detail: string;
}

export interface HvacSample {
  simTime: number;
  template: HvacTemplate;
  satSp: number;
  satPv: number;
  satMv: number;
  pressureSp: number;
  pressurePv: number;
  pressureMv: number;
  outerSp: number;
  outerPv: number;
  outerMv: number;
  activeSp: number;
  activePv: number;
  activeMv: number;
  error: number;
  integral: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  supplyRH: number;
  roomTemp: number;
  staticPressure: number;
  primaryMvDelta: number;
  alarms: string[];
  plant: HvacPlantSnapshot;
}

export interface HvacScenarioEvent {
  atSimTimeS: number;
  target: "plant" | "pid" | "runtime";
  property: string;
  value: number | string | boolean;
  durationSec?: number;
  loop?: HvacLoopId;
  label: string;
}

export interface HvacScenarioDefinition {
  id: string;
  level: 0 | 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  template: HvacTemplate;
  durationSec: number;
  hint: string;
  tutorial: string;
  initialState: Partial<HvacPlantSnapshot>;
  initialPID: Partial<Record<HvacLoopId, Partial<HvacPidConfig>>>;
  disturbances: HvacScenarioEvent[];
  criteria: {
    maxOvershootPct: number;
    settlingTimeS: number;
    maxRmse: number;
    alarmLimit: number;
  };
  scoringWeights: {
    settling: number;
    overshoot: number;
    rmse: number;
    alarms: number;
    actuator?: number;
  };
  benchmarkTuning: {
    kp: number;
    ki: number;
    kd: number;
  };
  benchmarkScore: number;
}

export interface HvacAssessmentSnapshot {
  score: number | null;
  overshootPct: number;
  settlingTimeS: number | null;
  rmse: number;
  iae: number;
  ise: number;
  alarmSeconds: number;
  alarmCount: number;
  actuatorMovement: number;
  saturationSeconds: number;
}
