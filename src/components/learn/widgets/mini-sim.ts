import {
  advanceSimulationStep,
  applyFlowCharacteristic,
  createRuntime,
  createSimulationOptions,
  simulateForDuration
} from "@/lib/sim/engine";
import { calculateRunMetrics } from "@/lib/sim/metrics";
import { getProcessModel } from "@/lib/sim/models";
import type {
  ControllerAlgorithm,
  ControllerConfig,
  ProcessModelDefinition,
  ProcessOptions,
  RunMetrics,
  SimulationOptions,
  SimulationSample
} from "@/lib/sim/types";
import { average, clamp, sumTravel } from "@/lib/sim/utils";

export type WidgetPoint = {
  x: number;
  y: number;
};

export type WidgetSeries = {
  label: string;
  color: string;
  data: WidgetPoint[];
  dashed?: boolean;
};

export type MiniSimResult = {
  model: ProcessModelDefinition;
  options: SimulationOptions;
  history: SimulationSample[];
  metrics: RunMetrics;
};

type ControllerOverrides = Partial<ControllerConfig> & {
  outputLimits?: Partial<ControllerConfig["outputLimits"]>;
};

type BuildBaseConfig = {
  modelId: string;
  controller?: ControllerOverrides;
  process?: Partial<ProcessOptions>;
  setpoint?: number;
};

type ManualProfileConfig = BuildBaseConfig & {
  duration: number;
  outputForTime: (time: number) => number;
};

type SetpointProfileConfig = BuildBaseConfig & {
  duration: number;
  setpointForTime: (time: number) => number;
};

export type PidResponseSnapshot = {
  algorithm: ControllerAlgorithm;
  result: MiniSimResult;
  series: WidgetSeries[];
};

export type PidTermExplorerSnapshot = {
  result: MiniSimResult;
  series: WidgetSeries[];
  latestTerms: {
    p: number;
    i: number;
    d: number;
    total: number;
  };
};

export type ProcessTypeComparisonSnapshot = {
  stepAt: number;
  highOutput: number;
  series: WidgetSeries[];
  selfRegulating: MiniSimResult;
  integrating: MiniSimResult;
};

export type DeadbandValveSnapshot = {
  deadband: number;
  result: MiniSimResult;
  series: WidgetSeries[];
  coTravel: number;
  valveTravel: number;
  lostTravel: number;
};

export type BiasSliderSnapshot = {
  bias: number;
  result: MiniSimResult;
  series: WidgetSeries[];
  averageCo: number;
  minCo: number;
  maxCo: number;
};

export type WindupTeachingSnapshot = {
  antiWindup: boolean;
  releaseTime: number;
  series: WidgetSeries[];
  overshootPct: number;
  peakPv: number;
};

export type SetpointWeightingSnapshot = {
  beta: number;
  stepTime: number;
  series: WidgetSeries[];
  overshootPct: number;
  peakPv: number;
  peakCo: number;
  settlingTime: number | null;
};

export type ValveCharacteristic = ProcessOptions["flowCharacteristic"];

export type ValveCharacteristicSnapshot = {
  curveSeries: WidgetSeries[];
  responseSeries: WidgetSeries[];
  results: Record<ValveCharacteristic, MiniSimResult>;
};

const COLORS = {
  pv: "#38bdf8",
  sp: "#22c55e",
  co: "#fb7185",
  p: "#fbbf24",
  i: "#38bdf8",
  d: "#a78bfa",
  selfRegulating: "#38bdf8",
  integrating: "#f59e0b",
  bias: "#fbbf24",
  linear: "#38bdf8",
  equalPercentage: "#a78bfa",
  quickOpening: "#f59e0b"
} as const;

export const valveCharacteristicLabels: Record<ValveCharacteristic, string> = {
  linear: "Linear",
  equalPercentage: "Equal Percentage",
  quickOpening: "Quick Opening"
};

export const valveCharacteristicOrder: ValveCharacteristic[] = ["linear", "equalPercentage", "quickOpening"];

