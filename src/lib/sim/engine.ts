import { getProcessModel } from "@/lib/sim/models";
import type {
  AnalogInputConfig,
  ControllerConfig,
  ProcessModelDefinition,
  ProcessOptions,
  RuntimeState,
  SignalState,
  SimulationOptions,
  SimulationSample
} from "@/lib/sim/types";
import { average, clamp, roundNumber } from "@/lib/sim/utils";

export const disturbanceProfiles = [
  { id: "none", name: "No disturbance" },
  { id: "stepLoad", name: "Step load" },
  { id: "pulseLoad", name: "Pulse load" },
  { id: "cyclicLoad", name: "Cyclic load" },
  { id: "rampLoad", name: "Ramp load" }
] as const;

export function cloneControllerConfig(config: ControllerConfig): ControllerConfig {
  return {
    ...config,
    outputDeadband: config.outputDeadband ?? 0,
    outputLimits: { ...config.outputLimits }
  };
}

export function cloneProcessOptions(options: ProcessOptions): ProcessOptions {
  return { ...options };
}

export function createSimulationOptions(modelId: string): SimulationOptions {
  const model = getProcessModel(modelId);
  return {
    setpoint: model.initialSP,
    controllerConfig: cloneControllerConfig(model.defaultController),
    processOptions: cloneProcessOptions(model.defaultOptions),
    analogInputs: []
  };
}

export function createRuntime(
  model: ProcessModelDefinition,
  simulationOptions: SimulationOptions
): RuntimeState {
  return createRuntimeForConfig(
    model,
    simulationOptions.controllerConfig,
    simulationOptions.processOptions,
    simulationOptions.setpoint
  );
}

export function createRuntimeForConfig(
  model: ProcessModelDefinition,
  controllerConfig: ControllerConfig,
  processOptions: ProcessOptions,
  operatorSetpoint: number
): RuntimeState {
  const baseDt = 0.1;
  const deadSteps = Math.max(1, Math.round(model.processParams.deadTime / baseDt));
  const initialOutput =
    controllerConfig.mode === "manual" ? controllerConfig.manualOutput : controllerConfig.bias;

  const runtime: RuntimeState = {
    baseDt,
    time: 0,
    history: [],
    maxSamples: 24000,
    process: {
      pv: model.initialPV,
      state1: 0,
      state2: 0,
      coupledState: 0,
      deadtimeQueue: Array(deadSteps).fill(0)
    },
    controller: {
      integral: 0,
      previousError: 0,
      previousDerivativeSignal: 0,
      spFiltered: operatorSetpoint,
      pvFiltered: model.initialPV,
      measuredFiltered: model.initialPV,
      pvReference: operatorSetpoint,
      cascadeIntegral: 0,
      heldOutput: initialOutput
    },
    valve: {
      command: initialOutput,
      position: initialOutput,
      feedback: processOptions.showValveFeedback ? initialOutput : null
    }
  };

  runtime.history.push(
    buildSample(runtime, {
      sp: operatorSetpoint,
      spFiltered: operatorSetpoint,
      measuredPv: model.initialPV,
      pvFiltered: model.initialPV,
      co: initialOutput,
      secondaryPv: model.initialPV,
      valvePosition: runtime.valve.position,
      pTerm: 0,
      iTerm: 0,
      dTerm: 0,
      totalTerm: 0,
      noise: 0,
      disturbance: 0,
      feedforwardContribution: 0,
      saturationState: "none",
      signals: buildEmptySignals()
    })
  );

  return runtime;
}

export function buildEmptySignals(): SignalState {
  return { setpoint: null, controllerPv: null, disturbance: 0, inputs: {} };
}

export function mapAnalogInput(row: AnalogInputConfig) {
  return row.euMin + ((row.rawMa - 4) / 16) * (row.euMax - row.euMin);
}

export function buildSignalState(analogInputs: AnalogInputConfig[]) {
  const signals: SignalState = buildEmptySignals();

  analogInputs.forEach((row) => {
    if (!row.enabled) {
      return;
    }
    const engValue = mapAnalogInput(row);
    signals.inputs[row.id] = roundNumber(row.rawMa, 2);
    if (row.target === "setpoint") {
      signals.setpoint = engValue;
    } else if (row.target === "pv") {
      signals.controllerPv = engValue;
    } else {
      signals.disturbance = mapDisturbanceInput(engValue);
    }
  });

  return signals;
}

