export const navItems = [
  {
    href: "/lab",
    title: "Lab",
    description: "Live single-loop simulator, metrics, tuning, and saved runs."
  },
  {
    href: "/hvac-simulator",
    title: "HVAC Simulator",
    description: "Data center cooling loops with direct evap, air-cooled, and liquid-cooled plants."
  },
  {
    href: "/vendor-pid-lab",
    title: "Vendor PID Lab",
    description: "Siemens, Honeywell, ALC, and JCI controller-style PID training profiles."
  },
  {
    href: "/stability-lab",
    title: "Stability Lab",
    description: "Side-by-side stable, marginal, and unstable response coaching."
  },
  {
    href: "/learn",
    title: "Documentation",
    description: "Operator documentation plus data-driven tuning, anti-overshoot, and BAS reference content."
  },
  {
    href: "/more",
    title: "More",
    description: "Optional tools: scenarios, saved runs, instructor, leaderboard, and profile."
  }
] as const;

export const dashboardCards = navItems.map((item) => ({
  ...item,
  kicker: item.title === "Lab" || item.title === "Stability Lab" ? "Core Experience" : "Platform Module"
}));