function buildBaseSimulation({
  modelId,
  controller,
  process,
  setpoint
}: BuildBaseConfig): { model: ProcessModelDefinition; options: SimulationOptions } {
  const model = getProcessModel(modelId);
  const options = createSimulationOptions(model.id);

  options.controllerConfig = {
    ...options.controllerConfig,
    ...controller,
    outputLimits: {
      ...options.controllerConfig.outputLimits,
      ...(controller?.outputLimits ?? {})
    }
  };

  options.processOptions = {
    ...options.processOptions,
    noiseLevel: 0,
    disturbanceProfile: "none",
    disturbanceIntensity: 0,
    showValveFeedback: true,
    valveDeadband: 0,
    valveStiction: 0,
    valveOvershoot: 0,
    flowCharacteristic: "linear",
    measurementLag: 0,
    backlash: 0,
    upsetProbability: 0,
    upsetMagnitude: 0,
    ...process
  };

  if (setpoint !== undefined) {
    options.setpoint = setpoint;
  }

  return { model, options };
}

export function historyToSeries(
  history: SimulationSample[],
  selector: (sample: SimulationSample) => number,
  label: string,
  color: string,
  dashed = false
): WidgetSeries {
  return {
    label,
    color,
    dashed,
    data: history.map((sample) => ({ x: sample.time, y: selector(sample) }))
  };
}

export function constantSeries(label: string, color: string, dashed: boolean, duration: number, value: number) {
  return {
    label,
    color,
    dashed,
    data: [
      { x: 0, y: value },
      { x: duration, y: value }
    ]
  } satisfies WidgetSeries;
}

export function runMiniClosedLoop(config: BuildBaseConfig & { duration: number }): MiniSimResult {
  const { model, options } = buildBaseSimulation(config);
  const runtime = simulateForDuration(model, options, config.duration);
  return {
    model,
    options,
    history: runtime.history,
    metrics: calculateRunMetrics(runtime.history, model)
  };
}

export function runMiniClosedLoopProfile(config: SetpointProfileConfig): MiniSimResult {
  const initialSetpoint = config.setpointForTime(0);
  const { model, options } = buildBaseSimulation({ ...config, setpoint: initialSetpoint });
  const runtime = createRuntime(model, options);

  while (runtime.time < config.duration) {
    options.setpoint = config.setpointForTime(runtime.time);
    advanceSimulationStep(runtime, runtime.baseDt, model, options);
  }

  return {
    model,
    options,
    history: runtime.history,
    metrics: calculateRunMetrics(runtime.history, model)
  };
}

export function runMiniManualProfile(config: ManualProfileConfig): MiniSimResult {
  const { model, options } = buildBaseSimulation(config);
  options.controllerConfig = {
    ...options.controllerConfig,
    mode: "manual",
    manualOutput: clamp(
      config.outputForTime(0),
      options.controllerConfig.outputLimits.min,
      options.controllerConfig.outputLimits.max
    )
  };

  const runtime = createRuntime(model, options);

  while (runtime.time < config.duration) {
    options.controllerConfig.manualOutput = clamp(
      config.outputForTime(runtime.time),
      options.controllerConfig.outputLimits.min,
      options.controllerConfig.outputLimits.max
    );
    advanceSimulationStep(runtime, runtime.baseDt, model, options);
  }

  return {
    model,
    options,
    history: runtime.history,
    metrics: calculateRunMetrics(runtime.history, model)
  };
}

