# How the Automatic Stability Checker Works

Every time the simulator runs it is continuously scoring your tuning against a set of real-time metrics. The **Stability Badge** — Stable, Marginal, or Unstable — is the final verdict of that scoring. This guide explains every number in the metric panel, exactly how the verdict is reached, and what each value tells you about your loop.

---

## The Three Verdicts

### Stable (green)
The loop has settled inside the acceptance band, oscillation is decaying or absent, overshoot is within limits, and the output has not been pinned at a limit for too long. This is the target.

### Marginal (yellow)
The loop is not actively diverging, but at least one condition falls outside the acceptable range. Marginal is a warning: the loop may feel acceptable in the field but it carries risk — more gain, a small process change, or an upstream disturbance can push it to Unstable.

### Unstable (red)
At least one hard failure is present: oscillation amplitude is growing, the loop never settled inside the acceptance band, or output saturation was too prolonged. Unstable loops accelerate equipment wear and can cause process excursions.

---

## The Verdict Decision Tree

The checker evaluates conditions in this exact order. The first matching branch wins.

```
1. Is oscillation GROWING?
   OR  Did the loop never settle inside ±5 % of span?
   OR  Was the output saturated for more than 18 % of the run?
   → UNSTABLE

2. Is oscillation SUSTAINED (constant amplitude)?
   OR  Overshoot > 10 %?
   OR  Steady-state offset > 5 % of span?
   → MARGINAL

3. None of the above
   → STABLE
```

The thresholds (5 %, 10 %, 18 %) are fixed training targets built into the engine. Field acceptance criteria on real equipment may be tighter or looser depending on the application.

---

## The Oscillation Classifier

The oscillation result feeds directly into the verdict, so it is worth understanding how it works.

**What it looks at:**
The classifier only examines the later portion of the run — the window starting at 40 % of total run time, with a minimum of 40 samples — to avoid being confused by the initial transient response after a setpoint step.

**How it counts peaks:**
It scans the PV history for local maxima and minima (peaks and valleys) whose amplitude exceeds a noise floor of 0.2 % of the process span. At least 8 extrema must be found before any oscillation verdict is issued.

**How it decides the class:**
It takes the last 8 extrema and splits them into two groups of 4.

| Ratio = late amplitude ÷ early amplitude | Classification |
|------------------------------------------|----------------|
| Ratio > 1.20 | **Growing** — oscillation is diverging |
| 0.85 ≤ Ratio ≤ 1.20 | **Sustained** — constant-amplitude cycling |
| Ratio < 0.85 | **Decaying** — oscillation is dying out |
| Fewer than 8 extrema found | **Decaying** (assumed settled or never oscillating) |

**Why the late vs early split matters:**
A loop can look like it is cycling for a few periods and then either diverge or recover. Comparing recent behavior to earlier behavior catches the direction of travel, not just the instantaneous amplitude. This is what separates "just woke up after a step" from "genuinely unstable."

---

## Every Metric Explained

The metric panel in the Lab shows twelve values. Here is what each one measures, how it is calculated, and what it means for your tuning.

---

### Current Error

**What it is:** `SP − PV` at the most recent simulation step.

**What it tells you:** The instantaneous gap the controller is currently working to close. In steady state a well-tuned PI or PID loop should drive this toward zero. A P-only loop will always carry some residual offset (because it needs an error to produce output).

**What to watch for:**
- Large persistent current error with a stable verdict → pure P-only tuning, add integral action
- Current error oscillating around zero with growing amplitude → gain too high, reduce Kp or lengthen Ti

---

### PV Span Seen

**What it is:** `max(PV) − min(PV)` across the entire recorded run.

**What it tells you:** How much of the process range the PV has actually moved through during the run. This is a raw activity measure — it does not say anything about whether that movement was controlled or erratic.

**What to watch for:**
- Very small span after a large setpoint step → loop is too sluggish or stuck (stiction, deadband, output limits)
- Span much larger than the setpoint step size → significant overshoot or active disturbance swings
- Span growing session over session with the same tuning → process has drifted or something upstream changed

---

### CO Travel

**What it is:** Sum of all absolute changes in controller output (CO) across every simulation step.

**Formula:** `Σ |CO[i] − CO[i−1]|` over the full run.

**What it tells you:** How hard the controller is working its final control element. A low-travel CO means the output is moving smoothly and infrequently. A high-travel CO means the output is chattering or making large repeated corrections.

**What to watch for:**
- Very high CO travel with small PV movement → derivative is amplifying noise, or Kp is too high
- Low CO travel but poor settling → controller is too slow (Ti too long, Kp too low)
- CO travel much higher than valve travel → valve defects (stiction, deadband) are eating the output signal before it reaches the process

---

### Valve Travel

**What it is:** Same sum-of-absolute-changes calculation applied to the valve position signal rather than the raw CO output. When valve feedback is disabled, this equals CO Travel.

**What it tells you:** The actual mechanical work demanded of the valve (or actuator). This is the number that matters for maintenance planning — not how much the controller asked for, but how much the valve actually moved.

