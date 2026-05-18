import test from "node:test";
import assert from "node:assert/strict";
import { HvacAssessmentEngine } from "../src/lib/hvac/assessment";
import { evaluateHvacAlarms } from "../src/lib/hvac/diagnostics";
import { HvacPidController } from "../src/lib/hvac/pid";
import { generateHvacFineTuneAdvice } from "../src/lib/hvac/advice";
import { humidityRatioFromDryWet, relativeHumidityFromDbW, wetBulbFromDryBulbRh } from "../src/lib/hvac/psychrometrics";
import { getHvacScenario } from "../src/lib/hvac/scenarios";
import { createHvacRuntime, getHvacRuntimeView, loadHvacScenario, stepHvacRuntime } from "../src/lib/hvac/runtime";

test("psychrometric helpers clamp humidity values to display-safe bounds", () => {
  const humidRatio = humidityRatioFromDryWet(95, 92);
  const rh = relativeHumidityFromDbW(75, 0.08);

  assert.ok(humidRatio >= 0);
  assert.ok(humidRatio <= 0.04);
  assert.ok(rh >= 0);
  assert.ok(rh <= 100);
});

test("wet-bulb approximation responds to relative humidity", () => {
  const dryBulb = 95;
  const dryAirWetBulb = wetBulbFromDryBulbRh(dryBulb, 25);
  const humidAirWetBulb = wetBulbFromDryBulbRh(dryBulb, 85);

  assert.ok(dryAirWetBulb < humidAirWetBulb);
  assert.ok(humidAirWetBulb <= dryBulb);
  assert.ok(wetBulbFromDryBulbRh(80, 100) > 78);
});

test("PID bumpless transfer keeps manual-to-auto output from jumping", () => {
  const pid = new HvacPidController({
    name: "Test",
    kp: 2,
    ki: 0.1,
    kd: 0,
    sp: 10,
    bias: 50,
    mode: "manual",
    manualOutput: 32,
    outputMin: 0,
    outputMax: 100,
    rateLimit: 0,
    deadband: 0,
    antiWindup: "clamp",
    backCalcTt: 10,
    derivOnMeas: true,
    derivN: 8,
    reverseAction: false
  });

  pid.compute(10, 10, 0.1);
  pid.set({ mode: "auto" });
  const result = pid.compute(10, 10, 0.1);

  assert.ok(Math.abs(result.mv - 32) < 0.5);
});

test("PID clamp anti-windup does not keep integrating into saturation", () => {
  const pid = new HvacPidController({
    name: "Windup",
    kp: 20,
    ki: 0.5,
    kd: 0,
    sp: 100,
    bias: 50,
    mode: "auto",
    manualOutput: 50,
    outputMin: 0,
    outputMax: 60,
    rateLimit: 0,
    deadband: 0,
    antiWindup: "clamp",
    backCalcTt: 10,
    derivOnMeas: true,
    derivN: 8,
    reverseAction: false
  });

  for (let index = 0; index < 200; index += 1) {
    pid.compute(0, 100, 0.1);
  }

  assert.ok(Math.abs(pid.result.integral) < 1);
  assert.equal(pid.result.saturated, true);
});

test("derivative on measurement avoids setpoint kick", () => {
  const pid = new HvacPidController({
    name: "Derivative",
    kp: 0,
    ki: 0,
    kd: 20,
    sp: 10,
    bias: 50,
    mode: "auto",
    manualOutput: 50,
    outputMin: 0,
    outputMax: 100,
    rateLimit: 0,
    deadband: 0,
    antiWindup: "off",
    backCalcTt: 10,
    derivOnMeas: true,
    derivN: 8,
    reverseAction: false
  });

  pid.compute(10, 10, 0.1);
  const result = pid.compute(10, 25, 0.1);

  assert.ok(Math.abs(result.dTerm) < 0.001);
});

test("rate limit caps fast output movement", () => {
  const pid = new HvacPidController({
    name: "Rate",
    kp: 100,
    ki: 0,
    kd: 0,
    sp: 1,
    bias: 0,
    mode: "auto",
    manualOutput: 0,
    outputMin: 0,
    outputMax: 100,
    rateLimit: 10,
    deadband: 0,
    antiWindup: "off",
    backCalcTt: 10,
    derivOnMeas: true,
    derivN: 8,
    reverseAction: false
  });

  const result = pid.compute(0, 1, 0.1);

  assert.ok(result.mv <= 1.01);
});

