"use client";

import { useState } from "react";

type DirectionMode = "direct" | "reverse";

const EXAMPLES: Record<DirectionMode, { equipment: string; effect: string }> = {
  direct: {
    equipment: "Heating valve",
    effect: "Output up -> supply air temperature up"
  },
  reverse: {
    equipment: "Cooling valve",
    effect: "Output up -> supply air temperature down"
  }
};

export function DirectReverseDiagram() {
  const [mode, setMode] = useState<DirectionMode>("direct");
  const isDirect = mode === "direct";

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Direct vs reverse acting</h3>
        </div>
        <div className="lesson-widget-segmented">
          <button
            type="button"
            className={`button ${isDirect ? "button-primary" : "button-secondary"}`}
            onClick={() => setMode("direct")}
          >
            Direct
          </button>
          <button
            type="button"
            className={`button ${!isDirect ? "button-primary" : "button-secondary"}`}
            onClick={() => setMode("reverse")}
          >
            Reverse
          </button>
        </div>
      </div>

      <div className="lesson-widget-svg-card">
        <svg className="lesson-widget-svg" viewBox="0 0 720 240" role="img" aria-label="Direct and reverse acting diagram">
          <rect x="40" y="70" width="180" height="100" rx="10" className="lesson-widget-svg-box" />
          <rect x="270" y="70" width="180" height="100" rx="10" className="lesson-widget-svg-box" />
          <rect x="500" y="70" width="180" height="100" rx="10" className="lesson-widget-svg-box" />

          <text x="130" y="118" textAnchor="middle" className="lesson-widget-svg-label">Controller</text>
          <text x="360" y="118" textAnchor="middle" className="lesson-widget-svg-label">Actuator</text>
          <text x="590" y="118" textAnchor="middle" className="lesson-widget-svg-label">Process Variable</text>

          <line x1="220" y1="120" x2="270" y2="120" className="lesson-widget-svg-line" />
          <polygon points="270,120 252,110 252,130" className="lesson-widget-svg-arrow" />

          {isDirect ? (
            <>
              <line x1="450" y1="120" x2="500" y2="120" className="lesson-widget-svg-line" />
              <polygon points="500,120 482,110 482,130" className="lesson-widget-svg-arrow" />
            </>
          ) : (
            <>
              <line x1="500" y1="120" x2="450" y2="120" className="lesson-widget-svg-line" />
              <polygon points="450,120 468,110 468,130" className="lesson-widget-svg-arrow" />
            </>
          )}

          <text x="244" y="98" textAnchor="middle" className="lesson-widget-svg-small">CO up</text>
          <text x="478" y="98" textAnchor="middle" className="lesson-widget-svg-small">
            {isDirect ? "PV up" : "PV down"}
          </text>

          <text x="40" y="205" className="lesson-widget-svg-note">
            {EXAMPLES[mode].equipment}: {EXAMPLES[mode].effect}
          </text>
          <text x="40" y="224" className="lesson-widget-svg-note">
            {isDirect
              ? "Use direct action when more output makes the measured value rise."
              : "Use reverse action when more output makes the measured value fall."}
          </text>
        </svg>
      </div>
    </section>
  );
}