**What to watch for:**
- Valve travel significantly less than CO travel → valve defects are absorbing controller movement (stiction or deadband too high)
- Valve travel significantly more than CO travel → valve overshoot setting is amplifying commands
- High valve travel on an otherwise stable loop → derivative action on a noisy measurement is causing unnecessary valve cycling even when the PV is settled

---

### Rise Time

**What it is:** Time for the PV to travel from 10 % to 90 % of the total setpoint step size.

**Example:** If the setpoint moves from 50 to 70 (a 20-unit step), rise time is the seconds between PV reaching 52 (10 % of 20 above the start) and PV reaching 68 (90 % of 20 above the start).

**What it tells you:** Raw speed of the initial response. A fast rise time is not automatically good — it often comes paired with large overshoot. The best rise time for operator-grade loops is fast enough to feel responsive but slow enough to avoid aggressive overshoot.

**What to watch for:**
- `n/a` shown → the PV never crossed both thresholds, meaning the loop did not complete a full step response in the recorded window
- Very fast rise time with high overshoot → Kp too high, consider backing off and relying more on integral
- Very slow rise time with low overshoot → Kp too low or Ti too long; the loop is overly sluggish

---

### Settling Time

**What it is:** The earliest time at which the PV enters — and then stays within — a band of **±5 % of the process span** around the setpoint for the remainder of the run.

**Example:** On a 0–100 % level loop (span = 100), the band is ±5 units. Settling time is the first moment the PV enters [SP−5, SP+5] and never leaves again.

**Why "and stays there" matters:**
A PV that dips inside the band and then oscillates back out does not count as settled. The checker scans forward from each candidate point and verifies every subsequent sample remains in the band. This prevents a loop that happens to pass through the right value from getting a false settling credit.

**What it tells you:** This is the single most important time-domain metric. It is the primary gate for the Stable verdict — if settling time is `null` (the PV never met the criteria), the verdict is automatically **Unstable** regardless of how the other metrics look.

**What to watch for:**
- `n/a` → loop has not settled; this is an automatic Unstable condition
- Settling time much longer than rise time → large overshoot is making the loop fight itself; reduce Kp or increase Ti
- Settling time equal to rise time with no overshoot → P-only with integral drift, or severely underdamped

---

### Overshoot

**What it is:** How far the PV goes past the target setpoint, expressed as a percentage of the setpoint step size.

**Formula:** `(peak PV − SP) / |SP − initial PV| × 100 %`

**Example:** Setpoint steps from 50 to 70 (a 20-unit move). PV peaks at 75. Overshoot = (75 − 70) / 20 × 100 = 25 %.

**Verdict threshold:** Overshoot above **10 %** triggers a **Marginal** verdict.

**What it tells you:** How aggressively the controller charged through the setpoint before backing off. Some overshoot is normal and even desirable for fast loops, but excessive overshoot puts the process outside target range during every setpoint change and stresses the final control element.

**What to watch for:**
- Overshoot > 10 % → reduce Kp, increase Ti, or add/increase derivative (if measurement is clean)
- Zero overshoot but very slow settling → loop is overdamped; increase Kp or shorten Ti
- Overshoot consistent across different setpoint step sizes → a tuning issue; overshoot that varies with step size often points to a nonlinear process

---

### Steady-State Offset

**What it is:** `SP − PV` averaged over the last 50 samples of the run.

**What it tells you:** How close the controller gets the process to target in steady state. With integral action (PI or PID), this should approach zero. With P-only control, there will always be a non-zero offset because the proportional term needs an error to generate output.

**Verdict threshold:** Offset greater than **5 % of the process span** triggers a **Marginal** verdict.

The Fine-Tune Assistant uses a tighter operator-quality target than the broad stability badge. A loop can be technically stable because it is inside the +/-5 % band, but still receive a residual-offset recommendation when `PV` stays consistently above or below `SP`. For PI or PID control, that usually means reset action is too weak, `Ti` is too long, or the final element does not have enough authority.

**What to watch for:**
- Persistent offset with PI or PID → integral action may be disabled, Ti is set too high (very long repeat time), or the output is saturated preventing integral windup
- Offset that grows over time → output saturation has wound up the integral; check anti-windup and output limits
- Offset that oscillates slowly → integral gain is too high (Ti too short), causing the output to overshoot and undershoot around zero error

---

### IAE — Integral Absolute Error

**What it is:** `∫ |SP − PV| dt` — the area between the SP line and the PV line across the entire run, regardless of direction.

**What it tells you:** The cumulative total error burden across the whole run. IAE treats all error equally regardless of when it happened. A lower IAE means the PV tracked the setpoint more closely overall.

**When to use it:** IAE is the simplest error integral for comparing two different tunings on the same process: run both for the same duration and the lower IAE wins on average tracking performance.

---

### ISE — Integral Squared Error

**What it is:** `∫ (SP − PV)² dt` — like IAE but each error value is squared before integrating.

