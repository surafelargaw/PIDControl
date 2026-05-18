import test from "node:test";
import assert from "node:assert/strict";
import { advanceSimulationStep, createRuntime, createSimulationOptions, simulateForDuration } from "../src/lib/sim/engine";
import { calculateRunMetrics } from "../src/lib/sim/metrics";
import { getProcessModel } from "../src/lib/sim/models";
import { generateFineTuneAdvice, runTuningStudy } from "../src/lib/sim/tuning";
import { getScenario, scoreScenarioAttempt } from "../src/lib/platform/scenarios";

function buildDeadbandTestOptions(outputDeadband = 0, valveDeadband = 0) {
  const model = getProcessModel("genericSingleLag");
  const options = createSimulationOptions(model.id);
  options.setpoint = 50;
  options.controllerConfig.algorithm = "P";
  options.controllerConfig.kp = 1;
  options.controllerConfig.bias = 50;
  options.controllerConfig.mode = "auto";
  options.controllerConfig.outputDeadband = outputDeadband;
  options.controllerConfig.outputLimits = { min: 0, max: 100 };
  options.processOptions.noiseLevel = 0;
  options.processOptions.disturbanceProfile = "none";
  options.processOptions.disturbanceIntensity = 0;
  options.processOptions.measurementLag = 0;
  options.processOptions.showValveFeedback = true;
  options.processOptions.valveDeadband = valveDeadband;
  options.processOptions.valveStiction = 0;
  options.processOptions.valveOvershoot = 0;
  options.processOptions.backlash = 0;
  options.processOptions.upsetMagnitude = 0;
  options.processOptions.upsetProbability = 0;
  return { model, options };
}

function controllerPvSignal(controllerPv: number) {
  return {
    setpoint: null,
    controllerPv,
    disturbance: 0,
    inputs: {}
  };
}

function runOutputSineProfile(outputDeadband = 0, valveDeadband = 0, amplitude = 8) {
  const { model, options } = buildDeadbandTestOptions(outputDeadband, valveDeadband);
  const runtime = simulateForDuration(model, options, 24, (currentRuntime) =>
    controllerPvSignal(50 - Math.sin(currentRuntime.time * 1.4) * amplitude)
  );
  return { model, options, runtime, metrics: calculateRunMetrics(runtime.history, model) };
}

function runFlowCharacteristicProfile(characteristic: "linear" | "equalPercentage" | "quickOpening") {
  const model = getProcessModel("liquidFlow");
  const options = createSimulationOptions(model.id);
  options.processOptions.noiseLevel = 0;
  options.processOptions.disturbanceProfile = "none";
  options.processOptions.disturbanceIntensity = 0;
  options.processOptions.measurementLag = 0;
  options.processOptions.flowCharacteristic = characteristic;
  const runtime = simulateForDuration(model, options, 70);
  return { runtime, metrics: calculateRunMetrics(runtime.history, model) };
}

test("stable tuning produces a non-unstable verdict", () => {
  const model = getProcessModel("genericSingleLag");
  const options = createSimulationOptions(model.id);
  const runtime = simulateForDuration(model, options, 180);
  const metrics = calculateRunMetrics(runtime.history, model);

  assert.notEqual(metrics.stability.status, "unstable");
  assert.ok(metrics.iae >= 0);
});

test("aggressive tuning is detected as marginal or unstable", () => {
  const model = getProcessModel("genericDoubleLag");
  const options = createSimulationOptions(model.id);
  options.controllerConfig.kp = 6;
  options.controllerConfig.ti = 2;
  options.controllerConfig.td = 0;
  options.processOptions.disturbanceProfile = "cyclicLoad";
  options.processOptions.disturbanceIntensity = 35;
  const runtime = simulateForDuration(model, options, 120);
  const metrics = calculateRunMetrics(runtime.history, model);

  assert.ok(["marginal", "unstable"].includes(metrics.stability.status));
});

test("aggressive tuning advice suggests concrete Kp or Ti changes", () => {
  const model = getProcessModel("genericDoubleLag");
  const options = createSimulationOptions(model.id);
  options.controllerConfig.kp = 6;
  options.controllerConfig.ti = 2;
  options.controllerConfig.td = 0;
  options.processOptions.disturbanceProfile = "cyclicLoad";
  options.processOptions.disturbanceIntensity = 35;
  const runtime = simulateForDuration(model, options, 120);
  const advice = generateFineTuneAdvice(model, options.controllerConfig, runtime.history, options.processOptions);
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.match(text, /Kp|Ti/);
  assert.match(text, /reduce|increase|cut|lower/i);
});

test("slow calm response is marginal and advice suggests careful speedup", () => {
  const model = getProcessModel("genericSingleLag");
  const options = createSimulationOptions(model.id);
  options.controllerConfig.kp = 0.08;
  options.controllerConfig.ti = 120;
  const runtime = simulateForDuration(model, options, 120);
  const metrics = calculateRunMetrics(runtime.history, model);
  const advice = generateFineTuneAdvice(model, options.controllerConfig, runtime.history, options.processOptions);
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.equal(metrics.stability.status, "marginal");
  assert.match(text, /speed|increase Kp|shorten Ti|recovery/i);
  assert.doesNotMatch(text, /Reduce aggressiveness first/i);
});

test("stable but biased response suggests removing residual offset", () => {
  const model = getProcessModel("genericSingleLag");
  const options = createSimulationOptions(model.id);
  options.controllerConfig.ti = 240;
  const runtime = simulateForDuration(model, options, 300);
  const metrics = calculateRunMetrics(runtime.history, model);
  const advice = generateFineTuneAdvice(model, options.controllerConfig, runtime.history, options.processOptions);
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.equal(metrics.stability.status, "stable");
  assert.ok(Math.abs(metrics.steadyStateOffset) > model.span * 0.01);
  assert.match(text, /residual offset|Shorten Ti|zero-error/i);
  assert.doesNotMatch(text, /Balanced response/i);
  assert.ok(
    metrics.stability.advisory_messages.some((message) => message.includes("Residual steady-state offset")),
    "stability notes should explain stable-but-biased response"
  );
});

