import test from "node:test";
import assert from "node:assert/strict";
import { assessControlTrendStability } from "../src/lib/control-loop/stability";

test("control trend stability reports stable settled response", () => {
  const samples = Array.from({ length: 80 }, (_, index) => ({
    time: index,
    sp: 50,
    pv: index < 30 ? 40 + (10 * index) / 30 : 50 + Math.exp(-(index - 30) / 10) * 0.3,
    mv: 50,
    saturated: false
  }));

  const assessment = assessControlTrendStability({ samples, span: 100 });

  assert.equal(assessment.status, "stable");
  assert.equal(assessment.oscillationClass, "none");
  assert.ok(assessment.settlingTimeS !== null);
});

test("control trend stability reports unstable growing oscillation", () => {
  const samples = Array.from({ length: 120 }, (_, index) => ({
    time: index,
    sp: 0,
    pv: Math.sin(index / 3) * (1 + index / 20),
    mv: index % 2 === 0 ? 100 : 0,
    saturated: index % 2 === 0
  }));

  const assessment = assessControlTrendStability({
    samples,
    span: 20,
    maxSaturationPct: 80
  });

  assert.equal(assessment.status, "unstable");
  assert.equal(assessment.oscillationClass, "growing");
});