**What it tells you:** Squaring penalizes large errors more heavily than small ones. A tuning that produces a few large error spikes will score much worse on ISE than IAE. This makes ISE the right metric when large deviations are especially costly (e.g. temperature loops where overshoot causes product damage).

**When to use it:** Use ISE over IAE when your process punishes large errors disproportionately. ISE-optimal tunings tend to be more aggressive in the initial response and then settle quickly.

---

### ITAE — Integral Time-Weighted Absolute Error

**What it is:** `∫ t × |SP − PV| dt` — like IAE but each error is also multiplied by the time at which it occurred.

**What it tells you:** ITAE heavily penalizes error that persists late in the run, while almost ignoring the initial transient right after a step. This makes it the best metric for evaluating how quickly a loop truly settles after the initial response.

**When to use it:** ITAE is the most field-relevant of the three integrals for operator-grade loops. A loop with good ITAE has resolved its transient quickly and is not carrying a long tail of residual error. When comparing tuning methods, ITAE-optimal tunings tend to have good settling time and low sustained offset.

**Summary of when to prefer each integral:**

| Metric | Best when you want to penalize... |
|--------|----------------------------------|
| IAE | All error equally; general-purpose comparison |
| ISE | Large peak errors most; protect against spikes |
| ITAE | Slow settling and long-tail offset; best for operator-grade tuning |

---

### Recovery (Disturbance Recovery Time)

**What it is:** Seconds from the last detected disturbance change until the PV re-enters the ±5 % band around the setpoint.

**How the disturbance is detected:** The engine watches the disturbance signal sample-by-sample. Any change greater than a 0.03-unit threshold registers as a disturbance event. The timestamp of the last such event is the recovery start point.

**What it tells you:** How well the loop rejects load changes after the initial setpoint response has settled. A loop that tunes well for setpoint tracking may still be slow at rejecting disturbances, because the two objectives can pull in opposite directions.

**What to watch for:**
- `n/a` → no disturbance was active during the run; recovery time cannot be measured
- Very long recovery → integral gain is too weak (Ti too long); the controller sees the error but reacts too slowly
- Recovery faster than settling time → the loop is better at disturbance rejection than setpoint tracking; this is common in tight integral loops with modest proportional gain

---

## Advisory Messages

Below the metric grid the stability checker also emits plain-language messages. Each message corresponds to a specific condition in the engine:

| Message | What triggered it |
|---------|------------------|
| "Oscillation amplitude is still growing. This is unsafe for the final control element." | Oscillation class = growing |
| "The loop is cycling at nearly constant amplitude. Treat this as marginal stability." | Oscillation class = sustained |
| "Overshoot is X %, which is above the training target of 10 %." | Overshoot > 10 % |
| "Output spent X seconds pinned at a limit." | Any saturation time > 0 |
| "The loop never settled inside the acceptable band during the recorded run." | Settling time = null |
| "Settled in X seconds." | Settling time has a value |
| "Steady-state error is still too large for an operator-grade stable verdict." | Steady-state offset > 5 % of span |
| "Measurement noise is materially affecting the PV trend. Validate filtering before chasing gains." | Instantaneous noise exceeds 1 % of span |

The noise advisory is the one most operators miss. If you are chasing instability with gain changes and the noise advisory is active, stop — reducing Kp will not fix a noisy measurement. Enable PV filtering first, then re-evaluate the tuning.

---

## What Makes a PID Loop Unstable: The Short Version

A loop becomes unstable when the total loop gain at the natural oscillation frequency is high enough that the feedback signal amplifies rather than corrects deviations. In practical terms:

**Gain-driven instability (most common):**
- Kp too high → proportional action overcorrects every error, causing the output to overshoot the correction itself
- Ti too short (repeat rate too fast) → integral action accumulates error faster than the process can respond, winding up the output
- Td too high on a noisy measurement → derivative amplifies high-frequency noise into large rapid output swings

**Lag-driven instability:**
- Dead time in the process delays when the controller sees the result of its last output move; by the time feedback arrives, the controller has already overcorrected
- Multiple first-order lags in series create additional phase shift; the more lags, the more gain margin is consumed

**Saturation-driven instability:**
- Output pinned at a limit prevents the controller from correcting in one direction; integral windup accumulates, producing a large overshoot when the limit releases

**Practical field signs the checker watches for:**

| What you see on trend | What the checker reports | Likely cause |
|-----------------------|--------------------------|--------------|
| PV oscillating with growing peaks | Growing oscillation → Unstable | Kp or integral too high |
| PV cycling at constant amplitude | Sustained oscillation → Marginal | Loop is at or near ultimate gain |
| PV settled but offset persists | Steady-state offset > 5 % → Marginal | P-only, or integral too weak |
| Large initial spike then settles | Overshoot > 10 % → Marginal | Kp too high, step response too aggressive |
| Output stuck at 0 % or 100 % | Saturation > 18 % → Unstable | Bias wrong, gain too low, or output limits too tight |
| PV moves but never reaches SP | Settling time = null → Unstable | Dead time too long for current tuning, or sustained load disturbance |
