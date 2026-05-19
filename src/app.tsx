import { Suspense } from "react";
import { LearnBrowser } from "@/components/content/learn-browser";
import { HvacSimulatorWorkspace } from "@/components/hvac/hvac-simulator-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { InstructorDashboard } from "@/components/platform/instructor-dashboard";
import { LeaderboardPanel } from "@/components/platform/leaderboard-panel";
import { ProfileSettings } from "@/components/platform/profile-settings";
import { SavedRunsBrowser } from "@/components/platform/saved-runs-browser";
import { ScenarioBrowser } from "@/components/platform/scenario-browser";
import { ServiceWorkerRegistration } from "@/components/platform/service-worker-registration";
import { AppLink, useHashRoute } from "@/lib/platform/hash-router";
import { lessonRegistry } from "@/lib/content/lessons";
import { dashboardCards } from "@/lib/platform/navigation";
import { getScenario } from "@/lib/platform/scenarios";
import { processModelRegistry } from "@/lib/sim/models";
import { LabWorkspace } from "@/components/sim/lab-workspace";
import { StabilityLab } from "@/components/sim/stability-lab";
import { VendorPidLab } from "@/components/vendor-pid/vendor-pid-lab";

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

const secondaryModules = [
  {
    href: "/scenarios",
    title: "Scenarios",
    description: "Structured training exercises with pass and fail thresholds."
  },
  {
    href: "/saved-runs",
    title: "Saved Runs",
    description: "Review local attempts, compare tunings, and export reports."
  },
  {
    href: "/instructor",
    title: "Instructor",
    description: "Class assignments, cohort progress, and training oversight."
  },
  {
    href: "/leaderboard",
    title: "Leaderboard",
    description: "Anonymous and team rankings for scored scenario performance."
  },
  {
    href: "/profile",
    title: "Profile",
    description: "Role settings, storage status, and local mode overview."
  }
] as const;

function HomePage() {
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
          <AppLink href="/lab" className="button button-primary">
            Open Lab
          </AppLink>
          <AppLink href="/stability-lab" className="button button-secondary">
            Stability Lab
          </AppLink>
          <AppLink href="/learn" className="button button-secondary">
            Reference
          </AppLink>
        </div>
      </section>

      <section className="dashboard-grid">
        {dashboardCards.map((card) => (
          <AppLink key={card.href} href={card.href} className="dashboard-card">
            <p className="eyebrow">{card.kicker}</p>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </AppLink>
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
          <AppLink key={highlight.href} href={highlight.href} className="dashboard-card">
            <p className="eyebrow">{highlight.kicker}</p>
            <h2>{highlight.title}</h2>
            <p>{highlight.description}</p>
          </AppLink>
        ))}
      </section>
    </main>
  );
}

function MorePage() {
  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Optional Modules</p>
        <h1>More tools</h1>
        <p>These modules are available when needed, while keeping the main workspace focused on Lab and Learn.</p>
      </section>

      <section className="dashboard-grid">
        {secondaryModules.map((item) => (
          <AppLink key={item.href} href={item.href} className="dashboard-card">
            <p className="eyebrow">Support Module</p>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </AppLink>
        ))}
      </section>
    </main>
  );
}

function LabPage() {
  const { params } = useHashRoute();
  const scenario = getScenario(params.get("scenario"));
  return <LabWorkspace scenario={scenario} />;
}

function LearnPage() {
  return (
    <Suspense fallback={<main className="page-stack"><section className="page-card"><p>Loading lessons...</p></section></main>}>
      <LearnBrowser />
    </Suspense>
  );
}

function NotFoundPage() {
  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Route Not Found</p>
        <h1>This workspace page is not available.</h1>
        <p>Return to the dashboard and choose one of the training modules.</p>
        <AppLink href="/" className="button button-primary">
          Open Dashboard
        </AppLink>
      </section>
    </main>
  );
}

function AppRoutes() {
  const { path } = useHashRoute();

  switch (path) {
    case "/":
      return <HomePage />;
    case "/lab":
      return <LabPage />;
    case "/hvac-simulator":
      return <HvacSimulatorWorkspace />;
    case "/vendor-pid-lab":
      return <VendorPidLab />;
    case "/stability-lab":
      return <StabilityLab />;
    case "/learn":
      return <LearnPage />;
    case "/more":
      return <MorePage />;
    case "/scenarios":
      return <ScenarioBrowser />;
    case "/saved-runs":
      return <SavedRunsBrowser />;
    case "/instructor":
      return <InstructorDashboard />;
    case "/leaderboard":
      return <LeaderboardPanel />;
    case "/profile":
      return <ProfileSettings />;
    default:
      return <NotFoundPage />;
  }
}

export function App() {
  return (
    <>
      <ServiceWorkerRegistration />
      <AppShell>
        <AppRoutes />
      </AppShell>
    </>
  );
}