export function buildPidResponseLibrary(): Record<ControllerAlgorithm, PidResponseSnapshot> {
  const model = getProcessModel("genericSingleLag");
  const algorithmConfigs: Record<ControllerAlgorithm, ControllerOverrides> = {
    P: { algorithm: "P", kp: 1.05, ti: 24, td: 0 },
    PI: { algorithm: "PI", kp: 1.55, ti: 24, td: 0 },
    PID: { algorithm: "PID", kp: 1.55, ti: 20, td: 4 }
  };

  return (["P", "PI", "PID"] as const).reduce(
    (library, algorithm) => {
      const result = runMiniClosedLoopProfile({
        modelId: "genericSingleLag",
        duration: 160,
        controller: algorithmConfigs[algorithm],
        setpointForTime: (time) => (time < 10 ? model.initialPV : model.initialSP)
      });

      library[algorithm] = {
        algorithm,
        result,
        series: [
          historyToSeries(result.history, (sample) => sample.sp, "SP", COLORS.sp, true),
          historyToSeries(result.history, (sample) => sample.pv, "PV", COLORS.pv),
          historyToSeries(result.history, (sample) => sample.co, "CO", COLORS.co)
        ]
      };

      return library;
    },
    {} as Record<ControllerAlgorithm, PidResponseSnapshot>
  );
}

export function buildPidTermExplorerSnapshot(kp: number, ti: number): PidTermExplorerSnapshot {
  const model = getProcessModel("genericSingleLag");
  const result = runMiniClosedLoopProfile({
    modelId: "genericSingleLag",
    duration: 140,
    controller: {
      algorithm: "PID",
      kp,
      ti,
      td: 4,
      pvFilterEnabled: true,
      pvFilterTime: 1.2
    },
    setpointForTime: (time) => (time < 10 ? model.initialPV : model.initialSP)
  });
  const latest = result.history[result.history.length - 1];

  return {
    result,
    series: [
      historyToSeries(result.history, (sample) => sample.pTerm, "P Term", COLORS.p),
      historyToSeries(result.history, (sample) => sample.iTerm, "I Term", COLORS.i),
      historyToSeries(result.history, (sample) => sample.dTerm, "D Term", COLORS.d)
    ],
    latestTerms: {
      p: latest?.pTerm ?? 0,
      i: latest?.iTerm ?? 0,
      d: latest?.dTerm ?? 0,
      total: latest?.totalTerm ?? 0
    }
  };
}

export function buildProcessTypeComparisonSnapshot(): ProcessTypeComparisonSnapshot {
  const stepAt = 18;
  const baselineOutput = 38;
  const highOutput = 58;
  const outputForTime = (time: number) => (time < stepAt ? baselineOutput : highOutput);

  const selfRegulating = runMiniManualProfile({
    modelId: "genericSingleLag",
    duration: 170,
    setpoint: getProcessModel("genericSingleLag").initialPV,
    controller: { bias: baselineOutput, manualOutput: baselineOutput },
    outputForTime
  });

  const integrating = runMiniManualProfile({
    modelId: "integratingLevel",
    duration: 170,
    setpoint: getProcessModel("integratingLevel").initialPV,
    controller: { bias: baselineOutput, manualOutput: baselineOutput },
    outputForTime
  });

  return {
    stepAt,
    highOutput,
    selfRegulating,
    integrating,
    series: [
      historyToSeries(selfRegulating.history, (sample) => sample.pv, "Self-Regulating", COLORS.selfRegulating),
      historyToSeries(integrating.history, (sample) => sample.pv, "Integrating", COLORS.integrating)
    ]
  };
}

export function buildDeadbandValveSnapshot(deadband: number): DeadbandValveSnapshot {
  const result = runMiniManualProfile({
    modelId: "fanStaticPressure",
    duration: 120,
    controller: { bias: 44, manualOutput: 44 },
    process: { valveDeadband: deadband, showValveFeedback: true },
    outputForTime: (time) => {
      if (time < 12) {
        return 44;
      }
      return 44 + Math.sin(time / 6) * 8 + Math.sin(time / 1.8) * 2.5;
    }
  });

  const valveTravel = sumTravel(result.history, (sample) => sample.valvePosition ?? sample.co);
  const coTravel = sumTravel(result.history, (sample) => sample.co);

  return {
    deadband,
    result,
    coTravel,
    valveTravel,
    lostTravel: Math.max(0, coTravel - valveTravel),
    series: [
      historyToSeries(result.history, (sample) => sample.co, "CO Command", COLORS.co),
      historyToSeries(result.history, (sample) => sample.valvePosition ?? sample.co, "Valve Position", COLORS.pv)
    ]
  };
}

