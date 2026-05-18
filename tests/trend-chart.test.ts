import test from "node:test";
import assert from "node:assert/strict";
import {
  interpolateSeriesValueAtX,
  mapValueToChartY,
  resolveAxisDomain,
  resolveBandPlacement,
  resolveCursorLabelRows
} from "../src/components/sim/trend-chart";

test("trend chart cursor interpolation returns exact matching point values", () => {
  const value = interpolateSeriesValueAtX([
    { x: 0, y: 10 },
    { x: 5, y: 20 },
    { x: 10, y: 40 }
  ], 5);

  assert.equal(value, 20);
});

test("trend chart cursor interpolation returns values between samples", () => {
  const value = interpolateSeriesValueAtX([
    { x: 0, y: 10 },
    { x: 10, y: 30 }
  ], 2.5);

  assert.equal(value, 15);
});

test("trend chart cursor interpolation ignores cursor times outside series bounds", () => {
  const value = interpolateSeriesValueAtX([
    { x: 4, y: 10 },
    { x: 10, y: 30 }
  ], 2);

  assert.equal(value, null);
});

test("trend chart cursor rows stay inside the chart and avoid collisions", () => {
  const rows = resolveCursorLabelRows([{ y: 12 }, { y: 14 }, { y: 16 }], 20, 90, 18);

  assert.ok(rows.every((row) => row >= 20 && row <= 90));
  assert.ok(Math.abs(rows[1] - rows[0]) >= 18);
  assert.ok(Math.abs(rows[2] - rows[1]) >= 18);
});

test("trend chart keeps left and right series domains independent", () => {
  const series = [
    { label: "PV", color: "#fff", data: [{ x: 0, y: 68 }, { x: 1, y: 70 }] },
    { label: "Manual Output", color: "#f00", axis: "right" as const, data: [{ x: 0, y: 100 }, { x: 1, y: 0 }] }
  ];

  const leftDomain = resolveAxisDomain(series, "left");
  const rightDomain = resolveAxisDomain(series, "right", { min: 0, max: 100 });

  assert.ok(leftDomain.minY > 60);
  assert.ok(leftDomain.maxY < 75);
  assert.deepEqual(rightDomain, { minY: 0, maxY: 100 });
});

test("trend chart maps right-axis output values without changing left-axis scaling", () => {
  const leftDomain = resolveAxisDomain([
    { label: "PV", color: "#fff", data: [{ x: 0, y: 68 }, { x: 1, y: 70 }] }
  ], "left");
  const rightDomain = resolveAxisDomain([], "right", { min: 0, max: 100 });

  assert.equal(mapValueToChartY(100, rightDomain, 20, 120), 20);
  assert.ok(mapValueToChartY(100, leftDomain, 20, 120) < 20);
});

test("trend chart deadband bands clamp inside chart bounds", () => {
  const fullBand = resolveBandPlacement(-10, 110, { minY: 0, maxY: 100 }, 20, 120);
  const partialBand = resolveBandPlacement(45, 55, { minY: 0, maxY: 100 }, 20, 120);

  assert.deepEqual(fullBand, { y: 20, height: 100 });
  assert.ok(partialBand.y >= 20);
  assert.ok(partialBand.y + partialBand.height <= 120);
  assert.ok(partialBand.height > 0);
});
