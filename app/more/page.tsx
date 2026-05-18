import Link from "next/link";

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

export default function MorePage() {
  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Optional Modules</p>
        <h1>More tools</h1>
        <p>
          These modules are available when needed, while keeping the main workspace focused on Lab and Learn.
        </p>
      </section>

      <section className="dashboard-grid">
        {secondaryModules.map((item) => (
          <Link key={item.href} href={item.href} className="dashboard-card">
            <p className="eyebrow">Support Module</p>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