export function advanceSimulationStep(
  runtime: RuntimeState,
  dt: number,
  model: ProcessModelDefinition,
  simulationOptions: SimulationOptions,
  signals?: SignalState
) {
  const signalState = signals ?? buildSignalState(simulationOptions.analogInputs ?? []);
  const controllerConfig = simulationOptions.controllerConfig;
  const processOptions = simulationOptions.processOptions;
  const directionSign = model.controllerDirection === "direct" ? 1 : -1;
  const spRaw = signalState.setpoint ?? simulationOptions.setpoint;

  runtime.controller.spFiltered = controllerConfig.spFilterEnabled
    ? applyFirstOrderFilter(runtime.controller.spFiltered, spRaw, controllerConfig.spFilterTime, dt)
    : spRaw;

  const rawNoise = evaluateNoise(model, processOptions.noiseLevel);
  const upset = evaluateRandomUpset(processOptions);
  const baseMeasuredPv = runtime.process.pv + rawNoise + upset;
  runtime.controller.measuredFiltered = applyFirstOrderFilter(
    runtime.controller.measuredFiltered,
    baseMeasuredPv,
    processOptions.measurementLag,
    dt
  );
  const measuredPv = signalState.controllerPv ?? runtime.controller.measuredFiltered;

  runtime.controller.pvFiltered = controllerConfig.pvFilterEnabled
    ? applyFirstOrderFilter(runtime.controller.pvFiltered, measuredPv, controllerConfig.pvFilterTime, dt)
    : measuredPv;

  let controllerError = directionSign * (runtime.controller.spFiltered - runtime.controller.pvFiltered);
  let pReference = runtime.controller.spFiltered;
  let derivativeMeasurement = runtime.controller.pvFiltered;
  let feedforwardContribution = 0;

  if (controllerConfig.operatingMode === "cascade") {
    runtime.controller.cascadeIntegral = clamp(
      runtime.controller.cascadeIntegral + controllerError * controllerConfig.cascadeGain * dt,
      -25,
      25
    );
    const cascadeTarget = clamp(
      controllerConfig.bias + controllerError * controllerConfig.cascadeGain * 12 + runtime.controller.cascadeIntegral,
      controllerConfig.outputLimits.min,
      controllerConfig.outputLimits.max
    );
    pReference = cascadeTarget;
    derivativeMeasurement = runtime.valve.position;
    controllerError = cascadeTarget - runtime.valve.position;
    runtime.controller.pvReference = cascadeTarget;
  } else {
    runtime.controller.pvReference = runtime.controller.spFiltered;
  }

  if (controllerConfig.operatingMode === "feedforward") {
    feedforwardContribution =
      -directionSign * evaluateDisturbance(processOptions.disturbanceProfile, runtime.time, processOptions.disturbanceIntensity) *
      100 *
      controllerConfig.feedforwardGain;
  }

  const controllerTerms = computeControllerTerms(
    runtime,
    controllerConfig,
    {
      error: controllerError,
      pReference,
      derivativeMeasurement,
      directionSign
    },
    dt
  );

  const requestedOutput =
    controllerConfig.mode === "manual"
      ? controllerConfig.manualOutput
      : controllerConfig.bias + controllerTerms.totalTerm + feedforwardContribution;
  const clampedOutput = clamp(
    requestedOutput,
    controllerConfig.outputLimits.min,
    controllerConfig.outputLimits.max
  );

  if (controllerConfig.mode !== "manual") {
    applyAntiWindup(runtime, controllerConfig, controllerError, requestedOutput, clampedOutput, dt);
  }

  const controllerOutput = applyControllerOutputDeadband(runtime, controllerConfig, clampedOutput);
  const delayedDrive = updateValveState(runtime, controllerOutput, dt, processOptions, model, controllerConfig);
  const disturbance =
    evaluateDisturbance(processOptions.disturbanceProfile, runtime.time, processOptions.disturbanceIntensity) +
    signalState.disturbance +
    upset;
  const secondaryPv = updateProcessState(runtime, delayedDrive, disturbance, dt, model, controllerConfig.operatingMode);

  runtime.time = roundNumber(runtime.time + dt, 4);
  runtime.history.push(
    buildSample(runtime, {
      sp: spRaw,
      spFiltered: runtime.controller.spFiltered,
      measuredPv,
      pvFiltered: runtime.controller.pvFiltered,
      co: controllerOutput,
      secondaryPv,
      valvePosition: runtime.valve.feedback,
      pTerm: controllerTerms.pTerm,
      iTerm: controllerTerms.iTerm,
      dTerm: controllerTerms.dTerm,
      totalTerm: controllerTerms.totalTerm,
      noise: rawNoise,
      disturbance,
      feedforwardContribution,
      saturationState:
        controllerOutput <= controllerConfig.outputLimits.min
          ? "low"
          : controllerOutput >= controllerConfig.outputLimits.max
            ? "high"
            : "none",
      signals: signalState
    })
  );

  if (runtime.history.length > runtime.maxSamples) {
    runtime.history.splice(0, runtime.history.length - runtime.maxSamples);
  }
}

