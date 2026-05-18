import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { lessonRegistry } from "../src/lib/content/lessons";
import { buildLessonSearchSections, searchLessonSections } from "../src/lib/content/search";
import { processModelRegistry } from "../src/lib/sim/models";
import { vendorPidProfiles } from "../src/lib/vendor-pid/profiles";

test("learn tab includes the process model library lesson", () => {
  assert.ok(lessonRegistry.some((lesson) => lesson.id === "process-model-library"));
});

test("learn overview and bridge lessons point repeated topics to canonical sections", () => {
  const overview = readFileSync("public/legacy/docs/sections/00-help-overview.md", "utf8");
  const methodologies = readFileSync("public/legacy/docs/sections/11-pid-tuning-methodologies.md", "utf8");
  const overshoot = readFileSync("public/legacy/docs/sections/19-anti-overshoot-feedforward-and-bumpless-logic.md", "utf8");

  assert.ok(overview.includes("## Canonical Topic Map"));
  assert.ok(methodologies.includes("This lesson is now a methodology map"));
  assert.ok(methodologies.includes("`0.35 Standard Tuning Methods`"));
  assert.ok(methodologies.includes("`18. Data-Driven and Model-Based PID Tuning`"));
  assert.ok(overshoot.includes("canonical lessons"));
  assert.ok(overshoot.includes("`9. Anti-Windup, Bumpless Transfer, and Mode Changes`"));
  assert.ok(overshoot.includes("`0.06 Controller Operating Modes`"));
});

test("process model library documents every simulator model dropdown option", () => {
  const markdown = readFileSync("public/legacy/docs/sections/00f-process-model-library.md", "utf8");

  for (const model of processModelRegistry) {
    assert.ok(markdown.includes(`\`${model.name}\``), `${model.name} should be documented`);
  }
});

test("process signals lesson explains PV and secondary PV in the PID path", () => {
  const markdown = readFileSync("public/legacy/docs/sections/00d-process-signals-and-trend-tools.md", "utf8");

  for (const phrase of [
    "## PV And Secondary PV In The PID Path",
    "primary `PV` is the controlled measurement used by the PID error calculation",
    "`SP - PV = Error`",
    "How The Simulator Generates PV",
    "pv-generation-signal-flow.svg",
    "pv-lag-model-formulas.svg",
    "`Secondary PV` is an intermediate or diagnostic process signal",
    "It is not the main stability verdict signal"
  ]) {
    assert.ok(markdown.includes(phrase), `${phrase} should be documented`);
  }

  for (const file of [
    "public/legacy/help/pv-generation-signal-flow.svg",
    "public/legacy/help/pv-lag-model-formulas.svg"
  ]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }
});

test("stability checker lesson explains residual offset coaching", () => {
  const markdown = readFileSync("public/legacy/docs/sections/00h-stability-checker-guide.md", "utf8");

  for (const phrase of [
    "Fine-Tune Assistant uses a tighter operator-quality target",
    "residual-offset recommendation",
    "`Ti` is too long"
  ]) {
    assert.ok(markdown.includes(phrase), `${phrase} should be documented`);
  }
});

test("standard tuning methods lesson explains current lab study inputs", () => {
  const markdown = readFileSync("public/legacy/docs/sections/00ca-standard-tuning-methods.md", "utf8");

  for (const phrase of ["`IMC / Lambda`", "`Bump Test`", "`Step`", "`Relay Amplitude`", "`Lambda Factor`"]) {
    assert.ok(markdown.includes(phrase), `${phrase} should be documented`);
  }
});

test("learn tab includes the vendor PID technical background lesson", () => {
  const lesson = lessonRegistry.find((entry) => entry.id === "vendor-pid-technical-background");

  assert.ok(lesson);
  assert.equal(lesson.title, "21. Vendor PID Controller Technical Background");
  assert.equal(lesson.file, "/legacy/docs/sections/21-vendor-pid-controller-technical-background.md");
});

test("learn tab includes the PID tuning troubleshooting decision tree lesson", () => {
  const lesson = lessonRegistry.find((entry) => entry.id === "pid-troubleshooting-tree");
  const markdown = readFileSync("public/legacy/docs/sections/22-pid-tuning-troubleshooting-decision-tree.md", "utf8");

  assert.ok(lesson);
  assert.equal(lesson.title, "22. PID Tuning Troubleshooting Decision Tree");
  assert.equal(lesson.file, "/legacy/docs/sections/22-pid-tuning-troubleshooting-decision-tree.md");
  assert.ok(existsSync("public/legacy/help/pid-tuning-troubleshooting-decision-tree.svg"));

  for (const phrase of [
    "Start With Basics",
    "Oscillations Or Hunting",
    "Steady-State Error",
    "Output Saturation Or Windup",
    "[1-ca9034]",
    "[4-1a7b74]"
  ]) {
    assert.ok(markdown.includes(phrase), `${phrase} should be included in the troubleshooting tree lesson`);
  }
});

test("vendor PID technical background documents active profiles, source links, and core terms", () => {
  const markdown = readFileSync("public/legacy/docs/sections/21-vendor-pid-controller-technical-background.md", "utf8");

  for (const profile of vendorPidProfiles) {
    assert.ok(markdown.includes(`\`${profile.label}\``) || markdown.includes(profile.label), `${profile.label} should be documented`);
    for (const source of profile.sourceLinks) {
      assert.ok(markdown.includes(source.href), `${profile.label} source ${source.href} should be included`);
    }
  }

  for (const term of [
    "`PG`",
    "`IG`",
    "`DG`",
    "PIDT1",
    "PRAC+",
    "proportional band",
    "tracking anti-windup",
    "bumpless transfer",
    "setpoint weighting",
    "interval"
  ]) {
    assert.ok(markdown.includes(term), `${term} should be explained`);
  }
});

test("Siemens PID_Compact lesson includes equation, parameter mapping, and training diagrams", () => {
  const markdown = readFileSync("public/legacy/docs/sections/21-vendor-pid-controller-technical-background.md", "utf8");

  for (const phrase of [
    "y = Kp *",
    "`Retain.CtrlParams.Gain`",
    "`Retain.CtrlParams.PWeighting`",
    "`Retain.CtrlParams.TdFiltRatio`",
    "`CurrentSetpoint`",
    "`ScaledInput`",
    "siemens-pid-compact-equation.svg",
    "siemens-pid-compact-block-diagram.svg",
    "siemens-pidt1-anti-windup.svg"
  ]) {
    assert.ok(markdown.includes(phrase), `${phrase} should be included in Siemens PID_Compact detail`);
  }

  for (const file of [
    "public/legacy/help/siemens-pid-compact-equation.svg",
    "public/legacy/help/siemens-pid-compact-block-diagram.svg",
    "public/legacy/help/siemens-pidt1-anti-windup.svg"
  ]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }
});

test("vendor PID technical background is searchable by vendor-specific terms", () => {
  const lesson = {
    id: "vendor-pid-technical-background",
    title: "21. Vendor PID Controller Technical Background",
    file: "/legacy/docs/sections/21-vendor-pid-controller-technical-background.md"
  };
  const markdown = readFileSync("public/legacy/docs/sections/21-vendor-pid-controller-technical-background.md", "utf8");
  const sections = buildLessonSearchSections(lesson, markdown);

  for (const query of ["PID_Compact", "PRAC+", "JACE 8000", "ALC"]) {
    const results = searchLessonSections(sections, query);
    assert.ok(results.length > 0, `${query} should return search results`);
  }
});
