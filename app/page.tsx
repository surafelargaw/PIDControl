import Link from "next/link";
import { lessonRegistry } from "@/lib/content/lessons";
import { dashboardCards } from "@/lib/platform/navigation";
import { processModelRegistry } from "@/lib/sim/models";

const learningHighlights = [
  {
    href: "/hvac-simulator",
    kicker: "New Simulator",
    title: "Data center HVAC lab",
    description: "Tune direct evaporative, air-cooled, and liquid-cooled loops with diagnostics, alarms, and scenario scoring."
  },
  {
    href: "/learn?lesson=data-driven-tuning",
    kicker: "New Learn Track",
    title: "Data-driven tuning",
    description: "Capture SP, PV, and output trends, fit a process model, and validate before the live loop sees the change."
  },
  {
    href: "/learn?lesson=anti-overshoot-feedforward",
    kicker: "New Learn Track",
    title: "Anti-overshoot structure",
    description: "Study setpoint weighting, feedforward, saturation behavior, and bumpless transfer instead of only detuning the gains."
  },
  {
    href: "/learn?lesson=robotics-motion-notes",
    kicker: "New Learn Track",
    title: "Motion and safety notes",
    description: "Borrow fast-loop lessons on limits, resonance, sampling, and feedforward from robotics and motion control practice."
  }
] as const;

export default function HomePage() {
  return (
    <main className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Calm, focused loop training</p>
          <h1>Train PID decisions in a cleaner, faster workspace.</h1>
          <p className="hero-copy">
            Run the simulator, compare stability, practice scenarios, and study newer data-driven, anti-overshoot, and
            feedforward playbooks from one uncluttered interface built for BAS and HVAC teams.
          </p>
          <div className="hero-meta">
            <div className="hero-stat">
              <strong>{processModelRegistry.length}</strong>
              <span>Process models</span>
            </div>
            <div className="hero-stat">
              <strong>{lessonRegistry.length}</strong>
              <span>Learning tracks</span>
            </div>
            <div className="hero-stat">
              <strong>Local</strong>
              <span>Autosaved progress</span>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link href="/lab" className="button button-primary">
            Open Lab
          </Link>
          <Link href="/stability-lab" className="button button-secondary">
            Stability Lab
          </Link>
          <Link href="/learn" className="button button-secondary">
            Reference
          </Link>
        </div>
      </section>

      <section className="dashboard-grid">
        {dashboardCards.map((card) => (
          <Link key={card.href} href={card.href} className="dashboard-card">
            <p className="eyebrow">{card.kicker}</p>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </Link>
        ))}
      </section>

      <section className="page-card">
        <p className="eyebrow">New Learn Tracks</p>
        <h2>Modern PID ideas, surfaced clearly</h2>
        <p>
          The learning area now includes model-based tuning workflow, anti-overshoot structure, and motion-oriented
          safety notes drawn from practical PID resources.
        </p>
      </section>

      <section className="three-up">
        {learningHighlights.map((highlight) => (
          <Link key={highlight.href} href={highlight.href} className="dashboard-card">
            <p className="eyebrow">{highlight.kicker}</p>
            <h2>{highlight.title}</h2>
            <p>{highlight.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