export function simulateForDuration(
  model: ProcessModelDefinition,
  simulationOptions: SimulationOptions,
  durationSeconds: number,
  signalBuilder?: (runtime: RuntimeState) => SignalState
) {
  const runtime = createRuntime(model, simulationOptions);
  while (runtime.time < durationSeconds) {
    advanceSimulationStep(
      runtime,
      runtime.baseDt,
      model,
      simulationOptions,
      signalBuilder ? signalBuilder(runtime) : undefined
    );
  }
  return runtime;
}

export function applyFirstOrderFilter(previousValue: number, targetValue: number, timeConstant: number, dt: number) {
  if (timeConstant <= 0) {
    return targetValue;
  }
  return previousValue + (dt / (timeConstant + dt)) * (targetValue - previousValue);
}

export function evaluateNoise(model: ProcessModelDefinition, level: number) {
  const amplitude = (level / 100) * model.span * 0.015;
  return ((Math.random() - 0.5) * 2) * amplitude;
}

export function evaluateRandomUpset(processOptions: ProcessOptions) {
  if (processOptions.upsetProbability <= 0 || processOptions.upsetMagnitude <= 0) {
    return 0;
  }
  if (Math.random() > processOptions.upsetProbability / 1000) {
    return 0;
  }
  return ((Math.random() - 0.5) * 2) * (processOptions.upsetMagnitude / 100);
}

export function evaluateDisturbance(profileId: ProcessOptions["disturbanceProfile"], time: number, intensity: number) {
  const amplitude = (intensity / 100) * 0.55;
  switch (profileId) {
    case "stepLoad":
      return time >= 45 ? amplitude * 0.8 : 0;
    case "pulseLoad":
      if (time >= 35 && time <= 70) {
        return amplitude;
      }
      if (time >= 130 && time <= 170) {
        return -amplitude * 0.75;
      }
      return 0;
    case "cyclicLoad":
      return Math.sin(time / 18) * amplitude * 0.75;
    case "rampLoad":
      if (time < 30) {
        return 0;
      }
      if (time < 120) {
        return ((time - 30) / 90) * amplitude;
      }
      if (time < 210) {
        return amplitude;
      }
      return Math.max(0, 1 - (time - 210) / 70) * amplitude;
    default:
      return 0;
  }
}

