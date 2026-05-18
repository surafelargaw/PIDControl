# Controller Operating Modes

The **Operating Mode** selector in the Lab changes the fundamental control structure — how the controller receives its setpoint, what variable it closes the loop around, and whether extra signals are added to the output. Choosing the wrong structure for a given process is one of the most common causes of poor loop performance even with correct PID gains.

There are four modes available: **Single**, **Feedforward**, **Cascade**, and **Interacting**.

---

## How Operating Mode Differs from Algorithm

Before covering each mode it is worth being precise about what "operating mode" controls versus the other controller settings.

| Setting | What it changes |
|---------|----------------|
| **Algorithm** (P / PI / PID) | Which correction terms are active |
| **Form** (standard / series / parallel) | How Kp, Ti, Td are mathematically combined |
| **Mode** (Auto / Manual) | Whether the PID or the operator controls the output |
| **Operating Mode** | The structure of the feedback loop itself |

Operating mode is the deepest of these settings. Changing it restructures which signal feeds the error calculation and what the output is driving.

---

## Single Loop

### What it is

The standard, default closed-loop feedback structure. One controller, one measurement, one output.

```
Operator SP ──► [PID Controller] ──► CO ──► [Valve / Actuator] ──► [Process] ──► PV
                      ▲                                                              │
                      └──────────────────── error = SP - PV ◄───────────────────────┘
```

The controller computes `error = SP − PV`, applies proportional, integral, and derivative action to that error, and drives the output directly to the final control element.

### How the simulator runs it

- Error = `direction_sign × (SP − PV_filtered)`
- Output = `bias + P_term + I_term + D_term`
- No extra signals involved

### What you see on the trends

- **PV / SP trend:** PV chases the SP directly after each setpoint change
- **CO / Valve trend:** CO moves in response to error; valve follows CO (minus any valve defects)
- **P / I / D term trend:** All three terms driven by the SP-to-PV error

### When to use it

Single is appropriate for the vast majority of loops in field practice:

- Any process where the disturbance path is unknown or unmeasured
- Any process where one PV directly represents the controlled variable (flow, pressure, temperature, level)
- Training and baseline tuning before adding complexity

### What normal behavior looks like

After a setpoint step:
1. CO moves immediately as the P term fires
2. PV begins to move toward SP
3. I term gradually accumulates to close steady-state offset
4. PV settles inside the ±5 % band and the stability verdict turns green

Disturbance behavior: the controller does not see the disturbance until it has already moved the PV. Every correction comes after the fact.

---

## Feedforward

### What it is

Feedforward adds a measured disturbance signal directly to the output without waiting for the PV to be affected. The feedback loop (single-loop PID) continues to run in parallel to correct any residual error the feedforward does not fully cancel.

```
Disturbance ──► [FF Gain] ──────────────────────────────► +
                                                           │
Operator SP ──► [PID Controller] ──────────────────────► [Sum] ──► CO ──► [Process] ──► PV
                      ▲                                                          │
                      └──────────────────── error = SP - PV ◄───────────────────┘
```

The feedforward contribution is pre-emptive: it acts at the moment the disturbance is detected, not after the PV has already deviated.

### How the simulator runs it

The engine computes the feedforward contribution from the active disturbance profile at every time step:

```
feedforward_contribution = −direction_sign × disturbance_signal × 100 × feedforward_gain
```

This is added directly to the output:

```
CO = bias + P_term + I_term + D_term + feedforward_contribution
```

The **Feedforward Gain** parameter (default 0.6) scales how aggressively the disturbance measurement drives the output. A gain of 1.0 attempts full cancellation; lower values give partial compensation and rely more on feedback to finish the job.

### What you see on the trends

- **PV / SP trend:** PV deviation from SP during a disturbance event is visibly smaller than in Single mode with the same tuning. The PV may barely move when a step disturbance arrives.
- **CO / Valve trend:** CO makes an immediate jump or shift at the moment the disturbance fires — before the PV has moved. This is the signature of feedforward action.
- **P / I / D term trend:** The P and I terms stay quieter because the feedforward has already done most of the work. The D term may spike if the disturbance signal changes rapidly.

### When to use it

Feedforward is most valuable when:

- A measurable disturbance regularly upsets the process (supply air flow changes, outdoor air damper steps, load swings)
- The disturbance path is faster than the correction path (the PV would deviate significantly before feedback can catch it)
- The feedback tuning is already correct and you want to reduce PV excursions during known disturbance events

### What good feedforward behavior looks like

With a **step disturbance** (profile: Step Load):
- Without feedforward: PV dips or spikes when the disturbance fires, then slowly recovers
- With feedforward (gain ≈ 0.6–0.8): PV barely reacts; CO makes a small step at the moment of disturbance, and the residual feedback closes any remaining offset

With a **cyclic disturbance** (profile: Cyclic Load):
- CO oscillates in sync with the disturbance profile — a sign the feedforward is tracking the load variation
- PV holds much tighter around SP than it would in single mode

### Common feedforward mistakes

