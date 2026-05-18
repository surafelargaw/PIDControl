export type ControllerAlgorithm = "P" | "PI" | "PID";
export type ControllerForm = "standard" | "series" | "parallel";
export type ControllerMode = "auto" | "manual";
export type OperatingMode = "single" | "feedforward" | "cascade" | "interacting";
export type DisturbanceProfile = "none" | "stepLoad" | "pulseLoad" | "cyclicLoad" | "rampLoad";
export type ControlDirection = "direct" | "reverse";
export type ProcessResponseType = "selfRegulating" | "integrating";
export type StabilityStatus = "stable" | "marginal" | "unstable";
export type OscillationClass = "decaying" | "sustained" | "growing" | "none";

export interface ProcessParameters {
  responseType: ProcessResponseType;
  gain: number;
  lag1: number;
  lag2: number;
  deadTime: number;
  leakage: number;
  baseOutput: number;
  outputMin: number;
  outputMax: number;
  interactionGain?: number;
  measurementLag?: number;
}

export interface ControllerConfig {
  algorithm: ControllerAlgorithm;
  form: ControllerForm;
  kp: number;
  ti: number;
  td: number;
  bias: number;
  pSource: "error" | "pv";
  dSource: "error" | "pv";
  spFilterEnabled: boolean;
  spFilterTime: number;
  pvFilterEnabled: boolean;
  pvFilterTime: number;
  outputDeadband: number;
  outputLimits: {
    min: number;
    max: number;
  };
  mode: ControllerMode;
  operatingMode: OperatingMode;
  manualOutput: number;
  cascadeGain: number;
  feedforwardGain: number;
}

export interface ProcessOptions {
  noiseLevel: number;
  disturbanceProfile: DisturbanceProfile;
  disturbanceIntensity: number;
  showValveFeedback: boolean;
  valveDeadband: number;
  valveStiction: number;
  valveOvershoot: number;
  flowCharacteristic: "linear" | "equalPercentage" | "quickOpening";
  measurementLag: number;
  backlash: number;
  upsetProbability: number;
  upsetMagnitude: number;
}

export interface AnalogDefaults {
  setpoint: { euMin: number; euMax: number; units: string };
  pv: { euMin: number; euMax: number; units: string };
  disturbance: { euMin: number; euMax: number; units: string };
}

export interface ProcessModelDefinition {
  id: string;
  name: string;
  category: string;
  units: string;
  precision: number;
  controllerDirection: ControlDirection;
  summary: string;
  description: string;
  displayMin: number;
  displayMax: number;
  span: number;
  initialPV: number;
  initialSP: number;
  processParams: ProcessParameters;
  defaultController: ControllerConfig;
  defaultOptions: ProcessOptions;
  analogDefaults: AnalogDefaults;
}

export interface AnalogInputConfig {
  id: string;
  label: string;
  target: "setpoint" | "pv" | "disturbance";
  rawMa: number;
  euMin: number;
  euMax: number;
  enabled: boolean;
}

export interface SignalState {
  setpoint: number | null;
  controllerPv: number | null;
  disturbance: number;
  inputs: Record<string, number>;
}

export interface SimulationOptions {
  setpoint: number;
  controllerConfig: ControllerConfig;
  processOptions: ProcessOptions;
  analogInputs?: AnalogInputConfig[];
}

export interface RuntimeProcessState {
  pv: number;
  state1: number;
  state2: number;
  coupledState: number;
  deadtimeQueue: number[];
}

export interface RuntimeControllerState {
  integral: number;
  previousError: number;
  previousDerivativeSignal: number;
  spFiltered: number;
  pvFiltered: number;
  measuredFiltered: number;
  pvReference: number;
  cascadeIntegral: number;
  heldOutput: number;
}

export interface RuntimeValveState {
  command: number;
  position: number;
  feedback: number | null;
}

export interface RuntimeState {
  baseDt: number;
  time: number;
  history: SimulationSample[];
  maxSamples: number;
  process: RuntimeProcessState;
  controller: RuntimeControllerState;
  valve: RuntimeValveState;
}

export interface SimulationSample {
  time: number;
  pv: number;
  secondaryPv: number;
  sp: number;
  spFiltered: number;
  measuredPv: number;
  pvFiltered: number;
  co: number;
  valvePosition: number | null;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  totalTerm: number;
  noise: number;
  disturbance: number;
  feedforwardContribution: number;
  saturationState: "none" | "low" | "high";
  signals: Record<string, number>;
}

export interface OscillationAnalysis {
  status: OscillationClass;
  amplitude: number;
  period: number | null;
}

export interface StabilityAssessment {
  status: StabilityStatus;
  settling_band_pct: number;
  settling_time_s: number | null;
  overshoot_pct: number;
  steady_state_error: number;
  oscillation_class: OscillationClass;
  saturation_pct_of_run: number;
  advisory_messages: string[];
}

export interface RunMetrics {
  currentError: number;
  pvRange: number;
  coTravel: number;
  valveTravel: number;
  riseTime: number | null;
  settlingTime: number | null;
  overshootPct: number;
  steadyStateOffset: number;
  iae: number;
  ise: number;
  itae: number;
  disturbanceRecoveryTime: number | null;
  saturationTime: number;
  oscillation: OscillationAnalysis;
  stability: StabilityAssessment;
}

export interface TuningRecommendation {
  algorithm: ControllerAlgorithm;
  kp: number;
  ti?: number;
  td?: number;
}

export interface TuningStudyResult {
  method: string;
  note: string;
  recommended?: TuningRecommendation;
  relay?: {
    h: number;
    a: number;
  };
  process?: Record<string, number>;
  closedLoop?: {
    Ku: number;
    Pu: number | null;
    classification: OscillationClass;
  };
}

export interface FineTuneAdvice {
  title: string;
  detail: string;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  objective: string;
  modelId: string;
  controllerConfig?: Partial<ControllerConfig>;
  processOptions?: Partial<ProcessOptions>;
  lockedFields?: string[];
  passCriteria: {
    overshootPct?: number;
    settlingTime?: number;
    steadyStateOffset?: number;
    stabilityStatus?: StabilityStatus;
    saturationPct?: number;
  };
  hints: string[];
  debrief: string[];
}

export interface ScoredAttempt {
  scenarioId: string;
  score: number;
  passed: boolean;
  createdAt: string;
  stability: StabilityStatus;
  overshootPct: number;
  settlingTime: number | null;
  steadyStateOffset: number;
}

export interface SavedRunRecord {
  id: string;
  title: string;
  createdAt: string;
  modelId: string;
  scenarioId?: string;
  metrics: RunMetrics;
  controllerConfig: ControllerConfig;
  processOptions: ProcessOptions;
}
