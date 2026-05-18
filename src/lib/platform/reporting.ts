import { jsPDF } from "jspdf";
import type { RunMetrics, SavedRunRecord } from "@/lib/sim/types";

export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const viewBox = svg.viewBox.baseVal;
  const sourceWidth = viewBox?.width || svg.clientWidth || 960;
  const sourceHeight = viewBox?.height || svg.clientHeight || 320;
  const scale = 2;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(sourceWidth));
  clone.setAttribute("height", String(sourceHeight));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${sourceWidth} ${sourceHeight}`);
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("PNG export failed"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context unavailable");
    }

    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-inset").trim() || "#08111f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadRunReportPdf(record: {
  title: string;
  modelName: string;
  metrics: RunMetrics;
  notes?: string[];
}) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const lines = [
    "PID Trainer Report Card",
    "",
    `Title: ${record.title}`,
    `Model: ${record.modelName}`,
    `Stability: ${record.metrics.stability.status.toUpperCase()}`,
    `Settling Time: ${record.metrics.settlingTime?.toFixed(1) ?? "n/a"} s`,
    `Overshoot: ${record.metrics.overshootPct.toFixed(1)}%`,
    `Steady-State Offset: ${record.metrics.steadyStateOffset.toFixed(2)}`,
    `IAE / ISE / ITAE: ${record.metrics.iae.toFixed(2)} / ${record.metrics.ise.toFixed(2)} / ${record.metrics.itae.toFixed(2)}`,
    `Saturation Time: ${record.metrics.saturationTime.toFixed(1)} s`,
    "",
    "Advisories:"
  ];

  record.metrics.stability.advisory_messages.forEach((message) => {
    lines.push(`- ${message}`);
  });

  if (record.notes?.length) {
    lines.push("", "Notes:");
    record.notes.forEach((note) => {
      lines.push(`- ${note}`);
    });
  }

  pdf.setFillColor(8, 17, 31);
  pdf.rect(0, 0, 612, 792, "F");
  pdf.setTextColor(226, 232, 240);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(lines[0] ?? "PID Trainer Report Card", 44, 56);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  let y = 90;
  for (const line of lines.slice(1)) {
    const wrapped = pdf.splitTextToSize(line, 520);
    pdf.text(wrapped, 44, y);
    y += wrapped.length * 15 + 4;
  }

  pdf.save(`${record.title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function recordToPdfPayload(record: SavedRunRecord, modelName: string) {
  return {
    title: record.title,
    modelName,
    metrics: record.metrics
  };
}