- **Gain too high:** CO overcompensates, pushing PV past SP in the opposite direction. This shows as PV oscillation locked to the disturbance period.
- **Gain too low:** Little improvement over single mode; the feedback still has to do all the work.
- **Using feedforward without an active disturbance:** With disturbance profile set to "None", feedforward adds nothing — the contribution term is zero.

---

## Cascade

### What it is

Cascade control splits one loop into two nested loops. The **outer loop** (primary controller) measures the process variable you actually care about and produces a target for the **inner loop** (secondary controller). The inner loop measures a faster, closer-to-the-valve variable and uses that as its process variable.

```
              Outer loop                      Inner loop
               (primary)                      (secondary)
                  │                               │
SP ──► [Outer PID] ──► "inner SP" ──► [Inner PID] ──► CO ──► Valve ──► Process ──► PV (primary)
             ▲                              ▲                                 │
             │                              │                                 │
             └──── outer error (SP−PV) ─────┘   inner PV (valve position) ───┘
```

The outer loop is slower and cares about the primary process variable (temperature, pressure, level). The inner loop is faster and closes the loop around something close to the actuator (valve position, flow rate, damper position).

### Why cascade helps

The outer loop does not need to wait for its output to travel through a long process lag before getting feedback. The inner loop provides fast, tight actuation correction — eliminating valve nonlinearities, stiction, and hysteresis before they can disturb the outer process.

**Without cascade:** A temperature controller commanding a valve directly must absorb all valve nonlinearity in its integral action, which is slow and tends to cause overshoot.

**With cascade:** The inner loop linearizes the valve. By the time the outer loop's command reaches the process, it has already been corrected for deadband, stiction, and slow response.

### How the simulator runs it

The engine implements cascade as a two-degree structure within a single controller block:

**Outer loop:**
- Error = `direction_sign × (SP_filtered − PV_filtered)` (primary process error)
- The outer loop runs a proportional-integral structure using the **Cascade Gain** parameter:
  ```
  cascade_integral += outer_error × cascade_gain × dt   (clamped to ±25)
  cascade_target = bias + outer_error × cascade_gain × 12 + cascade_integral
  cascade_target is clamped to output limits
  ```

**Inner loop:**
- Receives `cascade_target` as its SP
- Uses **valve position** as its PV
- Error = `cascade_target − valve_position`
- Runs the full PID (Kp / Ti / Td) on that inner error

The **Cascade Gain** parameter (default 0.6) controls the responsiveness of the outer loop. Higher values make the outer loop more aggressive in commanding a new inner setpoint; lower values make it smoother and more conservative.

### What you see on the trends

- **PV / SP trend:** The primary PV converges toward SP, but more smoothly than single mode if the process has significant valve nonlinearity. The initial response may appear slightly slower.
- **CO / Valve trend:** This is where cascade shows its signature. The CO line represents the inner loop's output driving the valve. The valve position closely tracks the CO demand because the inner loop is correcting for valve lag in real time. The **Secondary PV** line (purple) shows the outer loop's cascade target — the "inner setpoint" being sent to the inner loop.
- **P / I / D term trend:** The terms represent the inner loop's response to the inner error (cascade_target − valve_position), not the outer process error.

### The Cascade Gain parameter

| Cascade Gain | Effect |
|-------------|--------|
| Too low (< 0.2) | Outer loop is sluggish; takes many seconds to move the inner target in response to PV deviation |
| Default (≈ 0.6) | Balanced outer loop; responds in a few cycles |
| Too high (> 1.2) | Outer loop drives inner target aggressively; may cause inner loop oscillation if inner PID is not tuned to match |

### When to use cascade in the field

Classic BAS examples:
- **Hot water supply temperature loop:** outer loop = supply temperature SP; inner loop = valve position or flow rate through the coil
- **Variable air volume (VAV) pressure loop:** outer loop = duct static pressure SP; inner loop = fan VFD speed or damper position
- **Zone temperature loop:** outer loop = zone air temperature SP; inner loop = discharge air temperature or reheat coil valve

Rule of thumb: cascade is worth the added complexity when the inner loop runs 3–10 times faster than the outer loop, and when valve nonlinearity is contributing to outer-loop oscillation.

### What normal cascade behavior looks like

After a setpoint step:
1. The outer loop error triggers a shift in the cascade target (visible as the Secondary PV line jumping)
2. The inner loop immediately closes on the new cascade target by moving CO
3. The valve responds tightly because the inner loop is correcting for valve defects
4. PV follows more cleanly than single mode would allow if there is valve stiction or deadband

If the inner loop is tuned poorly (Kp too high for the inner error), you will see rapid CO oscillation even while the outer PV appears to converge — because the inner loop is hunting around the cascade target.

---

## Interacting

### What it is

Interacting mode models a process where the controlled variable has a **cross-coupling effect** on the drive signal — the process feeds a small fraction of its own intermediate state back into the input. This represents real processes where:

- Moving one variable mechanically affects another (opposed-blade dampers, common duct systems)
- Heat transfer creates bidirectional coupling (heat exchanger where heating the outlet also affects inlet conditions)
- Flow in one branch affects pressure that feeds another branch

