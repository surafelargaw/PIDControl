import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(process.cwd(), "public", "legacy", "help");

type TextBlock = {
  title: string;
  lines: string[];
};

type Box = TextBlock & {
  x: number;
  y: number;
  width: number;
  height: number;
  tone: "blue" | "green" | "amber" | "violet" | "cyan" | "rose" | "slate";
};

type Arrow = {
  from: [number, number];
  to: [number, number];
  label?: string;
  dashed?: boolean;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textLines(x: number, y: number, lines: string[], className = "text", lineHeight = 25) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`)
    .join("\n");
}

function box(item: Box) {
  const centerX = item.x + item.width / 2;
  return `
  <g>
    <rect class="box ${item.tone}" x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="14" />
    <text x="${centerX}" y="${item.y + 34}" text-anchor="middle" class="box-title">${escapeXml(item.title)}</text>
    ${textLines(item.x + 22, item.y + 68, item.lines, "box-text", 24)}
  </g>`;
}

function arrow(item: Arrow) {
  const [x1, y1] = item.from;
  const [x2, y2] = item.to;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dash = item.dashed ? ` stroke-dasharray="8 8"` : "";
  const label = item.label
    ? `<text x="${midX}" y="${midY - 10}" text-anchor="middle" class="arrow-label">${escapeXml(item.label)}</text>`
    : "";

  return `
  <g>
    <path class="arrow"${dash} d="M ${x1} ${y1} L ${x2} ${y2}" />
    ${label}
  </g>`;
}

function svgFrame(width: number, height: number, title: string, subtitle: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(subtitle)}</desc>
  <defs>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
    </marker>
    <style>
      .canvas { fill: #f8fafc; }
      .page-title { font: 700 38px Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 400 19px Arial, sans-serif; fill: #475569; }
      .box { stroke-width: 2; }
      .blue { fill: #eff6ff; stroke: #60a5fa; }
      .green { fill: #ecfdf5; stroke: #34d399; }
      .amber { fill: #fffbeb; stroke: #f59e0b; }
      .violet { fill: #f5f3ff; stroke: #a78bfa; }
      .cyan { fill: #ecfeff; stroke: #22d3ee; }
      .rose { fill: #fff1f2; stroke: #fb7185; }
      .slate { fill: #f1f5f9; stroke: #94a3b8; }
      .box-title { font: 700 21px Arial, sans-serif; fill: #0f172a; }
      .box-text { font: 400 16px Arial, sans-serif; fill: #334155; }
      .text { font: 400 17px Arial, sans-serif; fill: #334155; }
      .small { font: 400 14px Arial, sans-serif; fill: #475569; }
      .formula { font: 600 18px Consolas, "Courier New", monospace; fill: #0f172a; }
      .formula-note { font: 400 16px Arial, sans-serif; fill: #475569; }
      .arrow { fill: none; stroke: #475569; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; marker-end: url(#arrowhead); }
      .arrow-label { font: 700 14px Arial, sans-serif; fill: #334155; paint-order: stroke; stroke: #f8fafc; stroke-width: 5; stroke-linejoin: round; }
      .divider { stroke: #cbd5e1; stroke-width: 2; stroke-dasharray: 8 8; }
    </style>
  </defs>
  <rect class="canvas" width="${width}" height="${height}" />
  <text x="${width / 2}" y="58" text-anchor="middle" class="page-title">${escapeXml(title)}</text>
  <text x="${width / 2}" y="91" text-anchor="middle" class="subtitle">${escapeXml(subtitle)}</text>
  ${body}
</svg>
`;
}

function pvSignalFlowDiagram() {
  const boxes: Box[] = [
    {
      title: "PID Output",
      x: 48,
      y: 170,
      width: 210,
      height: 128,
      tone: "blue",
      lines: ["CO is clamped by", "output limits", "0 to 100 percent"]
    },
    {
      title: "Final Element",
      x: 310,
      y: 170,
      width: 250,
      height: 128,
      tone: "amber",
      lines: ["deadband, stiction,", "backlash, overshoot,", "valve position"]
    },
    {
      title: "Characteristic + Delay",
      x: 612,
      y: 170,
      width: 282,
      height: 128,
      tone: "violet",
      lines: ["linear / equal percent", "quick opening", "deadtime queue"]
    },
    {
      title: "Process Drive",
      x: 946,
      y: 170,
      width: 350,
      height: 128,
      tone: "green",
      lines: ["drive = sign * gain * delayedDrive", "+ disturbance + interaction"]
    },
    {
      title: "Lag Model",
      x: 440,
      y: 414,
      width: 520,
      height: 146,
      tone: "cyan",
      lines: ["first order: state1 follows drive", "second order: state2 follows state1", "integrating: state accumulates drive"]
    },
    {
      title: "Actual PV",
      x: 1016,
      y: 414,
      width: 280,
      height: 146,
      tone: "rose",
      lines: ["PV = initialPV +", "selected state * span", "clamped to display range"]
    },
    {
      title: "Measurement Path",
      x: 568,
      y: 665,
      width: 392,
      height: 138,
      tone: "slate",
      lines: ["PV + noise + upset", "measurement lag", "optional PV filter"]
    },
    {
      title: "PID Error Uses",
      x: 70,
      y: 665,
      width: 360,
      height: 138,
      tone: "blue",
      lines: ["error = directionSign *", "(SPfiltered - PVfiltered)", "then P, I, D are calculated"]
    }
  ];

  const arrows: Arrow[] = [
    { from: [258, 234], to: [310, 234] },
    { from: [560, 234], to: [612, 234] },
    { from: [894, 234], to: [946, 234] },
    { from: [1121, 298], to: [700, 414], label: "drive[k]" },
    { from: [960, 487], to: [1016, 487] },
    { from: [1156, 560], to: [764, 665], label: "measured from process" },
    { from: [568, 734], to: [430, 734], label: "PVfiltered" },
    { from: [250, 665], to: [153, 298], label: "new CO", dashed: true }
  ];

  const body = `
  <text x="48" y="130" class="subtitle">The simulator separates actual process response from measured controller feedback.</text>
  ${arrows.map(arrow).join("\n")}
  ${boxes.map(box).join("\n")}
  <text x="48" y="855" class="small">Generated by scripts/generate-pv-block-diagrams.ts. Main implementation: src/lib/sim/engine.ts updateValveState() and updateProcessState().</text>`;

  return svgFrame(
    1360,
    900,
    "PV Generation Signal Flow",
    "How controller output becomes actual PV, then measured PV, in the PID simulation.",
    body
  );
}