test("all HVAC templates run without invalid values", () => {
  for (const template of ["directEvap", "airCooled", "liquidCooled"] as const) {
    const runtime = createHvacRuntime(template);
    for (let index = 0; index < 900; index += 1) {
      stepHvacRuntime(runtime);
    }
    const plant = runtime.plant.getSnapshot();
    assert.ok(Number.isFinite(plant.supplyAirTempPv));
    assert.ok(Number.isFinite(plant.staticPressurePv));
    assert.ok(plant.supplyRH >= 0 && plant.supplyRH <= 100);
  }
});

test("direct evap default can approach the 68 deg F SAT target", () => {
  const runtime = createHvacRuntime("directEvap");
  for (let index = 0; index < 2400; index += 1) {
    stepHvacRuntime(runtime);
  }
  const satPv = runtime.plant.getLoopPv("sat");

  assert.ok(Math.abs(satPv - 68) < 5);
});

test("scenario engine fires timed disturbances", () => {
  const runtime = createHvacRuntime("directEvap");
  const scenario = getHvacScenario("level3_bypass_jam");
  assert.ok(scenario);
  loadHvacScenario(runtime, scenario);
  for (let index = 0; index < 1810; index += 1) {
    stepHvacRuntime(runtime);
  }

  assert.equal(runtime.plant.getSnapshot().bypassDamperJammed, true);
});

test("alarm evaluator reports high humidity", () => {
  const runtime = createHvacRuntime("directEvap");
  const plant = { ...runtime.plant.getSnapshot(), supplyRH: 90 };
  const alarms = evaluateHvacAlarms(plant, runtime.lastResults.sat, new Set());

  assert.ok(alarms.some((alarm) => alarm.id === "high-rh"));
});

test("assessment scoring penalizes alarms and error", () => {
  const scenario = getHvacScenario("level1_first_contact");
  assert.ok(scenario);
  const assessment = new HvacAssessmentEngine();
  assessment.reset(scenario);
  for (let index = 0; index < 140; index += 1) {
    assessment.sample({
      simTime: index,
      template: "directEvap",
      satSp: 68,
      satPv: 76,
      satMv: 90,
      pressureSp: 0.45,
      pressurePv: 0.45,
      pressureMv: 55,
      outerSp: 80,
      outerPv: 80,
      outerMv: 68,
      activeSp: 68,
      activePv: 76,
      activeMv: 90,
      error: 8,
      integral: 100,
      pTerm: 16,
      iTerm: 4,
      dTerm: 0,
      supplyRH: 60,
      roomTemp: 82,
      staticPressure: 0.45,
      primaryMvDelta: 0,
      alarms: ["high-sat"],
      plant: createHvacRuntime("directEvap").plant.getSnapshot()
    }, 1, false);
  }

  assert.ok((assessment.getSnapshot().score ?? 100) < 90);
});

test("HVAC fine-tune advice explains direct evap SAT final elements", () => {
  const runtime = createHvacRuntime("directEvap");
  for (let index = 0; index < 240; index += 1) {
    stepHvacRuntime(runtime);
  }
  runtime.activeLoop = "sat";
  const advice = generateHvacFineTuneAdvice(getHvacRuntimeView(runtime));
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.match(text, /SAT PID/i);
  assert.match(text, /face damper/i);
  assert.match(text, /bypass/i);
  assert.match(text, /OAT|WBT/i);
});

test("HVAC fine-tune advice separates equipment faults from tuning", () => {
  const runtime = createHvacRuntime("directEvap");
  runtime.plant.applyState({ bypassDamperJammed: true, padFouling: 0.4, outdoorDryBulb: 88, outdoorWetBulb: 84 });
  for (let index = 0; index < 240; index += 1) {
    stepHvacRuntime(runtime);
  }
  const advice = generateHvacFineTuneAdvice(getHvacRuntimeView(runtime));
  const text = advice.map((item) => `${item.title} ${item.detail}`).join(" ");

  assert.match(text, /equipment|jammed|fouled/i);
  assert.match(text, /Humidity|wet-bulb|RH/i);
});