export function buildValveCharacteristicSnapshot(): ValveCharacteristicSnapshot {
  const model = getProcessModel("liquidFlow");
  const curveSeries = valveCharacteristicOrder.map((characteristic) => ({
    label: valveCharacteristicLabels[characteristic],
    color: COLORS[characteristic],
    data: Array.from({ length: 51 }, (_, index) => {
      const position = index * 2;
      return {
        x: position,
        y: Number(applyFlowCharacteristic(position, characteristic).toFixed(4))
      };
    })
  }));

  const results = valveCharacteristicOrder.reduce(
    (library, characteristic) => {
      library[characteristic] = runMiniClosedLoopProfile({
        modelId: model.id,
        duration: 90,
        controller: {
          algorithm: "PI",
          kp: 0.85,
          ti: 12,
          td: 0,
          bias: model.processParams.baseOutput
        },
        process: { flowCharacteristic: characteristic },
        setpointForTime: (time) => (time < 8 ? model.initialPV : model.initialSP)
      });
      return library;
    },
    {} as Record<ValveCharacteristic, MiniSimResult>
  );

  return {
    curveSeries,
    results,
    responseSeries: valveCharacteristicOrder.map((characteristic) =>
      historyToSeries(
        results[characteristic].history,
        (sample) => sample.pv,
        valveCharacteristicLabels[characteristic],
        COLORS[characteristic]
      )
    )
  };
}

export function buildBiasSliderSnapshot(bias: number): BiasSliderSnapshot {
  const model = getProcessModel("genericSingleLag");
  const result = runMiniClosedLoopProfile({
    modelId: "genericSingleLag",
    duration: 150,
    controller: {
      algorithm: "PI",
      kp: 1.45,
      ti: 20,
      td: 0,
      bias
    },
    setpointForTime: (time) => {
      if (time < 10) {
        return model.initialPV;
      }
      if (time < 80) {
        return model.initialSP;
      }
      return model.initialSP - 8;
    }
  });

  const coValues = result.history.map((sample) => sample.co);

  return {
    bias,
    result,
    averageCo: average(coValues),
    minCo: Math.min(...coValues),
    maxCo: Math.max(...coValues),
    series: [
      historyToSeries(result.history, (sample) => sample.co, "CO", COLORS.co),
      constantSeries("Bias", COLORS.bias, true, result.history[result.history.length - 1]?.time ?? 0, bias)
    ]
  };
}

export function buildWindupTeachingSnapshot(antiWindup: boolean): WindupTeachingSnapshot {
  const dt = 0.25;
  const duration = 100;
  const releaseTime = 42;
  const kp = 1.25;
  const ki = 0.11;
  const timeConstant = 12;
  const gain = 1.4;
  const lowerLimit = 0;

  let pv = 0;
  let integral = 0;
  let output = 0;
  const history: WidgetPoint[] = [];
  const spHistory: WidgetPoint[] = [];
  const outputHistory: WidgetPoint[] = [];

  for (let time = 0; time <= duration; time += dt) {
    const setpoint = 80;
    const upperLimit = time < releaseTime ? 45 : 100;
    const error = setpoint - pv;
    const requested = kp * error + integral;
    output = clamp(requested, lowerLimit, upperLimit);

    if (antiWindup) {
      const saturatingHigh = requested > upperLimit && error > 0;
      const saturatingLow = requested < lowerLimit && error < 0;
      if (!saturatingHigh && !saturatingLow) {
        integral += ki * error * dt;
      }
    } else {
      integral += ki * error * dt;
    }

    pv += ((gain * output) - pv) / timeConstant * dt;

    history.push({ x: Number(time.toFixed(3)), y: Number(pv.toFixed(4)) });
    spHistory.push({ x: Number(time.toFixed(3)), y: setpoint });
    outputHistory.push({ x: Number(time.toFixed(3)), y: Number(output.toFixed(4)) });
  }

  const peakPv = Math.max(...history.map((point) => point.y));
  const overshootPct = Math.max(0, ((peakPv - 80) / 80) * 100);

  return {
    antiWindup,
    releaseTime,
    peakPv,
    overshootPct,
    series: [
      { label: "SP", color: COLORS.sp, dashed: true, data: spHistory },
      { label: "PV", color: COLORS.pv, data: history },
      { label: "CO", color: COLORS.co, data: outputHistory }
    ]
  };
}

