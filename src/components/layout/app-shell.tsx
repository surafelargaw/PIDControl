"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/platform/navigation";
import { ThemeControls } from "@/components/platform/theme-controls";

function NavGlyph({ route }: Readonly<{ route: string }>) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  switch (route) {
    case "/lab":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19h16" {...commonProps} />
          <path d="M7 19v-7" {...commonProps} />
          <path d="M12 19V7" {...commonProps} />
          <path d="M17 19v-4" {...commonProps} />
        </svg>
      );
    case "/hvac-simulator":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 15h16" {...commonProps} />
          <path d="M6 15V8h12v7" {...commonProps} />
          <path d="M8 11h8" {...commonProps} />
          <path d="M9 19h6" {...commonProps} />
          <path d="M12 15v4" {...commonProps} />
        </svg>
      );
    case "/vendor-pid-lab":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18h16" {...commonProps} />
          <path d="M6 14c2.2 0 2.2-7 4.4-7s2.2 10 4.4 10 2.2-6 3.2-6" {...commonProps} />
          <path d="M7 4v4" {...commonProps} />
          <path d="M17 4v4" {...commonProps} />
        </svg>
      );
    case "/stability-lab":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12c2.4 0 2.4-6 4.8-6s2.4 12 4.8 12 2.4-12 4.8-12 2.4 6 3.6 6" {...commonProps} />
        </svg>
      );
    case "/learn":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 5.5h12" {...commonProps} />
          <path d="M6 10.5h12" {...commonProps} />
          <path d="M6 15.5h8" {...commonProps} />
          <path d="M6 18.5h10" {...commonProps} />
        </svg>
      );
    case "/more":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.3" {...commonProps} />
          <circle cx="12" cy="12" r="1.3" {...commonProps} />
          <circle cx="19" cy="12" r="1.3" {...commonProps} />
        </svg>
      );
    case "/scenarios":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 6.5 17 12 7 17.5Z" {...commonProps} />
        </svg>
      );
    case "/saved-runs":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 19 9v6l-7 5-7-5V9l7-5Z" {...commonProps} />
        </svg>
      );
    case "/instructor":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" {...commonProps} />
          <path d="M5 12h14" {...commonProps} />
          <path d="M7 7h10v10H7Z" {...commonProps} />
        </svg>
      );
    case "/leaderboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18h14" {...commonProps} />
          <path d="M7 18v-5" {...commonProps} />
          <path d="M12 18V8" {...commonProps} />
          <path d="M17 18v-8" {...commonProps} />
        </svg>
      );
    case "/profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" {...commonProps} />
          <path d="M6.5 18a5.5 5.5 0 0 1 11 0" {...commonProps} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="2.2" {...commonProps} />
        </svg>
      );
  }
}

export function AppShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">PID Training Workspace</p>
          <h1>PID Trainer</h1>
          <p>Practice tuning, review stability, and save progress from one calmer workspace.</p>
        </div>

        <nav className="nav-card nav-group" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " active" : ""}`}
              >
                <span className="nav-icon">
                  <NavGlyph route={item.href} />
                </span>
                <span className="nav-link-inner">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <ThemeControls />

        <div className="status-card">
          <p className="eyebrow">Ready State</p>
          <ul>
            <li>Simulator ready</li>
            <li>Model library loaded</li>
            <li>Scenario scoring available</li>
            <li>Browser storage active</li>
          </ul>
        </div>
      </aside>

      <div className="content">{children}</div>
    </div>
  );
}
