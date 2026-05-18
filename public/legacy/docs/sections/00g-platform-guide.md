# PID Trainer Platform — User Guide

This guide explains every section of the PID Trainer Platform, how to navigate it, and what each **Training Persona** role unlocks.

---

## Getting Started

Open the platform at **http://localhost:3000**. The sidebar on the left lists all eight sections. Your current role is shown and changed on the **Profile** page. All progress — saved runs, scenario attempts, leaderboard scores — is stored in your browser's local storage until a Supabase backend is connected.

---

## Platform Sections

### Lab
**Path: `/lab`**

The core simulation workspace. Run a live single-loop PID controller against any of the 20 built-in process models.

**What you can do:**
- Select a **process model** (level, pressure, temperature, flow, fan, boiler, and more)
- Adjust **Kp, Ti, Td** and watch the response update in real time
- Switch the controller **algorithm** between P, PI, and PID
- Change the **controller form** (standard, series, or parallel)
- Toggle **controller mode** between Auto and Manual
- Set **operating mode**: Single, Feedforward, Cascade, or Interacting
- Enable **PV and SP filtering** to simulate real measurement noise
- Inject **disturbances** (step load, pulse, cyclic, ramp) and tune through them
- Simulate **valve defects** — deadband, stiction, overshoot, backlash
- Run at **1×, 2×, 4×, or 8× simulation speed**
- Load a **scenario** directly via the URL (`/lab?scenario=<id>`) to launch a scored exercise
- **Save a run** with a custom title for later comparison
- **Export CSV** of the full run history (time, PV, SP, CO, P/I/D terms, disturbance)
- **Export PDF** report of the run metrics
- Use the **auto-tuning study** panel to get Ziegler–Nichols, Cohen–Coon, IMC, relay, and closed-loop recommendations

**Live metrics shown:**
- Current error, overshoot %, settling time, IAE/ISE/ITAE, CO travel, rise time, disturbance recovery time, saturation %
- Stability verdict: **Stable**, **Marginal**, or **Unstable** — updated every step

---

### Stability Lab
**Path: `/stability-lab`**

A read-only side-by-side comparison of three pre-tuned responses on the same process model:

| Panel | What it shows |
|-------|---------------|
| **Good Stable** | Settled quickly, low overshoot, no sustained cycling |
| **Marginally Stable** | Constant-amplitude cycling — the warning zone |
| **Unstable** | Growing oscillation — equipment wear and process risk begin here |

Use this page to train your eye before going into the Lab. It is especially useful when explaining to operators what each stability verdict looks like on a trend.

---

### Learn
**Path: `/learn`**

The full BAS/DDC reference library, now embedded as interactive lessons inside the platform. Click any topic in the left panel to load the content on the right.

**Available topics:**
- Help overview and platform guide (this document)
- Toolbar and run controls
- Faceplate and operator controls
- Controller settings explained
- Standard tuning methods
- Process signals and trend tools
- Operator training exercises
- Process model library
- Executive summary
- PID control fundamentals
- Choosing the right controller
- PID terminology mapping (vendor cross-reference)
- Deadband and neutral zone
- Bias, offset, and manual reset
- Direct-acting vs reverse-acting control
- Integral behavior and vendor differences
- Anti-windup, bumpless transfer, and mode changes
- TAB and commissioning considerations
- PID tuning methodologies
- Practical field tuning workflow
- Long-term performance evaluation
- Common pitfalls and cautions
- Example walkthroughs
- Final PID tuning checklist

---

### Scenarios
**Path: `/scenarios`**

Structured training exercises with defined objectives, pass criteria, hints, and automated scoring. Each scenario launches directly into the Lab with the process model and initial tuning pre-loaded.

**Current scenarios:**

| Scenario | Difficulty | Objective summary |
|----------|------------|-------------------|
| Level Control Without Spill Risk | Beginner | <5% overshoot, settle within 45 s |
| Pressure Loop With Noise | Intermediate | Hold duct pressure through noise and pulse disturbance |
| Thermal Loop With Limited Overshoot | Intermediate | Robust temperature response, <10% saturation |
| Recover A Marginal Loop | Advanced | Bring an unstable fan loop back to stable without flattening it |

**How scoring works:**
- Each criterion (overshoot, settling time, steady-state offset, saturation %, stability verdict) is checked independently
- Score starts at 100 and deductions are applied for each criterion missed
- A **Pass** requires every criterion to be met
- Attempts are saved locally and feed the Leaderboard and Instructor views

---

### Saved Runs
**Path: `/saved-runs`**

A library of every run you have saved from the Lab. Up to 50 runs are stored locally.

**Each run record shows:**
- Custom title and process model name
- Timestamp
- Stability badge (Stable / Marginal / Unstable)
- Overshoot %, settling time, and IAE summary
- Delete button to remove the run

Use this page to compare tuning attempts across the same model, build a library of golden tunings, or revisit a run before a debrief session.

---

### Instructor
**Path: `/instructor`**

An oversight dashboard showing aggregate attempt data across all scored scenarios.