test("stability lab teaching presets produce stable marginal and unstable examples", () => {
  const model = getProcessModel("genericDoubleLag");
  const presets = [
    { expected: "stable", controller: { kp: 2, ti: 90, td: 0 } },
    { expected: "marginal", controller: { kp: 1.2, ti: 32, td: 0.6 } },
    { expected: "unstable", controller: { kp: 3.2, ti: 6, td: 0.1 } }
  ] as const;

  for (const preset of presets) {
    const options = createSimulationOptions(model.id);
    options.controllerConfig = { ...options.controllerConfig, ...preset.controller };
    const runtime = simulateForDuration(model, options, 180);
    const metrics = calculateRunMetrics(runtime.history, model);

    assert.equal(metrics.stability.status, preset.expected);
  }
});

test("noisy derivative-heavy run suggests derivative reduction or filtering", () => {
  const model = getProcessModel("genericSingleLag");
  const options = createSimulationOptions(model.id);
  options.controllerConfig.algorithm = "PID";
  options.controllerConfig.td = 12;
  options.processOptions.noiseLevel = 25;
  const runtime = simulateForDuration(model, options, 120);
  const advice = generateFineTuneAdvice(model, options.controllerConfig, runtime.history, options.processOptions);
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.match(text, /derivative|Td|PV filter/i);
});

test("IMC lambda study returns a recommendation", () => {
  const model = getProcessModel("reactorTemperature");
  const result = runTuningStudy({
    model,
    method: "imcLambda",
    targetAlgorithm: "PID",
    lambdaFactor: 2.5
  });

  assert.ok(result.recommended);
  assert.ok((result.recommended?.kp ?? 0) > 0);
});

test("scenario scoring enforces pass/fail thresholds", () => {
  const scenario = getScenario("level-tight-settle");
  assert.ok(scenario);

  const passing = scoreScenarioAttempt(scenario!, {
    overshootPct: 3,
    settlingTime: 30,
    steadyStateOffset: 1,
    saturationPct: 0,
    stabilityStatus: "stable"
  });

  const failing = scoreScenarioAttempt(scenario!, {
    overshootPct: 18,
    settlingTime: 80,
    steadyStateOffset: 5,
    saturationPct: 30,
    stabilityStatus: "unstable"
  });

  assert.equal(passing.passed, true);
  assert.equal(failing.passed, false);
  assert.ok(passing.score > failing.score);
});

test("PID output deadband holds small controller output changes", () => {
  const { model, options } = buildDeadbandTestOptions(10, 0);
  const runtime = createRuntime(model, options);

  advanceSimulationStep(runtime, runtime.baseDt, model, options, controllerPvSignal(46));
  const smallMoveSample = runtime.history[runtime.history.length - 1];

  assert.equal(smallMoveSample.co, 50);
  assert.equal(smallMoveSample.pTerm, 4);

  advanceSimulationStep(runtime, runtime.baseDt, model, options, controllerPvSignal(40));
  const thresholdMoveSample = runtime.history[runtime.history.length - 1];

  assert.equal(thresholdMoveSample.co, 60);
});

test("PID output deadband reduces controller output travel", () => {
  const noDeadband = runOutputSineProfile(0, 0);
  const heldOutput = runOutputSineProfile(10, 0);

  assert.ok(noDeadband.metrics.coTravel > 0);
  assert.ok(heldOutput.metrics.coTravel < noDeadband.metrics.coTravel * 0.25);
});

test("actuator deadband reduces valve travel without suppressing CO", () => {
  const actuatorDeadband = runOutputSineProfile(0, 10);

  assert.ok(actuatorDeadband.metrics.coTravel > 0);
  assert.ok(actuatorDeadband.metrics.valveTravel < actuatorDeadband.metrics.coTravel * 0.25);
});

test("PID output and actuator deadbands can run together", () => {
  const combined = runOutputSineProfile(5, 5, 12);
  const { min, max } = combined.runtime.history[0]
    ? combined.runtime.history.reduce(
        (range, sample) => ({
          min: Math.min(range.min, sample.co),
          max: Math.max(range.max, sample.co)
        }),
        { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
      )
    : { min: 0, max: 0 };

  assert.ok(combined.runtime.history.every((sample) => Number.isFinite(sample.co)));
  assert.ok(combined.runtime.history.every((sample) => sample.valvePosition !== null));
  assert.ok(min >= combined.options.controllerConfig.outputLimits.min);
  assert.ok(max <= combined.options.controllerConfig.outputLimits.max);
  assert.ok(Number.isFinite(combined.metrics.coTravel));
  assert.ok(Number.isFinite(combined.metrics.valveTravel));
});

test("flow characteristic changes closed-loop process response", () => {
  const linear = runFlowCharacteristicProfile("linear");
  const equalPercentage = runFlowCharacteristicProfile("equalPercentage");
  const quickOpening = runFlowCharacteristicProfile("quickOpening");

  assert.ok(Math.abs(linear.metrics.iae - equalPercentage.metrics.iae) > 50);
  assert.ok(Math.abs(linear.metrics.overshootPct - quickOpening.metrics.overshootPct) > 5);
  assert.notEqual(
    linear.runtime.history[linear.runtime.history.length - 1]?.pv.toFixed(3),
    quickOpening.runtime.history[quickOpening.runtime.history.length - 1]?.pv.toFixed(3)
  );
});
