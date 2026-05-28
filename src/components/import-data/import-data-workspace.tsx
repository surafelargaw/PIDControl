"use client";

import { useMemo, useState } from "react";
import { StabilityBadge } from "@/components/sim/stability-badge";
import { TrendChart } from "@/components/sim/trend-chart";
import {
  analyzeImportedTrend,
  autoMapImportedColumns,
  optionalParameterFields,
  parseCsvSheet,
  parseXlsxWorkbook,
  type ImportedTrendColumnMapping,
  type ImportedTrendField,
  type ImportedTrendParameterField,
  type ImportedTrendSheet
} from "@/lib/imported-trends/import-analysis";

const requiredMappingFields: Array<{ field: "time" | "sp" | "pv" | "mv"; label: string }> = [
  { field: "time", label: "Time" },
  { field: "sp", label: "Setpoint" },
  { field: "pv", label: "PV" },
  { field: "mv", label: "CO / MV" }
];

const optionalMappingFields: Array<{ field: ImportedTrendParameterField; label: string }> = [
  { field: "kp", label: "Kp Trace" },
  { field: "ti", label: "Ti / Ki Trace" },
  { field: "td", label: "Td / Kd Trace" },
  { field: "pTerm", label: "P Term" },
  { field: "iTerm", label: "I Term" },
  { field: "dTerm", label: "D Term" }
];

const parameterLabels: Record<ImportedTrendParameterField, string> = {
  kp: "Kp",
  ti: "Ti / Ki",
  td: "Td / Kd",
  pTerm: "P Term",
  iTerm: "I Term",
  dTerm: "D Term"
};

const parameterColors: Record<ImportedTrendParameterField, string> = {
  kp: "#58a6ff",
  ti: "#d29922",
  td: "#bc8cff",
  pTerm: "#00d4ff",
  iTerm: "#f0883e",
  dTerm: "#3fb950"
};

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function formatSeconds(value: number | null) {
  return value === null ? "n/a" : `${formatNumber(value, 1)}s`;
}

function updateMapping(
  current: ImportedTrendColumnMapping,
  field: ImportedTrendField,
  column: string
): ImportedTrendColumnMapping {
  if (!column) {
    const { [field]: _removed, ...rest } = current;
    return rest;
  }
  return { ...current, [field]: column };
}