**Metrics shown:**
- Total scenario attempts
- Overall pass rate
- Number of tracked scenarios

**Scenario heatmap table:**
- Attempts per scenario
- Passes per scenario
- Most common stability state for each scenario (identifies where trainees are struggling most)

> This view uses local attempt data in the current build. When Supabase is connected it will map to org-scoped cohort data, class assignments, and live monitoring.

---

### Leaderboard
**Path: `/leaderboard`**

Top 10 scenario scores ranked by score descending. Shows scenario name, numeric score, and Pass/Fail + stability result for each entry.

> Currently local-first. When Supabase is connected this will support org-scoped and anonymous team rankings.

---

### Profile
**Path: `/profile`**

Set your **Training Persona** role and check backend connectivity status.

---

## Training Persona Roles

Your role is stored in browser local storage and can be changed at any time from the Profile page. It controls the **context and perspective** you bring to the platform.

---

### Trainee

**Who it is for:** Operators, technicians, and anyone learning PID control for the first time.

**What this role focuses on:**
- Learning through hands-on Lab sessions with immediate visual feedback
- Working through Scenarios in difficulty order (Beginner → Intermediate → Advanced)
- Using the Stability Lab to understand what stable, marginal, and unstable look like before tuning
- Building a personal Saved Runs library of successful tunings to reference in the field
- Reading the Learn reference content alongside practical exercises
- Tracking personal progress on the Leaderboard

**Recommended workflow:**
1. Read **0.5 Operator Training Exercises** and **0.6 Process Model Library** in Learn
2. Open the **Stability Lab** to calibrate your eye for good vs. bad responses
3. Go to **Lab**, pick the `genericDoubleLag` model, and tune from scratch
4. Attempt the **Level Control Without Spill Risk** scenario (Beginner)
5. Save successful runs and review them in **Saved Runs**
6. Progress to Intermediate and Advanced scenarios as confidence builds

---

### Instructor

**Who it is for:** Training leads, controls engineers coaching operators, and anyone running structured sessions.

**What this role focuses on:**
- Monitoring trainee progress through the **Instructor** dashboard
- Using the scenario heatmap to identify which skills need more time (e.g. if most trainees are getting "unstable" on the Thermal Loop, add a review session on derivative action)
- Assigning specific **Scenarios** as homework or in-class exercises
- Using **Stability Lab** as a visual teaching aid — show all three panels during a debrief
- Building **golden tuning** Saved Runs to share as reference benchmarks
- Running the **auto-tuning study** in Lab to demonstrate Ziegler–Nichols vs. IMC vs. relay methods side by side

**Recommended workflow:**
1. Check the **Instructor** dashboard before each session to see where the cohort is struggling
2. Use **Stability Lab** as the opening visual for any new topic on oscillation
3. Assign specific scenarios by sharing the direct URL (`/lab?scenario=<id>`)
4. Debrief using the Saved Runs the trainee exported or described
5. Use the **Learn** section as a reference glossary during Q&A

---

### Admin

**Who it is for:** Platform administrators and system owners responsible for connecting the backend and managing users.

**What this role focuses on:**
- Verifying Supabase connectivity from the **Profile** page
- Managing environment configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Overseeing platform readiness for scaling from local-only mode to a multi-user deployment
- Reviewing overall scenario coverage and pass rates from the **Instructor** dashboard
- Understanding what data the platform will sync once Supabase is wired in:
  - Saved runs (up to 50 per user locally, unlimited with backend)
  - Scenario attempts and scores (up to 200 locally)
  - Role assignments and user profiles
  - Org-scoped Leaderboard and cohort Instructor views

**Readiness checklist:**
1. Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`
2. Verify the **Profile** page shows "Supabase environment variables are present"
3. Review `supabase/migrations/` and `supabase/seed.sql` before running `supabase db push`
4. Confirm the Instructor and Leaderboard pages display data once attempts are seeded

---

## Role Comparison Summary

| Feature | Trainee | Instructor | Admin |
|---------|---------|------------|-------|
| Lab simulator | Full access | Full access | Full access |
| Stability Lab | Full access | Full access | Full access |
| Learn reference | Full access | Full access | Full access |
| Scenarios — attempt | Yes | Yes | Yes |
| Saved Runs | Personal library | Personal + golden tunings | Full visibility |
| Instructor dashboard | Not applicable | Primary view | Oversight |
| Leaderboard | Personal scores | Cohort context | Platform-wide |
| Profile / role switch | Self-manage | Self-manage | Self-manage + backend config |
| Supabase setup | Not applicable | Not applicable | Owns this |

---

## Local Storage Keys

All data persists in your browser's local storage under these keys:

| Key | Contents |
|-----|----------|
| `pid-platform.role` | Current training persona |
| `pid-platform.saved-runs` | Up to 50 saved Lab runs |
| `pid-platform.scenario-attempts` | Up to 200 scored scenario attempts |

Clearing your browser's local storage resets all progress. When Supabase is connected, this data will sync to the backend so progress is preserved across devices.