export function computeControllerTerms(
  runtime: RuntimeState,
  controllerConfig: ControllerConfig,
  signalContext: {
    error: number;
    pReference: number;
    derivativeMeasurement: number;
    directionSign: number;
  },
  dt: number
) {
  const gains = getControllerGains(controllerConfig);
  const pSignal =
    controllerConfig.pSource === "error"
      ? signalContext.error
      : signalContext.directionSign * (signalContext.pReference - runtime.controller.pvFiltered);
  const dSignal =
    controllerConfig.dSource === "error"
      ? signalContext.error
      : signalContext.directionSign * (0 - signalContext.derivativeMeasurement);

  const pTerm = gains.pGain * pSignal;

  if (controllerConfig.algorithm.includes("I") && controllerConfig.mode !== "manual" && gains.iGain > 0) {
    runtime.controller.integral += gains.iGain * signalContext.error * dt;
    runtime.controller.integral = clamp(runtime.controller.integral, -100, 100);
  }

  const derivativeRate = (dSignal - runtime.controller.previousDerivativeSignal) / dt;
  const dTerm = controllerConfig.algorithm === "PID" ? gains.dGain * derivativeRate : 0;

  runtime.controller.previousError = signalContext.error;
  runtime.controller.previousDerivativeSignal = dSignal;

  return {
    pTerm,
    iTerm: controllerConfig.algorithm.includes("I") ? runtime.controller.integral : 0,
    dTerm,
    totalTerm: pTerm + (controllerConfig.algorithm.includes("I") ? runtime.controller.integral : 0) + dTerm
  };
}

export function getControllerGains(controllerConfig: ControllerConfig) {
  const kp = controllerConfig.kp;
  const ti = Math.max(controllerConfig.ti, 0.0001);
  const td = Math.max(controllerConfig.td, 0);

  if (controllerConfig.form === "parallel") {
    return {
      pGain: kp,
      iGain: controllerConfig.algorithm.includes("I") ? 1 / ti : 0,
      dGain: controllerConfig.algorithm === "PID" ? td : 0
    };
  }

  if (controllerConfig.form === "series") {
    return {
      pGain: kp * (1 + td / Math.max(ti, 1)),
      iGain: controllerConfig.algorithm.includes("I") ? kp / ti : 0,
      dGain: controllerConfig.algorithm === "PID" ? kp * td * 0.65 : 0
    };
  }

  return {
    pGain: kp,
    iGain: controllerConfig.algorithm.includes("I") ? kp / ti : 0,
    dGain: controllerConfig.algorithm === "PID" ? kp * td : 0
  };
}

export function applyAntiWindup(
  runtime: RuntimeState,
  controllerConfig: ControllerConfig,
  error: number,
  requestedOutput: number,
  _clampedOutput: number,
  dt: number
) {
  if (!controllerConfig.algorithm.includes("I")) {
    return;
  }

  const highLimited = requestedOutput > controllerConfig.outputLimits.max;
  const lowLimited = requestedOutput < controllerConfig.outputLimits.min;
  if ((highLimited && error > 0) || (lowLimited && error < 0)) {
    const gains = getControllerGains(controllerConfig);
    runtime.controller.integral -= gains.iGain * error * dt;
  }

  runtime.controller.integral = clamp(runtime.controller.integral, -100, 100);
}

export function applyControllerOutputDeadband(
  runtime: RuntimeState,
  controllerConfig: ControllerConfig,
  clampedOutput: number
) {
  const outputMin = controllerConfig.outputLimits.min;
  const outputMax = controllerConfig.outputLimits.max;
  const boundedOutput = clamp(clampedOutput, outputMin, outputMax);

  if (controllerConfig.mode === "manual") {
    runtime.controller.heldOutput = boundedOutput;
    return boundedOutput;
  }

  const deadband = Math.max(0, controllerConfig.outputDeadband ?? 0);
  const previousOutput = clamp(runtime.controller.heldOutput, outputMin, outputMax);
  runtime.controller.heldOutput = previousOutput;

  if (deadband > 0 && Math.abs(boundedOutput - previousOutput) < deadband) {
    return previousOutput;
  }

  runtime.controller.heldOutput = boundedOutput;
  return boundedOutput;
}

