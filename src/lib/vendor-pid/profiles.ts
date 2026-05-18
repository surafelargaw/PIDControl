import type {
  VendorPidConfig,
  VendorPidNumericField,
  VendorPidPlantDefinition,
  VendorPidPlantId,
  VendorPidProfile,
  VendorPidProfileId
} from "@/lib/vendor-pid/types";

const source = {
  siemensLoop:
    "https://sid.siemens.com/r/A6V10374898/21253010315_23094716171__en-US_1953721995",
  siemensAdaptive:
    "https://sid.siemens.com/r/A6V10374898/21253010315_23094716171__en-US_1951377931",
  tiaCompact:
    "https://docs.tia.siemens.cloud/r/en-us/v21/pid-control-s7-1200-s7-1500-s7-1200-g2/pid_compact-s7-1200-s7-1500-s7-1200-g2/pid_compact-as-of-v2-s7-1200-s7-1500-s7-1200-g2/description-of-pid_compact-v3-s7-1200-s7-1500-s7-1200-g2",
  alcEikon:
    "https://www.automatedlogic.com/en/products/webctrl-building-automation-system/engineering-tools/eikon/",
  alcPid:
    "https://eikonforeducators.automatedlogic.com/downloads/pidbasic.pdf",
  honeywellJace:
    "https://buildings.honeywell.com/content/hbtbt/us/en/products/by-category/control-panels/building-controls/plant-and-integration-controllers/jace-8000-controller.html",
  jciOverview:
    "https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Controller-Tool-Help/16.0.1/PID-PRAC-Commissioning-Overview/PID-Control-and-PRAC-Adaptive-Tuning-within-CCT",
  jciProperties:
    "https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Controller-Tool-Help/15.0/PID-PRAC-Commissioning-Overview/PID-Control-and-PRAC-Adaptive-Tuning-within-CCT/PCT/PID-Inputs-Outputs-and-Properties",
  jciGuide:
    "https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Metasys-System-PID-PRAC-Help-Guide/10.2"
} as const;

const baseConfig: VendorPidConfig = {
  mode: "auto",
  action: "direct",
  sampleTime: 5,
  interval: 5,
  bias: 50,
  manualOutput: 50,
  outputMin: 0,
  outputMax: 100,
  deadband: 0,
  pg: 2.2,
  ig: 0.025,
  dg: 0,
  kp: 2,
  ti: 120,
  td: 0,
  throttlingRange: 34,
  proportionalBand: 34,
  integralTime: 150,
  derivativeTime: 0,
  saturationTime: 60,
  setpointWeight: 1,
  derivativeWeight: 1,
  derivativeFilterTime: 8,
  errorRampTime: 45,
  startupValue: 50,
  adaptiveMode: false,
  outputRateLimit: 0
};

const commonLimits: VendorPidNumericField[] = [
  { key: "bias", label: "Bias", unit: "%", min: 0, max: 100, step: 1, note: "Base output before PID correction." },
  { key: "outputMin", label: "Output Min", unit: "%", min: 0, max: 100, step: 1, note: "Low output clamp." },
  { key: "outputMax", label: "Output Max", unit: "%", min: 0, max: 100, step: 1, note: "High output clamp." },
  { key: "deadband", label: "Deadband", unit: "EU", min: 0, max: 5, step: 0.05, note: "Error ignored around setpoint." }
];

export const vendorPlants: VendorPidPlantDefinition[] = [
  {
    id: "supplyAirTemp",
    label: "AHU Supply Air Temperature",
    units: "deg F",
    precision: 1,
    summary: "Slow cooling loop with actuator limits, sensor lag, and a warm-load disturbance.",
    initialPv: 74,
    setpoint: 68,
    displayMin: 54,
    displayMax: 84,
    outputBase: 45,
    processGain: -18,
    lag1: 42,
    lag2: 16,
    deadTime: 7,
    disturbanceStart: 240,
    disturbanceDuration: 180,
    disturbanceGain: 4.2
  },
  {
    id: "staticPressure",
    label: "Duct Static Pressure",
    units: "in. w.c.",
    precision: 3,
    summary: "Fast fan-pressure loop that makes sample time, deadband, and hunting obvious.",
    initialPv: 0.38,
    setpoint: 0.55,
    displayMin: 0,
    displayMax: 1.2,
    outputBase: 42,
    processGain: 0.9,
    lag1: 8,
    lag2: 2,
    deadTime: 1.2,
    disturbanceStart: 180,
    disturbanceDuration: 90,
    disturbanceGain: -0.12
  },
  {
    id: "chilledWaterValve",
    label: "Chilled-Water Coil SAT",
    units: "deg F",
    precision: 1,
    summary: "Cooling-valve loop with thermal lag and a load step.",
    initialPv: 61,
    setpoint: 55,
    displayMin: 42,
    displayMax: 72,
    outputBase: 48,
    processGain: -15,
    lag1: 30,
    lag2: 12,
    deadTime: 5,
    disturbanceStart: 210,
    disturbanceDuration: 160,
    disturbanceGain: 3.2
  },
  {
    id: "genericFopdt",
    label: "Generic FOPDT Loop",
    units: "%",
    precision: 1,
    summary: "First-order-plus-dead-time process for side-by-side algorithm comparison.",
    initialPv: 42,
    setpoint: 55,
    displayMin: 0,
    displayMax: 100,
    outputBase: 40,
    processGain: 72,
    lag1: 28,
    lag2: 0,
    deadTime: 5,
    disturbanceStart: 220,
    disturbanceDuration: 160,
    disturbanceGain: -7
  }
];