function formulaPanel(x: number, y: number, width: number, title: string, formulas: string[], notes: string[], tone: Box["tone"]) {
  const item: Box = {
    title,
    x,
    y,
    width,
    height: 290,
    tone,
    lines: []
  };
  return `
  <g>
    ${box(item)}
    ${textLines(x + 28, y + 82, formulas, "formula", 31)}
    <line x1="${x + 28}" y1="${y + 180}" x2="${x + width - 28}" y2="${y + 180}" class="divider" />
    ${textLines(x + 28, y + 215, notes, "formula-note", 25)}
  </g>`;
}

function pvLagFormulaDiagram() {
  const body = `
  <text x="70" y="136" class="subtitle">The same drive signal can feed either a one-lag or two-lag plant. The selected state becomes PV.</text>

  ${formulaPanel(
    70,
    180,
    560,
    "First-Order Self-Regulating Model",
    [
      "x1[k+1] = x1[k] + (dt / lag1) * (drive[k] - x1[k])",
      "PV[k+1] = clamp(initialPV + span * x1[k+1])"
    ],
    [
      "One storage stage. PV moves smoothly toward the drive.",
      "Smaller lag1 means faster response."
    ],
    "cyan"
  )}

  ${formulaPanel(
    710,
    180,
    590,
    "Second-Order Self-Regulating Model",
    [
      "x1[k+1] = x1[k] + (dt / lag1) * (drive[k] - x1[k])",
      "x2[k+1] = x2[k] + (dt / lag2) * (x1[k+1] - x2[k])",
      "PV[k+1] = clamp(initialPV + span * x2[k+1])"
    ],
    [
      "Two storage stages. PV is slower and more damped.",
      "Useful for thermal loops and processes with stored energy."
    ],
    "green"
  )}

  ${formulaPanel(
    70,
    535,
    560,
    "Integrating Model",
    [
      "x1[k+1] = x1[k] + (dt / lag1) *",
      "          (drive[k] - leakage * x1[k])",
      "PV[k+1] = clamp(initialPV + span * x1[k+1])"
    ],
    [
      "Used for level-like behavior.",
      "Sustained drive keeps moving PV until leakage or control balances it."
    ],
    "amber"
  )}

  <g>
    <rect class="box violet" x="710" y="535" width="590" height="290" rx="14" />
    <text x="1005" y="569" text-anchor="middle" class="box-title">Shared Drive Terms</text>
    ${textLines(738, 620, [
      "normalizedDrive = (characteristicPosition - baseOutput) / 100",
      "delayedDrive = deadtimeQueue.shift()",
      "drive = directionSign * gain * delayedDrive + disturbance + interaction"
    ], "formula", 31)}
    <line x1="738" y1="724" x2="1272" y2="724" class="divider" />
    ${textLines(738, 759, [
      "dt is 0.1 seconds in the simulator.",
      "span is displayMax - displayMin.",
      "directionSign handles direct-acting versus reverse-acting processes."
    ], "formula-note", 25)}
  </g>

  <text x="70" y="880" class="small">Generated by scripts/generate-pv-block-diagrams.ts. These equations mirror src/lib/sim/engine.ts updateProcessState().</text>`;

  return svgFrame(
    1370,
    930,
    "PV Lag Model Formulas",
    "The discrete equations used to turn process drive into simulated PV.",
    body
  );
}

function writeDiagram(fileName: string, contents: string) {
  const path = join(outputDir, fileName);
  writeFileSync(path, contents, "utf8");
  console.log(`wrote ${path}`);
}

mkdirSync(outputDir, { recursive: true });
writeDiagram("pv-generation-signal-flow.svg", pvSignalFlowDiagram());
writeDiagram("pv-lag-model-formulas.svg", pvLagFormulaDiagram());