export function updateValveState(
  runtime: RuntimeState,
  clampedOutput: number,
  dt: number,
  processOptions: ProcessOptions,
  model: ProcessModelDefinition,
  controllerConfig: ControllerConfig
) {
  let command = clampedOutput;
  if (Math.abs(command - runtime.valve.command) < processOptions.valveDeadband) {
    command = runtime.valve.command;
  }

  if (Math.sign(command - runtime.valve.command) !== Math.sign(runtime.valve.command - runtime.valve.position)) {
    const deadDirectionChange = Math.abs(command - runtime.valve.command) < processOptions.backlash;
    if (deadDirectionChange) {
      command = runtime.valve.command;
    }
  }

  runtime.valve.command = command;
  let delta = command - runtime.valve.position;
  const direction = Math.sign(delta);

  if (Math.abs(delta) <= processOptions.valveStiction) {
    delta = 0;
  } else if (processOptions.valveStiction > 0) {
    delta -= direction * processOptions.valveStiction * 0.35;
  }

  const overshootFactor = processOptions.valveOvershoot / 100;
  const overshootTarget = runtime.valve.position + delta * (1 + overshootFactor);
  runtime.valve.position += ((overshootTarget - runtime.valve.position) / 1.6) * dt;
  runtime.valve.position = clamp(
    runtime.valve.position,
    controllerConfig.outputLimits.min,
    controllerConfig.outputLimits.max
  );

  const characteristicPosition = applyFlowCharacteristic(runtime.valve.position, processOptions.flowCharacteristic);
  runtime.valve.feedback = processOptions.showValveFeedback ? runtime.valve.position : null;
  const normalizedDrive = (characteristicPosition - model.processParams.baseOutput) / 100;
  const delayedQueue = runtime.process.deadtimeQueue;
  const delayedDrive = delayedQueue.shift() ?? 0;
  delayedQueue.push(normalizedDrive);
  return delayedDrive;
}

export function applyFlowCharacteristic(position: number, characteristic: ProcessOptions["flowCharacteristic"]) {
  const normalized = clamp(position, 0, 100) / 100;
  if (characteristic === "equalPercentage") {
    return ((Math.exp(normalized * 3) - 1) / (Math.exp(3) - 1)) * 100;
  }
  if (characteristic === "quickOpening") {
    return Math.sqrt(normalized) * 100;
  }
  return normalized * 100;
}

export function updateProcessState(
  runtime: RuntimeState,
  delayedDrive: number,
  disturbance: number,
  dt: number,
  model: ProcessModelDefinition,
  operatingMode: ControllerConfig["operatingMode"]
) {
  const params = model.processParams;
  const span = model.span;
  const directionSign = model.controllerDirection === "direct" ? 1 : -1;

  runtime.process.coupledState +=
    ((directionSign * params.gain * delayedDrive + disturbance * 0.4 - runtime.process.coupledState) /
      Math.max(2, params.lag1 * 0.35)) *
    dt;

  const interactionEffect = operatingMode === "interacting"
    ? runtime.process.coupledState * (params.interactionGain ?? 0.15)
    : 0;
  const drive = directionSign * params.gain * delayedDrive + disturbance + interactionEffect;

  if (params.responseType === "integrating") {
    runtime.process.state1 += ((drive - params.leakage * runtime.process.state1) / params.lag1) * dt;
    runtime.process.pv = clamp(model.initialPV + runtime.process.state1 * span, model.displayMin, model.displayMax);
  } else {
    runtime.process.state1 += ((drive - runtime.process.state1) / params.lag1) * dt;
    if (params.lag2 > 0) {
      runtime.process.state2 += ((runtime.process.state1 - runtime.process.state2) / params.lag2) * dt;
    } else {
      runtime.process.state2 = runtime.process.state1;
    }
    runtime.process.pv = clamp(model.initialPV + runtime.process.state2 * span, model.displayMin, model.displayMax);
  }

  return clamp(
    model.initialPV + runtime.process.coupledState * span * 0.6,
    model.displayMin,
    model.displayMax
  );
}

