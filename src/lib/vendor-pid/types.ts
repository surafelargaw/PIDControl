export type VendorPidProfileId =
  | "siemens-apogee-loop"
  | "siemens-tia-pid-compact"
  | "honeywell-comfortpoint-open"
  | "alc-webctrl-eikon"
  | "jci-metasys-prac";

export type VendorPidPlantId = "supplyAirTemp" | "staticPressure" | "chilledWaterValve" | "genericFopdt";
export type VendorPidMode = "auto" | "manual";
export type VendorPidAction = "direct" | "reverse";
export type VendorPidFidelity = "documented" | "documented-plus-inferred" | "training-approximation";
export type VendorPidComputeKind = "siemensLoop" | "tiaCompact" | "honeywellEpid" | "alcInterval" | "jciPrac";
export type VendorPidPracStatus = "manual" | "tracking" | "speeding recovery" | "slowing hunting" | "saturation tracking";

export interface VendorPidConfig {
  mode: VendorPidMode;
  action: VendorPidAction;
  sampleTime: number;
  interval: number;
  bias: number;
  manualOutput: number;
  outputMin: number;
  outputMax: number;
  deadband: number;
  pg: number;
  ig: number;
  dg: number;
  kp: number;
  ti: number;
  td: number;
  throttlingRange: number;
  proportionalBand: number;
  integralTime: number;
  derivativeTime: number;
  saturationTime: number;
  setpointWeight: number;
  derivativeWeight: number;
  derivativeFilterTime: number;
  errorRampTime: number;
  startupValue: number;
  adaptiveMode: boolean;
  outputRateLimit: number;
}

export type VendorPidNumericField = {
  key: keyof VendorPidConfig;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  note: string;
};

export interface VendorPidSourceLink {
  label: string;
  href: string;
}

export interface VendorPidProfile {
  id: VendorPidProfileId;
  vendor: string;
  family: string;
  label: string;
  shortLabel: string;
  computeKind: VendorPidComputeKind;
  fidelity: VendorPidFidelity;
  summary: string;
  behaviorNotes: string[];
  fieldDefinitions: VendorPidNumericField[];
  sourceLinks: VendorPidSourceLink[];
  defaultConfig: VendorPidConfig;
  plantDefaults: Partial<Record<VendorPidPlantId, Partial<VendorPidConfig>>>;
}

export interface VendorPidPlantDefinition {
  id: VendorPidPlantId;
  label: string;
  units: string;
  precision: number;
  summary: string;
  initialPv: number;
  setpoint: number;
  displayMin: number;
  displayMax: number;
  outputBase: number;
  processGain: number;
  lag1: number;
  lag2: number;
  deadTime: number;
  disturbanceStart: number;
  disturbanceDuration: number;
  disturbanceGain: number;
}

export interface VendorPidPlantState {
  pv: number;
  state1: number;
  state2: number;
  valvePosition: number;
  deadtimeQueue: number[];
}

export interface VendorPidResult {
  mv: number;
  rawMv: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  error: number;
  saturated: boolean;
  executedTick: boolean;
  tickCount: number;
  effectiveProportionalBand: number | null;
  effectiveIntegralTime: number | null;
  pracStatus: VendorPidPracStatus;
}

export interface VendorPidControllerSnapshot {
  config: VendorPidConfig;
  integral: number;
  previousError: number;
  previousPv: number | null;
  heldOutput: number;
  tickCount: number;
  effectiveProportionalBand: number | null;
  effectiveIntegralTime: number | null;
  pracStatus: VendorPidPracStatus;
}

export interface VendorPidSample {
  time: number;
  sp: number;
  pv: number;
  secondaryPv: number;
  mv: number;
  valvePosition: number;
  rawMv: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  error: number;
  saturated: boolean;
  executedTick: boolean;
  effectiveProportionalBand: number | null;
  effectiveIntegralTime: number | null;
  pracStatus: VendorPidPracStatus;
}

export interface VendorPidRuntime {
  profile: VendorPidProfile;
  plant: VendorPidPlantDefinition;
  plantState: VendorPidPlantState;
  controller: {
    snapshot: VendorPidControllerSnapshot;
    compute: (pv: number, sp: number, time: number, dt: number) => VendorPidResult;
    setConfig: (patch: Partial<VendorPidConfig>) => void;
  };
  time: number;
  setpoint: number;
  history: VendorPidSample[];
  maxSamples: number;
  lastResult: VendorPidResult;
}