function ColumnSelect({
  label,
  field,
  value,
  columns,
  required,
  onChange
}: {
  label: string;
  field: ImportedTrendField;
  value: string;
  columns: string[];
  required?: boolean;
  onChange: (field: ImportedTrendField, column: string) => void;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <select value={value} onChange={(event) => onChange(field, event.target.value)}>
        <option value="">{required ? "Select column" : "Not mapped"}</option>
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ImportDataWorkspace() {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ImportedTrendSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ImportedTrendColumnMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [loopName, setLoopName] = useState("");
  const [units, setUnits] = useState("");
  const [pvSpanInput, setPvSpanInput] = useState("");
  const [outputMinInput, setOutputMinInput] = useState("0");
  const [outputMaxInput, setOutputMaxInput] = useState("100");
  const [kpInput, setKpInput] = useState("");
  const [tiInput, setTiInput] = useState("");
  const [tdInput, setTdInput] = useState("");
  const [algorithmInput, setAlgorithmInput] = useState("");
  const [modeInput, setModeInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [sampleTimeInput, setSampleTimeInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const selectedSheet = sheets[selectedSheetIndex] ?? null;
  const outputMin = parseOptionalNumber(outputMinInput) ?? 0;
  const outputMax = parseOptionalNumber(outputMaxInput) ?? 100;

  const analysis = useMemo(() => {
    if (!selectedSheet) {
      return null;
    }

    return analyzeImportedTrend(selectedSheet.rows, mapping, {
      pvSpan: parseOptionalNumber(pvSpanInput),
      outputMin,
      outputMax
    });
  }, [mapping, outputMax, outputMin, pvSpanInput, selectedSheet]);

  const samples = analysis?.normalized.samples ?? [];
  const responseSeries = useMemo(
    () => [
      { label: "SP", color: "#58a6ff", dashed: true, data: samples.map((sample) => ({ x: sample.time, y: sample.sp })) },
      { label: "PV", color: "#3fb950", data: samples.map((sample) => ({ x: sample.time, y: sample.pv })) }
    ],
    [samples]
  );
  const outputSeries = useMemo(
    () => [
      { label: "CO / MV", color: "#f0883e", data: samples.map((sample) => ({ x: sample.time, y: sample.mv })) }
    ],
    [samples]
  );
  const parameterSeries = useMemo(() => {
    const traces = analysis?.normalized.parameterTraces ?? {};
    return optionalParameterFields.flatMap((field) => {
      const data = traces[field];
      return data?.length
        ? [{ label: parameterLabels[field], color: parameterColors[field], dashed: field === "ti" || field === "td", data }]
        : [];
    });
  }, [analysis]);

  const metricCards = analysis?.metrics
    ? [
        { label: "Current Error", value: formatNumber(analysis.metrics.currentError) },
        { label: "PV Span Seen", value: formatNumber(analysis.metrics.pvRange) },
        { label: "MV Travel", value: formatNumber(analysis.metrics.mvTravel, 0) },
        { label: "Overshoot", value: `${formatNumber(analysis.metrics.overshootPct, 1)}%` },
        { label: "Settling Time", value: formatSeconds(analysis.metrics.settlingTimeS) },
        { label: "Steady-State Error", value: formatNumber(analysis.metrics.steadyStateError) },
        { label: "Saturation", value: `${formatNumber(analysis.metrics.saturationPctOfRun, 1)}%` },
        { label: "Duration", value: formatSeconds(analysis.metrics.durationS) },
        { label: "IAE", value: formatNumber(analysis.metrics.iae) },
        { label: "ISE", value: formatNumber(analysis.metrics.ise) },
        { label: "ITAE", value: formatNumber(analysis.metrics.itae) }
      ]
    : [];

  const handleFileChange = async (file: File | null) => {
    setFileError(null);
    setFileName(file?.name ?? "");

    if (!file) {
      setSheets([]);
      setMapping({});
      setSelectedSheetIndex(0);
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      const nextSheets = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")
        ? await parseXlsxWorkbook(await file.arrayBuffer())
        : [parseCsvSheet(await file.text(), file.name)];

      const populatedSheets = nextSheets.filter((sheet) => sheet.columns.length && sheet.rows.length);
      if (!populatedSheets.length) {
        setSheets([]);
        setMapping({});
        setSelectedSheetIndex(0);
        setFileError("No tabular trend rows were found in the uploaded file.");
        return;
      }

      setSheets(populatedSheets);
      setSelectedSheetIndex(0);
      setMapping(autoMapImportedColumns(populatedSheets[0].columns));
    } catch (error) {
      setSheets([]);
      setMapping({});
      setSelectedSheetIndex(0);
      setFileError(error instanceof Error ? error.message : "The file could not be read.");
    }
  };

  const selectSheet = (index: number) => {
    const nextSheet = sheets[index];
    setSelectedSheetIndex(index);
    setMapping(nextSheet ? autoMapImportedColumns(nextSheet.columns) : {});
  };

  return (
    <main className="page-stack">
      <section className="page-card">
        <div className="chip-row">
          <div>
            <p className="eyebrow">Import Data</p>
            <h2>Historical Controller Trend Analysis</h2>
            <p>Upload controller trend data, map SP/PV/CO, and evaluate the response without changing simulator runs.</p>
          </div>
          {analysis?.metrics ? (
            <div className="chip-row">
              <StabilityBadge status={analysis.metrics.stability.status} />
              <span className="pill info">{analysis.normalized.spanSource === "provided" ? "Span provided" : "Span inferred"}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel-grid">
        <div className="page-stack">
          <article className="panel">
            <p className="eyebrow">Source</p>
            <h2>File Upload</h2>
            <div className="field-grid">
              <div className="field">
                <span className="label">Trend File</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(event) => {
                    void handleFileChange(event.target.files?.[0] ?? null);
                  }}
                />
              </div>
              {sheets.length > 1 ? (
                <div className="field">
                  <span className="label">Worksheet</span>
                  <select value={selectedSheetIndex} onChange={(event) => selectSheet(Number(event.target.value))}>
                    {sheets.map((sheet, index) => (
                      <option key={sheet.name} value={index}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            {fileName ? (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                {fileName}
                {selectedSheet ? ` | ${selectedSheet.rows.length} rows | ${selectedSheet.columns.length} columns` : ""}
              </p>
            ) : null}
            {fileError ? <div className="empty-state" style={{ marginTop: "0.75rem" }}>{fileError}</div> : null}
          </article>

          {selectedSheet ? (
            <>
              <article className="panel">
                <p className="eyebrow">Columns</p>
                <h2>Required Signals</h2>
                <div className="field-grid">
                  {requiredMappingFields.map((item) => (
                    <ColumnSelect
                      key={item.field}
                      field={item.field}
                      label={item.label}
                      value={mapping[item.field] ?? ""}
                      columns={selectedSheet.columns}
                      required
                      onChange={(field, column) => setMapping((current) => updateMapping(current, field, column))}
                    />
                  ))}
                </div>
              </article>

              <article className="panel">
                <p className="eyebrow">Optional</p>
                <h2>Parameter Traces</h2>
                <div className="field-grid">
                  {optionalMappingFields.map((item) => (
                    <ColumnSelect
                      key={item.field}
                      field={item.field}
                      label={item.label}
                      value={mapping[item.field] ?? ""}
                      columns={selectedSheet.columns}
                      onChange={(field, column) => setMapping((current) => updateMapping(current, field, column))}
                    />
                  ))}
                </div>
              </article>

              <article className="panel">
                <p className="eyebrow">Context</p>
                <h2>Loop Metadata</h2>
                <div className="field-grid">
                  <div className="field">
                    <span className="label">Loop Name</span>
                    <input value={loopName} onChange={(event) => setLoopName(event.target.value)} placeholder="SAT loop" />
                  </div>
                  <div className="field">
                    <span className="label">Units</span>
                    <input value={units} onChange={(event) => setUnits(event.target.value)} placeholder="degF, %, psi" />
                  </div>
                  <div className="field">
                    <span className="label">PV Span</span>
                    <input type="number" value={pvSpanInput} onChange={(event) => setPvSpanInput(event.target.value)} placeholder="100" />
                  </div>
                  <div className="field">
                    <span className="label">CO Min</span>
                    <input type="number" value={outputMinInput} onChange={(event) => setOutputMinInput(event.target.value)} />
                  </div>
                  <div className="field">
                    <span className="label">CO Max</span>
                    <input type="number" value={outputMaxInput} onChange={(event) => setOutputMaxInput(event.target.value)} />
                  </div>
                  <div className="field">
                    <span className="label">Kp</span>
                    <input value={kpInput} onChange={(event) => setKpInput(event.target.value)} />
                  </div>
                  <div className="field">
                    <span className="label">Ti</span>
                    <input value={tiInput} onChange={(event) => setTiInput(event.target.value)} />
                  </div>
                  <div className="field">
                    <span className="label">Td</span>
                    <input value={tdInput} onChange={(event) => setTdInput(event.target.value)} />
                  </div>
                  <div className="field">
                    <span className="label">Algorithm</span>
                    <input value={algorithmInput} onChange={(event) => setAlgorithmInput(event.target.value)} placeholder="PI, PID" />
                  </div>
                  <div className="field">
                    <span className="label">Mode</span>
                    <input value={modeInput} onChange={(event) => setModeInput(event.target.value)} placeholder="Auto" />
                  </div>
                  <div className="field">
                    <span className="label">Action</span>
                    <input value={actionInput} onChange={(event) => setActionInput(event.target.value)} placeholder="Direct or reverse" />
                  </div>
                  <div className="field">
                    <span className="label">Sample Time</span>
                    <input value={sampleTimeInput} onChange={(event) => setSampleTimeInput(event.target.value)} placeholder="1s" />
                  </div>
                </div>
                <div className="field" style={{ marginTop: "0.75rem" }}>
                  <span className="label">Notes</span>
                  <textarea value={notesInput} onChange={(event) => setNotesInput(event.target.value)} />
                </div>
              </article>
            </>
          ) : null}
        </div>

        <div className="page-stack">
          {analysis ? (
            <>
              {analysis.normalized.messages.length ? (
                <article className="panel">
                  <p className="eyebrow">Validation</p>
                  <h2>Import Notes</h2>
                  <div className="advice-list">
                    {analysis.normalized.messages.map((message) => (
                      <div key={message} className="advice-item">
                        <p className="muted">{message}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {analysis.metrics ? (
                <>
                  <section className="metrics-grid">
                    {metricCards.map((card) => (
                      <article key={card.label} className="metric-card">
                        <p className="eyebrow">{card.label}</p>
                        <h3>{card.value}</h3>
                      </article>
                    ))}
                  </section>

                  <article className="panel">
                    <div className="chip-row">
                      <div>
                        <p className="eyebrow">Verdict</p>
                        <h2>{loopName.trim() || "Imported Loop"}</h2>
                      </div>
                      <StabilityBadge status={analysis.metrics.stability.status} />
                    </div>
                    <div className="advice-list" style={{ marginTop: "0.75rem" }}>
                      {analysis.metrics.stability.advisoryMessages.map((message) => (
                        <div key={message} className="advice-item">
                          <p className="muted">{message}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </>
              ) : (
                <div className="empty-state">Map the required signals and provide at least 20 valid samples to analyze the response.</div>
              )}

              {samples.length ? (
                <>
                  <TrendChart
                    title={units.trim() ? `SP / PV (${units.trim()})` : "SP / PV"}
                    series={responseSeries}
                  />
                  <TrendChart
                    title="CO / MV"
                    series={outputSeries}
                    rightAxis={{ min: analysis.normalized.outputMin, max: analysis.normalized.outputMax, label: "%" }}
                  />
                  {parameterSeries.length ? <TrendChart title="PID Parameters / Terms" series={parameterSeries} /> : null}
                  <article className="panel">
                    <p className="eyebrow">Import Quality</p>
                    <h2>Rows And Limits</h2>
                    <p className="muted">
                      Valid samples {analysis.normalized.validSampleCount} | Rejected rows {analysis.normalized.rejectedRowCount} | Output limits{" "}
                      {formatNumber(analysis.normalized.outputMin)} to {formatNumber(analysis.normalized.outputMax)}
                    </p>
                  </article>
                </>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Upload a CSV or XLSX trend file to start an imported response analysis.</div>
          )}
        </div>
      </section>
    </main>
  );
}