export function buildSample(
  runtime: RuntimeState,
  values: {
    sp: number;
    spFiltered: number;
    measuredPv: number;
    pvFiltered: number;
    co: number;
    secondaryPv: number;
    valvePosition: number | null;
    pTerm: number;
    iTerm: number;
    dTerm: number;
    totalTerm: number;
    noise: number;
    disturbance: number;
    feedforwardContribution: number;
    saturationState: "none" | "low" | "high";
    signals: SignalState;
  }
): SimulationSample {
  return {
    time: roundNumber(runtime.time, 4),
    pv: roundNumber(runtime.process.pv, 4),
    secondaryPv: roundNumber(values.secondaryPv, 4),
    sp: roundNumber(values.sp, 4),
    spFiltered: roundNumber(values.spFiltered, 4),
    measuredPv: roundNumber(values.measuredPv, 4),
    pvFiltered: roundNumber(values.pvFiltered, 4),
    co: roundNumber(values.co, 4),
    valvePosition:
      values.valvePosition === null || values.valvePosition === undefined
        ? null
        : roundNumber(values.valvePosition, 4),
    pTerm: roundNumber(values.pTerm, 4),
    iTerm: roundNumber(values.iTerm, 4),
    dTerm: roundNumber(values.dTerm, 4),
    totalTerm: roundNumber(values.totalTerm, 4),
    noise: roundNumber(values.noise, 4),
    disturbance: roundNumber(values.disturbance, 4),
    feedforwardContribution: roundNumber(values.feedforwardContribution, 4),
    saturationState: values.saturationState,
    signals: { ...values.signals.inputs }
  };
}

export function mapDisturbanceInput(engValue: number) {
  return clamp(engValue / 100, -1, 1);
}

export function getTuningStudyDuration(model: ProcessModelDefinition, fallbackSeconds: number) {
  const dynamicDuration =
    (model.processParams.deadTime + model.processParams.lag1 + model.processParams.lag2 + 15) * 12;
  return clamp(Math.max(fallbackSeconds, dynamicDuration), 180, 900);
}

export function findResponseCrossingTime(
  history: SimulationSample[],
  t0: number,
  baseValue: number,
  targetDelta: number
) {
  const targetValue = baseValue + targetDelta;
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    if (current.time < t0) {
      continue;
    }

    const crossed =
      targetDelta >= 0
        ? previous.pv <= targetValue && current.pv >= targetValue
        : previous.pv >= targetValue && current.pv <= targetValue;

    if (crossed) {
      return previous.time + ((targetValue - previous.pv) / (current.pv - previous.pv)) * (current.time - previous.time);
    }
  }
  return null;
}

export function analyzeOscillationFromHistory(
  history: SimulationSample[],
  startTime: number,
  model: ProcessModelDefinition
) {
  const windowSamples = history.filter((sample) => sample.time >= startTime);
  if (windowSamples.length < 40) {
    return { status: "none" as const, amplitude: 0, period: null };
  }

  const tailValues = windowSamples.slice(-Math.min(windowSamples.length, 400)).map((sample) => sample.pv);
  const center = average(tailValues);
  const threshold = Math.max(model.span * 0.002, 0.01);
  const extrema: Array<{ time: number; value: number; type: "max" | "min" }> = [];

  for (let index = 1; index < windowSamples.length - 1; index += 1) {
    const previous = windowSamples[index - 1].pv;
    const current = windowSamples[index].pv;
    const next = windowSamples[index + 1].pv;
    const isMax = current >= previous && current > next;
    const isMin = current <= previous && current < next;
    if ((isMax || isMin) && Math.abs(current - center) >= threshold) {
      extrema.push({ time: windowSamples[index].time, value: current, type: isMax ? "max" : "min" });
    }
  }

  if (extrema.length < 8) {
    return { status: "decaying" as const, amplitude: 0, period: null };
  }

  const recent = extrema.slice(-8);
  const amplitudes = recent.map((item) => Math.abs(item.value - center));
  const earlyAmplitude = average(amplitudes.slice(0, 4));
  const lateAmplitude = average(amplitudes.slice(-4));
  const ratio = earlyAmplitude > 0 ? lateAmplitude / earlyAmplitude : 0;
  const periods: number[] = [];

  for (let index = 0; index < recent.length - 2; index += 1) {
    if (recent[index].type === recent[index + 2].type) {
      periods.push(recent[index + 2].time - recent[index].time);
    }
  }

  const period = average(periods.slice(-4));
  if (!Number.isFinite(period) || lateAmplitude < threshold * 2) {
    return { status: "decaying" as const, amplitude: lateAmplitude, period: null };
  }

  if (ratio > 1.2) {
    return { status: "growing" as const, amplitude: lateAmplitude, period };
  }
  if (ratio < 0.85) {
    return { status: "decaying" as const, amplitude: lateAmplitude, period };
  }
  return { status: "sustained" as const, amplitude: lateAmplitude, period };
}
