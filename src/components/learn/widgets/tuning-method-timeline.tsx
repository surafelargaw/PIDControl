export function TuningMethodTimeline() {
  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Ziegler-Nichols vs IMC/Lambda</h3>
        </div>
      </div>

      <div className="lesson-widget-svg-card">
        <svg className="lesson-widget-svg" viewBox="0 0 760 280" role="img" aria-label="Ziegler-Nichols and IMC or Lambda comparison">
          <text x="30" y="40" className="lesson-widget-svg-lane">Ziegler-Nichols path</text>
          <line x1="30" y1="70" x2="730" y2="70" className="lesson-widget-svg-line" />
          <circle cx="90" cy="70" r="16" className="lesson-widget-svg-node" />
          <circle cx="300" cy="70" r="16" className="lesson-widget-svg-node" />
          <circle cx="520" cy="70" r="16" className="lesson-widget-svg-node" />
          <circle cx="680" cy="70" r="16" className="lesson-widget-svg-node" />
          <text x="90" y="110" textAnchor="middle" className="lesson-widget-svg-small">Raise Kp</text>
          <text x="300" y="110" textAnchor="middle" className="lesson-widget-svg-small">Find cycling</text>
          <text x="520" y="110" textAnchor="middle" className="lesson-widget-svg-small">Measure Ku, Pu</text>
          <text x="680" y="110" textAnchor="middle" className="lesson-widget-svg-small">Apply rule</text>

          <text x="30" y="180" className="lesson-widget-svg-lane">IMC / Lambda path</text>
          <line x1="30" y1="210" x2="730" y2="210" className="lesson-widget-svg-line" />
          <rect x="70" y="188" width="110" height="44" rx="10" className="lesson-widget-svg-box" />
          <rect x="255" y="188" width="140" height="44" rx="10" className="lesson-widget-svg-box" />
          <rect x="460" y="188" width="120" height="44" rx="10" className="lesson-widget-svg-box" />
          <rect x="620" y="188" width="90" height="44" rx="10" className="lesson-widget-svg-box" />
          <text x="125" y="214" textAnchor="middle" className="lesson-widget-svg-small">Read process lag</text>
          <text x="325" y="214" textAnchor="middle" className="lesson-widget-svg-small">Choose target speed</text>
          <text x="520" y="214" textAnchor="middle" className="lesson-widget-svg-small">Solve gains</text>
          <text x="665" y="214" textAnchor="middle" className="lesson-widget-svg-small">Validate trend</text>

          <text x="30" y="258" className="lesson-widget-svg-note">
            Ziegler-Nichols looks for the edge of oscillation. IMC/Lambda starts from the process and chooses a calmer target speed on purpose.
          </text>
        </svg>
      </div>
    </section>
  );
}
