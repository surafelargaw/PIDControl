import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderMarkdown } from "../src/lib/content/markdown";
import { buildLessonSearchSections, searchLessonSections } from "../src/lib/content/search";
import {
  buildBiasSliderSnapshot,
  buildDeadbandValveSnapshot,
  buildPidResponseLibrary,
  buildValveCharacteristicSnapshot,
  buildWindupTeachingSnapshot
} from "../src/components/learn/widgets/mini-sim";

test("widget directives render as placeholder slots without swallowing later content", () => {
  const html = renderMarkdown(`# Title

<!-- widget:pid-response-chart -->

## Next

Paragraph after widget.`);

  assert.match(html, /data-widget="pid-response-chart"/);
  assert.match(html, /class="lesson-widget-slot"/);
  assert.match(html, /<h2 id="next"><a class="heading-anchor" href="#next">Next<\/a><\/h2>/);
  assert.match(html, /<p>Paragraph after widget\.<\/p>/);
});

test("markdown headings render stable anchors for lesson search jumps", () => {
  const html = renderMarkdown(`## Duct Pressure

Details.`);

  assert.match(html, /<h2 id="duct-pressure"><a class="heading-anchor" href="#duct-pressure">Duct Pressure<\/a><\/h2>/);
});

test("lesson search finds matching technical sections and snippets", () => {
  const sections = buildLessonSearchSections(
    { id: "sample", title: "Sample Lesson", file: "/sample.md" },
    `# Sample Lesson

## Duct Pressure

Fast pressure loops may need filtering.

## Integral Windup

Saturation can trap the integral term.`
  );
  const results = searchLessonSections(sections, "duct pressure");

  assert.equal(results[0]?.heading, "Duct Pressure");
  assert.equal(results[0]?.headingId, "duct-pressure");
  assert.match(results[0]?.snippet ?? "", /Fast pressure loops/);
});

test("PI reduces offset relative to P in the shared response library", () => {
  const responses = buildPidResponseLibrary();

  assert.ok(
    Math.abs(responses.P.result.metrics.steadyStateOffset) >
      Math.abs(responses.PI.result.metrics.steadyStateOffset)
  );
  assert.notEqual(
    responses.PI.result.metrics.overshootPct.toFixed(2),
    responses.PID.result.metrics.overshootPct.toFixed(2)
  );
});

test("windup protection reduces overshoot on saturation release", () => {
  const protectedRun = buildWindupTeachingSnapshot(true);
  const unprotectedRun = buildWindupTeachingSnapshot(false);

  assert.ok(unprotectedRun.overshootPct > protectedRun.overshootPct);
});

test("wider deadband reduces valve travel relative to controller travel", () => {
  const tight = buildDeadbandValveSnapshot(0);
  const wide = buildDeadbandValveSnapshot(4);

  assert.ok(wide.valveTravel < tight.valveTravel);
  assert.ok(wide.lostTravel > tight.lostTravel);
});

test("bias shifts the output centerline without behaving like a hard minimum", () => {
  const lowBias = buildBiasSliderSnapshot(25);
  const highBias = buildBiasSliderSnapshot(45);

  assert.ok(highBias.averageCo > lowBias.averageCo);
  assert.ok(highBias.minCo < 45);
});

test("valve characteristic curves follow expected Cv ordering", () => {
  const snapshot = buildValveCharacteristicSnapshot();
  const curveValue = (label: string, position: number) =>
    snapshot.curveSeries.find((series) => series.label === label)?.data.find((point) => point.x === position)?.y ?? 0;

  assert.ok(curveValue("Quick Opening", 20) > curveValue("Linear", 20));
  assert.ok(curveValue("Equal Percentage", 20) < curveValue("Linear", 20));
  assert.ok(curveValue("Equal Percentage", 50) < curveValue("Linear", 50));

  for (const series of snapshot.curveSeries) {
    assert.equal(series.data[series.data.length - 1]?.y, 100);
  }
});

test("process signals lesson documents searchable valve Cv characteristics", () => {
  const markdown = readFileSync("public/legacy/docs/sections/00d-process-signals-and-trend-tools.md", "utf8");
  const sections = buildLessonSearchSections(
    { id: "process-signals-trends", title: "0.4 Process, Signals, and Trend Tools", file: "/legacy/docs/sections/00d-process-signals-and-trend-tools.md" },
    markdown
  );

  assert.ok(searchLessonSections(sections, "equal percentage").some((section) => section.heading.includes("Valve Cv")));
  assert.ok(searchLessonSections(sections, "quick opening").some((section) => section.heading.includes("Valve Cv")));
  assert.ok(searchLessonSections(sections, "Cv").some((section) => section.heading.includes("Valve Cv")));
});