export const vendorPlantMap = Object.fromEntries(vendorPlants.map((plant) => [plant.id, plant])) as Record<
  VendorPidPlantId,
  VendorPidPlantDefinition
>;

export const vendorPidProfiles: VendorPidProfile[] = [
  {
    id: "siemens-apogee-loop",
    vendor: "Siemens",
    family: "APOGEE / PXC",
    label: "Siemens PXC/APOGEE LOOP",
    shortLabel: "Siemens LOOP",
    computeKind: "siemensLoop",
    fidelity: "documented-plus-inferred",
    summary: "Classical BAS positional PID using PG, IG, DG, bias, output limits, action, and configured sample time.",
    behaviorNotes: [
      "The public LOOP interface exposes proportional, integral, and derivative gains plus bias and direct/reverse action.",
      "This training profile uses clamp-style anti-windup because the exact firmware tracking details are not public.",
      "The adaptive APOGEE material is represented as a documented source note, not as exact MFA firmware."
    ],
    fieldDefinitions: [
      { key: "pg", label: "PG", unit: "gain", min: 0, max: 12, step: 0.1, note: "Proportional gain on current error." },
      { key: "ig", label: "IG", unit: "1/s", min: 0, max: 0.2, step: 0.002, note: "Integral gain accumulated on sample ticks." },
      { key: "dg", label: "DG", unit: "s", min: 0, max: 80, step: 0.5, note: "Derivative gain from error rate." },
      { key: "sampleTime", label: "Sample Time", unit: "s", min: 1, max: 60, step: 1, note: "LOOP execution interval." },
      ...commonLimits
    ],
    sourceLinks: [
      { label: "Siemens LOOP docs", href: source.siemensLoop },
      { label: "Siemens adaptive control docs", href: source.siemensAdaptive }
    ],
    defaultConfig: { ...baseConfig, pg: 2.4, ig: 0.026, dg: 0, sampleTime: 5, interval: 5, deadband: 0.15 },
    plantDefaults: {
      staticPressure: { pg: 38, ig: 0.65, deadband: 0.01, bias: 48, sampleTime: 2, interval: 2, action: "reverse" },
      genericFopdt: { pg: 1.5, ig: 0.025, bias: 40, action: "reverse" }
    }
  },
  {
    id: "siemens-tia-pid-compact",
    vendor: "Siemens",
    family: "TIA Portal / PLC",
    label: "Siemens TIA PID_Compact",
    shortLabel: "PID_Compact",
    computeKind: "tiaCompact",
    fidelity: "documented-plus-inferred",
    summary: "PIDT1-style PLC profile with proportional weighting, derivative filtering, tracking anti-windup, and bumpless manual return.",
    behaviorNotes: [
      "Public Siemens TIA material describes PID_Compact as PIDT1 with anti-windup and P/D weighting.",
      "This profile emphasizes filtered derivative and back-calculation style tracking during saturation.",
      "It intentionally feels less like a simple BAS LOOP and more like a PLC technology object."
    ],
    fieldDefinitions: [
      { key: "kp", label: "Gain", unit: "Kp", min: 0, max: 12, step: 0.1, note: "Controller gain." },
      { key: "ti", label: "Integral Time", unit: "s", min: 5, max: 600, step: 5, note: "Larger value means weaker integral." },
      { key: "td", label: "Derivative Time", unit: "s", min: 0, max: 90, step: 0.5, note: "Derivative time before filtering." },
      { key: "setpointWeight", label: "P Weight", unit: "beta", min: 0, max: 1, step: 0.05, note: "Reduces proportional setpoint kick." },
      { key: "derivativeFilterTime", label: "D Filter", unit: "s", min: 0, max: 60, step: 1, note: "T1 filter on derivative action." },
      { key: "sampleTime", label: "Cycle", unit: "s", min: 0.5, max: 30, step: 0.5, note: "Technology-object cycle time." },
      ...commonLimits
    ],
    sourceLinks: [{ label: "Siemens PID_Compact docs", href: source.tiaCompact }],
    defaultConfig: {
      ...baseConfig,
      kp: 2,
      ti: 130,
      td: 0,
      setpointWeight: 0.75,
      derivativeFilterTime: 8,
      sampleTime: 2,
      interval: 2,
      deadband: 0.08
    },
    plantDefaults: {
      staticPressure: { kp: 30, ti: 18, td: 0.4, sampleTime: 0.8, interval: 0.8, bias: 46, deadband: 0.005, action: "reverse" },
      genericFopdt: { kp: 1.4, ti: 75, td: 3, bias: 40, action: "reverse" }
    }
  },
  {
    id: "honeywell-comfortpoint-open",
    vendor: "Honeywell",
    family: "JACE 8000 / Niagara N4",
    label: "Honeywell JACE 8000",
    shortLabel: "JACE 8000",
    computeKind: "honeywellEpid",
    fidelity: "training-approximation",
    summary: "JACE 8000 / Niagara-style BAS EPID training profile using throttling range, integral/derivative time, startup value, and gradual error ramping.",
    behaviorNotes: [
      "Honeywell publishes JACE 8000 product context, but exact Niagara/JACE PID application internals are not openly documented.",
      "This profile is a conservative JACE 8000 / Niagara operator-training approximation that behaves like a slow BAS loop with startup smoothing.",
      "Throttling range is converted to an internal gain with integral time expressed in seconds."
    ],
    fieldDefinitions: [
      { key: "throttlingRange", label: "Throttling Range", unit: "EU", min: 2, max: 80, step: 1, note: "Equivalent proportional band." },
      { key: "integralTime", label: "Integral Time", unit: "s", min: 10, max: 900, step: 5, note: "Reset time used by the training EPID profile." },
      { key: "derivativeTime", label: "Derivative Time", unit: "s", min: 0, max: 90, step: 0.5, note: "Rate time; usually zero on HVAC temperature loops." },
      { key: "errorRampTime", label: "Error Ramp", unit: "s", min: 0, max: 240, step: 5, note: "Softens initial AUTO recovery." },
      { key: "startupValue", label: "Startup Value", unit: "%", min: 0, max: 100, step: 1, note: "Bumpless initial output target." },
      { key: "sampleTime", label: "Period", unit: "s", min: 1, max: 60, step: 1, note: "Controller execution period." },
      ...commonLimits
    ],
    sourceLinks: [{ label: "Honeywell JACE 8000 product context", href: source.honeywellJace }],
    defaultConfig: {
      ...baseConfig,
      throttlingRange: 30,
      integralTime: 180,
      derivativeTime: 0,
      errorRampTime: 60,
      startupValue: 48,
      bias: 48,
      sampleTime: 6,
      interval: 6,
      deadband: 0.2
    },
    plantDefaults: {
      staticPressure: { throttlingRange: 3, integralTime: 26, sampleTime: 3, interval: 3, bias: 45, deadband: 0.012, action: "reverse" },
      genericFopdt: { throttlingRange: 62, integralTime: 120, bias: 40, startupValue: 40, action: "reverse" }
    }
  },
  {
    id: "alc-webctrl-eikon",
    vendor: "Automated Logic",
    family: "WebCTRL / EIKON",
    label: "ALC WebCTRL/EIKON",
    shortLabel: "ALC EIKON",
    computeKind: "alcInterval",
    fidelity: "documented-plus-inferred",
    summary: "Interval-based HVAC PI/PID profile reflecting EIKON training material and Ziegler-Nichols-style TUNE workflow.",
    behaviorNotes: [
      "ALC public training material shows discrete interval PID examples and Ziegler-Nichols open/closed-loop tuning workflow.",
      "This profile keeps the math transparent and shows P, I, and D contribution on execution ticks.",
      "Defaults lean PI because ALC HVAC examples emphasize slow first-order plant behavior."
    ],
    fieldDefinitions: [
      { key: "kp", label: "Kp", unit: "gain", min: 0, max: 60, step: 0.1, note: "Discrete proportional gain." },
      { key: "ti", label: "Ti", unit: "s", min: 5, max: 600, step: 5, note: "Integral time for interval math." },
      { key: "td", label: "Td", unit: "s", min: 0, max: 90, step: 0.5, note: "Derivative time for optional PID." },
      { key: "interval", label: "Interval", unit: "s", min: 1, max: 60, step: 1, note: "Microblock-style execution interval." },
      ...commonLimits
    ],
    sourceLinks: [
      { label: "ALC EIKON overview", href: source.alcEikon },
      { label: "ALC PID training PDF", href: source.alcPid }
    ],
    defaultConfig: {
      ...baseConfig,
      kp: 2.1,
      ti: 155,
      td: 0,
      interval: 5,
      sampleTime: 5,
      bias: 50,
      deadband: 0.12
    },
    plantDefaults: {
      staticPressure: { kp: 32, ti: 20, td: 0, interval: 2, sampleTime: 2, bias: 47, deadband: 0.01, action: "reverse" },
      genericFopdt: { kp: 1.55, ti: 85, td: 0, bias: 40, action: "reverse" }
    }
  },
  {
    id: "jci-metasys-prac",
    vendor: "Johnson Controls",
    family: "Metasys CCT / FEC / FAC",
    label: "JCI Metasys PID/PRAC+",
    shortLabel: "JCI Metasys",
    computeKind: "jciPrac",
    fidelity: "documented-plus-inferred",
    summary: "Metasys-style proportional-band PID with deadband, saturation tracking, bumpless startup value, setpoint weighting, and PRAC+ adaptive mode.",
    behaviorNotes: [
      "The public Metasys PID/PRAC guide documents proportional band, deadband, anti-windup, bumpless transfer, setpoint weighting, and PRAC+ concepts.",
      "Adaptive PRAC+ is modeled as a transparent training approximation: large slow error tightens tuning, hunting relaxes tuning.",
      "Derivative is disabled while adaptive PRAC+ is enabled, matching the intended operator-facing behavior."
    ],
    fieldDefinitions: [
      { key: "proportionalBand", label: "Proportional Band", unit: "EU", min: 1, max: 100, step: 1, note: "PB converted internally to gain." },
      { key: "integralTime", label: "Integral Time", unit: "s", min: 10, max: 900, step: 5, note: "Reset time." },
      { key: "derivativeTime", label: "Derivative Time", unit: "s", min: 0, max: 90, step: 0.5, note: "Disabled in PRAC+ adaptive mode." },
      { key: "interval", label: "Interval", unit: "s", min: 1, max: 60, step: 1, note: "PID execution interval." },
      { key: "saturationTime", label: "Saturation Time", unit: "s", min: 5, max: 240, step: 5, note: "Tracking anti-windup time basis." },
      { key: "setpointWeight", label: "Setpoint Weight", unit: "beta", min: 0, max: 1, step: 0.05, note: "Reduces setpoint-step proportional kick." },
      { key: "startupValue", label: "Startup Value", unit: "%", min: 0, max: 100, step: 1, note: "Bumpless startup output." },
      ...commonLimits
    ],
    sourceLinks: [
      { label: "JCI PID/PRAC+ overview", href: source.jciOverview },
      { label: "JCI PID inputs/properties", href: source.jciProperties },
      { label: "JCI PID/PRAC help guide", href: source.jciGuide }
    ],
    defaultConfig: {
      ...baseConfig,
      proportionalBand: 30,
      integralTime: 165,
      derivativeTime: 0,
      interval: 5,
      sampleTime: 5,
      saturationTime: 60,
      setpointWeight: 0.75,
      startupValue: 48,
      bias: 48,
      deadband: 0.15,
      adaptiveMode: true
    },
    plantDefaults: {
      staticPressure: {
        proportionalBand: 2.6,
        integralTime: 24,
        derivativeTime: 0,
        interval: 2,
        sampleTime: 2,
        bias: 46,
        startupValue: 46,
        deadband: 0.01,
        saturationTime: 25,
        action: "reverse"
      },
      genericFopdt: { proportionalBand: 60, integralTime: 120, bias: 40, startupValue: 40, action: "reverse" }
    }
  }
];

export const vendorPidProfileMap = Object.fromEntries(vendorPidProfiles.map((profile) => [profile.id, profile])) as Record<
  VendorPidProfileId,
  VendorPidProfile
>;

export function getVendorPidProfile(profileId: VendorPidProfileId) {
  return vendorPidProfileMap[profileId] ?? vendorPidProfiles[0];
}

export function getVendorPlant(plantId: VendorPidPlantId) {
  return vendorPlantMap[plantId] ?? vendorPlants[0];
}

export function buildVendorPidConfig(profileId: VendorPidProfileId, plantId: VendorPidPlantId): VendorPidConfig {
  const profile = getVendorPidProfile(profileId);
  const patch = profile.plantDefaults[plantId] ?? {};
  return {
    ...profile.defaultConfig,
    bias: getVendorPlant(plantId).outputBase,
    manualOutput: getVendorPlant(plantId).outputBase,
    startupValue: getVendorPlant(plantId).outputBase,
    ...patch
  };
}