```
SP ──► [PID Controller] ──► CO ──► [Valve] ──► [Process with internal coupling] ──► PV
             ▲                                         │              │
             │                                         ▼              │
             │                               coupled state ──► + ─────┘
             └─────────────────── error = SP - PV ◄────────────────────────
```

The coupled state feeds back into the drive, meaning the controller is not only fighting the process lag — it is also fighting a secondary internal path that partially reacts to its own output.

### How the simulator runs it

The engine maintains a `coupledState` variable that tracks a fast-path version of the process response:

```
coupledState += ((direction_sign × gain × delayed_drive + disturbance × 0.4 − coupledState) /
                  max(2, lag1 × 0.35)) × dt
```

In interacting mode, the interaction effect is added to the process drive:

```
interaction_effect = coupledState × interactionGain
drive = direction_sign × gain × delayed_drive + disturbance + interaction_effect
```

The **Secondary PV** trend (purple on the CO / Valve chart) shows this coupled state variable — it is what the interaction effect is derived from.

With the default process models (`interactionGain = 0`), interacting mode shows the structural behavior without strong coupling, making it useful for demonstrating the concept before applying it to a custom model with meaningful interaction gain.

### What you see on the trends

- **PV / SP trend:** With low interaction gain, the response looks similar to single mode. With higher interaction gain, the PV settles more slowly and may exhibit additional low-frequency oscillation.
- **CO / Valve trend:** The Secondary PV line shows the coupled state. In an interacting process, this variable moves alongside CO in a way that is partially decoupled from the main PV.
- **P / I / D term trend:** The integral term may accumulate more than in single mode because the interaction adds a partial offset that the integrator must continually correct.

### Field context for interacting processes

Common BAS situations where interaction matters:
- **Dual-duct mixing boxes:** heating and cooling valves interact — opening the heating valve partially affects the mixed-air temperature in a way that directly influences the cooling valve error
- **Common-duct systems:** multiple terminal boxes drawing from the same supply duct; one zone's damper position affects duct static pressure, which affects every other zone's actual flow
- **Heat recovery wheels:** supply and exhaust interact — changing wheel speed affects both supply and exhaust temperature simultaneously

In these cases, single-loop feedback treats the interaction as a disturbance. The interaction mode in the simulator shows why that leads to slower settling and why decoupling strategies (or at minimum, conservative integral tuning) are necessary in real installations.

---

## Mode Comparison

| | Single | Feedforward | Cascade | Interacting |
|--|--------|-------------|---------|-------------|
| **Structure** | One feedback loop | Feedback + open-loop disturbance path | Two nested feedback loops | Feedback loop with internal coupling |
| **Key extra signal** | None | Measured disturbance | Inner process variable (valve/flow) | Coupled state variable |
| **Disturbance handling** | Reactive (waits for PV to deviate) | Pre-emptive (acts before PV deviates) | Reactive at outer, tight at inner | Reactive; coupling adds lag |
| **Best when** | Standard process, unknown disturbance path | Disturbance is measurable and consistent | Valve nonlinearity, inner process is faster | Process variables cross-couple |
| **Key tuning parameter added** | — | Feedforward Gain | Cascade Gain | (Interaction Gain on custom models) |
| **CO trend signature** | CO moves after PV deviation | CO moves at disturbance moment, before PV moves | CO tracks cascade target tightly; valve hugs CO | CO moves similar to single; secondary PV lags with coupling |
| **Secondary PV trend** | Follows coupled state (minor) | Follows coupled state (minor) | Shows outer loop's inner SP (cascade target) | Shows interacting coupled state |

---

## Choosing a Mode: Decision Guide

```
Does the disturbance reach the process BEFORE the PV deviates,
and is that disturbance measurable?
  YES → Consider FEEDFORWARD (possibly combined with single-loop feedback)
  NO  → Feedback-only modes

Does the process have a fast inner variable (valve position, flow rate)
that can be closed on independently from the outer PV?
  YES → Consider CASCADE
  NO  → Single or Feedforward

Does the controlled variable have internal cross-coupling where one
process state influences the drive of another?
  YES → INTERACTING (or decoupling control design)
  NO  → Single or Feedforward or Cascade as appropriate

No special structure needed?
  → SINGLE (always the right starting point)
```

---

## Practical Exercise Suggestions

**Single vs Feedforward comparison:**
1. Set operating mode to Single, disturbance to Step Load, intensity 40
2. Note how many seconds the PV deviates before recovery
3. Switch to Feedforward, set feedforward gain to 0.7, run the same scenario
4. Observe the CO jump at the moment of disturbance and the reduced PV excursion

**Single vs Cascade comparison:**
1. Enable Stiction (process panel, value ~3–5)
2. Run Single mode — observe the PV cycling caused by stiction in the valve
3. Switch to Cascade — the inner loop corrects for the stiction before it reaches the process
4. Compare settling time and oscillation amplitude

**Cascade gain sweep:**
1. Set operating mode to Cascade
2. Start with cascade gain 0.2 — observe sluggish outer loop tracking
3. Increase to 0.6 (default) — balanced response
4. Push to 1.5 — observe inner loop hunting if Kp is not adjusted to match
