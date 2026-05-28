import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  analyzeImportedTrend,
  autoMapImportedColumns,
  parseCsvSheet,
  parseXlsxWorkbook,
  type ImportedTrendRow
} from "../src/lib/imported-trends/import-analysis";

function rowsFromSamples(samples: Array<{ time: number | string; sp: number; pv: number; mv: number }>): ImportedTrendRow[] {
  return samples.map((sample) => ({
    Time: sample.time,
    Setpoint: sample.sp,
    "Process Variable": sample.pv,
    "Controller Output": sample.mv
  }));
}

function defaultMapping() {
  return {
    time: "Time",
    sp: "Setpoint",
    pv: "Process Variable",
    mv: "Controller Output"
  } as const;
}

test("CSV parser reads quoted cells and auto-maps common trend columns", () => {
  const sheet = parseCsvSheet(
    [
      "Timestamp,Setpoint,Process Variable,Controller Output,Kp",
      "\"2026-01-01T00:00:00Z\",50,40,\"45\",2.2",
      "\"2026-01-01T00:00:01Z\",50,42,\"46\",2.2"
    ].join("\n")
  );

  const mapping = autoMapImportedColumns(sheet.columns);

  assert.equal(sheet.rows.length, 2);
  assert.equal(mapping.time, "Timestamp");
  assert.equal(mapping.sp, "Setpoint");
  assert.equal(mapping.pv, "Process Variable");
  assert.equal(mapping.mv, "Controller Output");
  assert.equal(mapping.kp, "Kp");
});

test("XLSX parser reads workbook sheets and supports analysis", async () => {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ["Time", "SP", "PV", "MV"],
    ...Array.from({ length: 25 }, (_, index) => [index, 50, index < 10 ? 40 + index : 50, 50])
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Trend");
  const written = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const buffer = written instanceof ArrayBuffer
    ? written
    : written.buffer.slice(written.byteOffset, written.byteOffset + written.byteLength);

  const [sheet] = await parseXlsxWorkbook(buffer);
  const mapping = autoMapImportedColumns(sheet.columns);
  const analysis = analyzeImportedTrend(sheet.rows, mapping, { pvSpan: 100, outputMin: 0, outputMax: 100 });

  assert.equal(sheet.name, "Trend");
  assert.equal(sheet.rows.length, 25);
  assert.equal(analysis.metrics?.stability.status, "stable");
});

test("timestamp columns are converted to elapsed seconds", () => {
  const samples = Array.from({ length: 30 }, (_, index) => ({
    time: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    sp: 50,
    pv: index < 15 ? 40 + (10 * index) / 15 : 50,
    mv: 50
  }));

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), { pvSpan: 100 });

  assert.equal(analysis.normalized.samples[0].time, 0);
  assert.equal(analysis.normalized.samples[1].time, 1);
  assert.equal(analysis.metrics?.stability.status, "stable");
});

test("analysis rejects trends with too few valid samples", () => {
  const samples = Array.from({ length: 8 }, (_, index) => ({
    time: index,
    sp: 50,
    pv: 40 + index,
    mv: 50
  }));

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), { pvSpan: 100 });

  assert.equal(analysis.metrics, null);
  assert.equal(analysis.normalized.validSampleCount, 8);
  assert.ok(analysis.normalized.messages.some((message) => message.includes("at least 20")));
});

test("analysis reports stable settled response", () => {
  const samples = Array.from({ length: 80 }, (_, index) => ({
    time: index,
    sp: 50,
    pv: index < 30 ? 40 + (10 * index) / 30 : 50 + Math.exp(-(index - 30) / 10) * 0.3,
    mv: 50
  }));

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), { pvSpan: 100 });

  assert.equal(analysis.metrics?.stability.status, "stable");
  assert.equal(analysis.metrics?.stability.oscillationClass, "none");
  assert.ok(analysis.metrics?.settlingTimeS !== null);
});

test("analysis reports marginal response for excessive overshoot", () => {
  const samples = Array.from({ length: 90 }, (_, index) => {
    const pv = index < 20
      ? 40 + (30 * index) / 20
      : 50 + Math.max(0, 20 - (index - 20)) * 0.2;
    return { time: index, sp: 50, pv, mv: 55 };
  });

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), { pvSpan: 100 });

  assert.equal(analysis.metrics?.stability.status, "marginal");
  assert.ok((analysis.metrics?.overshootPct ?? 0) > 10);
});

test("analysis detects output saturation", () => {
  const samples = Array.from({ length: 40 }, (_, index) => ({
    time: index,
    sp: 50,
    pv: index < 20 ? 30 + index : 50,
    mv: 100
  }));

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), {
    pvSpan: 100,
    outputMin: 0,
    outputMax: 100
  });

  assert.ok((analysis.metrics?.saturationPctOfRun ?? 0) > 95);
  assert.equal(analysis.metrics?.stability.status, "unstable");
});

test("analysis reports unstable growing oscillation", () => {
  const samples = Array.from({ length: 120 }, (_, index) => ({
    time: index,
    sp: 0,
    pv: Math.sin(index / 3) * (1 + index / 20),
    mv: index % 2 === 0 ? 100 : 0
  }));

  const analysis = analyzeImportedTrend(rowsFromSamples(samples), defaultMapping(), {
    pvSpan: 20,
    outputMin: -10,
    outputMax: 110
  });

  assert.equal(analysis.metrics?.stability.status, "unstable");
  assert.equal(analysis.metrics?.stability.oscillationClass, "growing");
});