export function buildSetpointWeightingSnapshot(beta: number): SetpointWeightingSnapshot {
  const dt = 0.25;
  const duration = 140;
  const stepTime = 8;
  const baseSetpoint = 44;
  const targetSetpoint = 60;
  const bias = 37;
  const kp = 2.1;
  const ki = 0.085;
  const gain = 1.08;
  const timeConstant = 18;
  const deadTime = 4;
  const lowerLimit = 0;
  const upperLimit = 100;
  const deadSteps = Math.max(1, Math.round(deadTime / dt));

  let pv = baseSetpoint;
  let integral = -kp * ((beta * baseSetpoint) - pv);
  let output = bias;

  const driveQueue = Array(deadSteps).fill(0);
  const pvHistory: WidgetPoint[] = [];
  const spHistory: WidgetPoint[] = [];
  const outputHistory: WidgetPoint[] = [];

  for (let time = 0; time <= duration; time += dt) {
    const setpoint = time < stepTime ? baseSetpoint : targetSetpoint;
    const error = setpoint - pv;
    const weightedSignal = (beta * setpoint) - pv;
    const requested = bias + (kp * weightedSignal) + integral;
    output = clamp(requested, lowerLimit, upperLimit);

    const saturatingHigh = requested > upperLimit && error > 0;
    const saturatingLow = requested < lowerLimit && error < 0;
    if (!saturatingHigh && !saturatingLow) {
      integral += ki * error * dt;
    }

    const delayedDrive = driveQueue.shift() ?? 0;
    driveQueue.push(output - bias);
    const targetPv = baseSetpoint + (gain * delayedDrive);
    pv += ((targetPv - pv) / timeConstant) * dt;

    pvHistory.push({ x: Number(time.toFixed(3)), y: Number(pv.toFixed(4)) });
    spHistory.push({ x: Number(time.toFixed(3)), y: setpoint });
    outputHistory.push({ x: Number(time.toFixed(3)), y: Number(output.toFixed(4)) });
  }

  const postStepPv = pvHistory.filter((point) => point.x >= stepTime);
  const postStepCo = outputHistory.filter((point) => point.x >= stepTime);
  const peakPv = Math.max(...postStepPv.map((point) => point.y));
  const peakCo = Math.max(...postStepCo.map((point) => point.y));
  const overshootPct = Math.max(0, ((peakPv - targetSetpoint) / targetSetpoint) * 100);
  const settlingBand = Math.max(0.4, Math.abs(targetSetpoint - baseSetpoint) * 0.02);

  let settlingTime: number | null = null;
  for (let index = 0; index < postStepPv.length; index += 1) {
    const candidate = postStepPv[index];
    const remainsSettled = postStepPv
      .slice(index)
      .every((point) => Math.abs(point.y - targetSetpoint) <= settlingBand);
    if (remainsSettled) {
      settlingTime = Number((candidate.x - stepTime).toFixed(2));
      break;
    }
  }

  return {
    beta,
    stepTime,
    peakPv,
    peakCo,
    overshootPct,
    settlingTime,
    series: [
      { label: "SP", color: COLORS.sp, dashed: true, data: spHistory },
      { label: "PV", color: COLORS.pv, data: pvHistory },
      { label: "CO", color: COLORS.co, data: outputHistory }
    ]
  };
}
