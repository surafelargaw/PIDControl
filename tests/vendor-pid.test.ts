import test from "node:test";
import assert from "node:assert/strict";
import { buildVendorPidConfig, getVendorPidProfile, vendorPidProfiles } from "../src/lib/vendor-pid/profiles";
import {
  VendorPidController,
  createVendorPidRuntime,
  proportionalBandToGain,
  simulateVendorPid,
  stepVendorPidRuntime
} from "../src/lib/vendor-pid/runtime";

test("vendor PID profile list includes Siemens, Honeywell, ALC, and JCI", () => {
  const ids = vendorPidProfiles.map((profile) => profile.id);

  assert.ok(ids.includes("siemens-apogee-loop"));
  assert.ok(ids.includes("siemens-tia-pid-compact"));
  assert.ok(ids.includes("honeywell-comfortpoint-open"));
  assert.ok(ids.includes("alc-webctrl-eikon"));
  assert.ok(ids.includes("jci-metasys-prac"));
});

test("Honeywell JACE 8000 profile keeps EPID training algorithm available", () => {
  const profile = getVendorPidProfile("honeywell-comfortpoint-open");
  const runtime = simulateVendorPid(profile.id, "supplyAirTemp", 300);
  const last = runtime.history[runtime.history.length - 1];

  assert.equal(profile.label, "Honeywell JACE 8000");
  assert.equal(profile.shortLabel, "JACE 8000");
  assert.equal(profile.computeKind, "honeywellEpid");
  assert.ok(Number.isFinite(last.pv));
  assert.ok(Number.isFinite(last.mv));
});

test("direct and reverse action move output in opposite directions", () => {
  const profile = getVendorPidProfile("alc-webctrl-eikon");
  const base = {
    ...buildVendorPidConfig("alc-webctrl-eikon", "genericFopdt"),
    bias: 50,
    startupValue: 50,
    kp: 2,
    ti: 1000,
    td: 0,
    interval: 1,
    sampleTime: 1,
    deadband: 0
  };
  const direct = new VendorPidController(profile, { ...base, action: "direct" });
  const reverse = new VendorPidController(profile, { ...base, action: "reverse" });

  assert.ok(direct.compute(60, 50, 0, 1).mv > 50);
  assert.ok(reverse.compute(60, 50, 0, 1).mv < 50);
});

test("sample interval holds output between execution ticks", () => {
  const runtime = createVendorPidRuntime("siemens-apogee-loop", "genericFopdt", {
    sampleTime: 10,
    interval: 10,
    pg: 4,
    ig: 0,
    dg: 0
  });
  const initialMv = runtime.lastResult.mv;
  runtime.plantState.pv = 95;

  stepVendorPidRuntime(runtime, 0.1);

  assert.equal(runtime.lastResult.executedTick, false);
  assert.equal(runtime.lastResult.mv, initialMv);
});

test("clamp anti-windup does not keep integrating into a saturated output", () => {
  const profile = getVendorPidProfile("siemens-apogee-loop");
  const controller = new VendorPidController(profile, {
    ...buildVendorPidConfig("siemens-apogee-loop", "genericFopdt"),
    action: "reverse",
    bias: 50,
    startupValue: 50,
    outputMax: 55,
    pg: 20,
    ig: 1,
    dg: 0,
    sampleTime: 1,
    interval: 1
  });

  let result = controller.compute(0, 100, 0, 1);
  for (let index = 1; index < 40; index += 1) {
    result = controller.compute(0, 100, index, 1);
  }

  assert.equal(result.mv, 55);
  assert.equal(result.saturated, true);
  assert.ok(Math.abs(controller.snapshot.integral) < 0.001);
});

test("manual-to-auto transfer keeps output bumpless", () => {
  const profile = getVendorPidProfile("siemens-tia-pid-compact");
  const controller = new VendorPidController(profile, {
    ...buildVendorPidConfig("siemens-tia-pid-compact", "genericFopdt"),
    mode: "manual",
    manualOutput: 37,
    bias: 50,
    startupValue: 50,
    kp: 2,
    ti: 60,
    td: 0,
    sampleTime: 1,
    interval: 1
  });

  controller.compute(55, 55, 0, 1);
  controller.setConfig({ mode: "auto" });
  const result = controller.compute(55, 55, 1, 1);

  assert.ok(Math.abs(result.mv - 37) < 0.25);
});

test("proportional band converts to internal gain", () => {
  assert.equal(proportionalBandToGain(25), 4);
  assert.equal(proportionalBandToGain(50), 2);
});

test("JCI PRAC+ adapts effective tuning and disables derivative", () => {
  const runtime = simulateVendorPid("jci-metasys-prac", "supplyAirTemp", 180, {
    derivativeTime: 20,
    adaptiveMode: true
  });
  const initialConfig = buildVendorPidConfig("jci-metasys-prac", "supplyAirTemp");

  assert.ok(runtime.lastResult.effectiveProportionalBand !== null);
  assert.ok(runtime.lastResult.effectiveIntegralTime !== null);
  assert.ok((runtime.lastResult.effectiveProportionalBand ?? initialConfig.proportionalBand) < initialConfig.proportionalBand);
  assert.ok((runtime.lastResult.effectiveIntegralTime ?? initialConfig.integralTime) < initialConfig.integralTime);
  assert.equal(runtime.lastResult.dTerm, 0);
});

test("all vendor profiles run 15 simulated minutes without invalid values", () => {
  for (const profile of vendorPidProfiles) {
    const runtime = simulateVendorPid(profile.id, "supplyAirTemp", 900);
    const last = runtime.history[runtime.history.length - 1];

    assert.ok(Number.isFinite(last.pv), profile.id);
    assert.ok(Number.isFinite(last.mv), profile.id);
    assert.ok(last.mv >= 0 && last.mv <= 100, profile.id);
    assert.ok(last.pv >= runtime.plant.displayMin && last.pv <= runtime.plant.displayMax, profile.id);
  }
});
