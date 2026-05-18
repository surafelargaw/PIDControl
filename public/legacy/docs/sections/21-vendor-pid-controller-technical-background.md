# 21. Vendor PID Controller Technical Background

This lesson explains the technical background behind the Vendor PID Lab profiles. The goal is not to claim that the simulator reproduces proprietary firmware instruction-for-instruction. The goal is to help operators recognize why the same loop can feel different on Siemens, Honeywell, Automated Logic, and Johnson Controls systems even when each platform is doing PID control.

Use this lesson beside the Vendor PID Lab. Change one field at a time, watch the trends, then come back to the tables below to understand which part of the controller you just changed.

## Source Confidence Matrix

| Vendor profile | Source confidence | What is public enough to model directly | What is treated as training approximation |
| --- | --- | --- | --- |
| `Siemens PXC/APOGEE LOOP` | Documented | `LOOP(type,pv,cv,sp,pg,ig,dg,st,bias,lo,hi,0)`, direct/reverse action, `PG`, `IG`, `DG`, sample time, bias, limits, and integral anti-windup at limits | Exact firmware implementation details around every edge condition |
| `Siemens TIA PID_Compact` | Documented | PIDT1 structure, anti-windup, proportional and derivative weighting, dead zone, `Gain`, `Ti`, `Td`, derivative delay/filtering, cyclic interrupt execution, manual/substitute output behavior | Exact internal state transitions outside the published diagrams |
| `Honeywell JACE 8000` | Training approximation | JACE 8000 IoT controller/server platform, Niagara N4 context, integrated control, supervision, data logging, alarming, scheduling, and network management | Detailed Niagara/JACE PID application internals are not openly visible without account or partner access, so the app uses a BAS EPID-style approximation |
| `ALC WebCTRL/EIKON` | Documented plus inferred | EIKON programming context, interval-based computerized PID teaching, hunting, open-loop and closed-loop tuning, `TUNE_OL` and `TUNE_CL` Ziegler-Nichols workflow | Exact controller firmware internals behind every WebCTRL microblock implementation |
| `JCI Metasys PID/PRAC+` | Documented | Proportional band, effective proportional band, integral time, dead time, time constant, process range, saturation time, interval, tracking anti-windup, bumpless transfer, setpoint weighting, PRAC+ monitoring and tuning concepts | Exact proprietary adaptive calculations are represented by a transparent training model |

> Commissioning Note: Treat the vendor profiles as realistic training models. They are designed to build operator intuition, not to produce guaranteed field tuning numbers.

## Primary Sources

- [Siemens PXC/APOGEE LOOP](https://sid.siemens.com/r/A6V10374898/21253010315_23094716171__en-US_1953721995)
- [Siemens PXC/APOGEE ADAPTS adaptive control](https://sid.siemens.com/r/A6V10374898/21253010315_23094716171__en-US_1951377931)
- [Siemens TIA PID_Compact](https://docs.tia.siemens.cloud/r/en-us/v21/pid-control-s7-1200-s7-1500-s7-1200-g2/pid_compact-s7-1200-s7-1500-s7-1200-g2/pid_compact-as-of-v2-s7-1200-s7-1500-s7-1200-g2/description-of-pid_compact-v3-s7-1200-s7-1500-s7-1200-g2)
- [ALC EIKON overview](https://www.automatedlogic.com/en/products/webctrl-building-automation-system/engineering-tools/eikon/)
- [ALC PID basics](https://eikonforeducators.automatedlogic.com/downloads/pidbasic.pdf)
- [Honeywell JACE 8000](https://buildings.honeywell.com/content/hbtbt/us/en/products/by-category/control-panels/building-controls/plant-and-integration-controllers/jace-8000-controller.html)
- [JCI Metasys PID/PRAC+ overview](https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Controller-Tool-Help/16.0.1/PID-PRAC-Commissioning-Overview/PID-Control-and-PRAC-Adaptive-Tuning-within-CCT)
- [JCI Metasys PID inputs and properties](https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Controller-Tool-Help/15.0/PID-PRAC-Commissioning-Overview/PID-Control-and-PRAC-Adaptive-Tuning-within-CCT/PCT/PID-Inputs-Outputs-and-Properties)
- [JCI Metasys PID/PRAC help guide](https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/Metasys-System-PID-PRAC-Help-Guide/10.2)

## Shared Technical Foundations

This section is a vendor translation bridge. For the general PID explanation, use `0.3 Controller Settings Explained`, `4. PID Terminology Mapping`, `8. Integral Behavior and Vendor Implementation Differences`, and `9. Anti-Windup, Bumpless Transfer, and Mode Changes`.

Most building controllers are solving the same basic problem:

```text
Measure PV
Compare PV to SP
Compute error
Update P, I, and D terms on a controller interval
Clamp output to actuator limits
Send command to valve, damper, fan, pump, or reset signal
```

The differences that matter to an operator are usually not philosophical. They are practical:

- Which terms are exposed on the faceplate
- Whether proportional action is entered as gain, throttling range, or proportional band
- Whether integral is entered as gain, reset time, integral time, or repeats per time
- Whether derivative acts on error or on process value
- Whether the controller computes continuously or on a fixed interval
- Whether output limits stop integral windup or simply hide it until the limit clears
- Whether the controller can switch from Manual to Auto without a jump
- Whether adaptive logic is allowed to change the effective tuning

### Positional PID vs Velocity-Style PID

In a positional controller, the controller calculates the output position directly:

```text
Output = Bias + P term + I term + D term
```

This is easy to understand on a BAS trend because the output has an absolute value. If the bias is 45%, the P term is 8%, and the I term is 5%, the requested output is about 58%.

In a velocity-style controller, the controller calculates the change in output from the previous output:

```text
Output[k] = Output[k-1] + change from P + change from I + change from D
```

Operators often do not see this internal distinction on the faceplate. They feel it when a loop recovers from saturation or when manual output is released. Velocity-style behavior can look smoother during small changes, but it can also make the output appear to "walk" toward the target.

The Vendor PID Lab uses mostly positional behavior because most BAS operator training is easier to interpret that way. Where a profile has known tracking or adaptive behavior, the lab models that behavior explicitly.

### Gain vs Proportional Band vs Throttling Range

Proportional gain makes the output move more for the same error.

Proportional band and throttling range are inverse ways of describing the same field idea: how much PV change is needed to move the output across its full range. A narrow proportional band means high gain. A wide proportional band means low gain.

```text
Approximate gain = output span / proportional band

For a 0-100% output:
Gain = 100 / proportional band
```

Example:

```text
Proportional band = 25 engineering units
Gain = 100 / 25 = 4

Proportional band = 50 engineering units
Gain = 100 / 50 = 2
```

This is why copying a number from one vendor to another is risky. `Kp = 4` and `PB = 4` are not equivalent. They point in opposite tuning directions.

> Common Pitfall: A technician sees a loop with "4" in the proportional field and copies "4" into another platform. If one platform uses gain and the other uses proportional band, the new loop may become much more aggressive or much more sluggish than intended.

### Integral Gain vs Integral Time

Integral action corrects sustained offset. If a P-only loop settles above or below setpoint, integral keeps pushing until the offset is removed.

Integral can be exposed as:

- `IG`, where a larger value usually means stronger integral
- `Ti`, integral time, where a smaller value usually means stronger integral
- reset time or repeats per time

The common standard-form relationship is:

```text
Integral contribution rate = Kp / Ti
```

This means:

- Increasing `Kp` also increases integral strength if `Ti` stays the same
- Reducing `Ti` strengthens integral
- Increasing `Ti` weakens integral
- Changing the controller interval can change the apparent integral behavior in a digital controller

### Derivative on Error vs Derivative on Measurement

Derivative predicts motion. It reacts to rate of change.

Derivative on error responds to SP movement and PV movement. A sudden setpoint step can create derivative kick.

Derivative on measurement responds mostly to PV movement. It avoids setpoint kick, but it is sensitive to noisy sensor values.

For HVAC loops, derivative is often left at zero on slow temperature loops. It may be useful on fast pressure loops only when the PV is clean and the derivative is filtered.

### Sample Interval and Digital Controller Timing

Digital controllers do not truly calculate continuously. They execute on a scan, interval, or sample time. If a controller computes every 5 seconds, the output is held between execution ticks.

The interval matters because integral and derivative math depend on time:

```text
Integral accumulation includes error * dt
Derivative rate includes change / dt
```

If the interval is made longer without changing gains, the loop may become more sluggish, more jumpy, or unstable depending on how the vendor implements the discrete math.

> Field Tip: When a controller exposes interval or sample time, trend the output as well as PV. If the output moves in visible stair-steps, the interval is part of the loop personality.

### Bias, Startup Value, Deadband, Limits, and Tracking

`Bias` is the output centerline. In a P-only loop, it is the output when PV equals SP.

`Startup value` is a starting output used when a PID takes control. It is a common ingredient in bumpless transfer.

`Deadband` or dead zone prevents tiny errors from moving the output. It can reduce actuator wear, but too much deadband creates offset and cycling.

`Output limits` protect the actuator range. They also change the integral problem. If the controller wants 120% output but the actuator stops at 100%, the integral term can keep accumulating unless the platform has anti-windup.

`Tracking anti-windup` adjusts or constrains the integral term so the internal PID state stays aligned with what the actuator can actually do.

`Setpoint weighting` reduces output jumps when SP changes. It can weight the SP differently for P and D terms. The operator sees a calmer output during setpoint changes without necessarily slowing disturbance rejection.

## Siemens PXC/APOGEE LOOP

The Siemens PXC/APOGEE `LOOP` command is one of the clearest public BAS examples because the function signature exposes the essential PID pieces:

```text
LOOP(type,pv,cv,sp,pg,ig,dg,st,bias,lo,hi,0)
```

| Field | Meaning |
| --- | --- |
| `type` | Control action. Siemens documents `0` as direct acting and `128` as reverse acting. |
| `pv` | Process variable being controlled. |
| `cv` | Control variable or loop output. |
| `sp` | Setpoint in the same engineering units as PV. |
| `pg` | Proportional gain. |
| `ig` | Integral gain. Siemens guidance describes starting low and notes a starting point around a small percentage of proportional gain. |
| `dg` | Derivative gain. Usually zero for slow HVAC loops. |
| `st` | Sample time in seconds. The LOOP executes at this user-defined interval. |
| `bias` | Output value when PV equals SP in a proportional-only loop. |
| `lo`, `hi` | Low and high output limits. |

The important operator interpretation is that Siemens LOOP is a classical PID faceplate:

```text
Output approximately follows:
CV = Bias + PG * error + integral contribution + derivative contribution
```

Siemens documentation also states that integral anti-windup is automatically prevented once the high or low limit is reached. That matters in field work. If the output is pinned at a limit during startup, the loop should not keep building unlimited integral action in the same direction.

### Siemens LOOP Tuning Feel

- `PG` too low: PV approaches slowly and may sit with offset.
- `PG` too high: PV hunts and output moves sharply.
- `IG` too low: offset remains for a long time.
- `IG` too high: slow loops overshoot and cycle after load changes.
- `DG` nonzero on noisy PV: output may chatter.
- `st` too long: output moves in slow steps and the loop feels delayed.
- `st` too short for a slow process: operators may overreact to changes before the plant responds.

### Siemens LOOP in the Vendor PID Lab

The `Siemens PXC/APOGEE LOOP` profile models:

- `PG`, `IG`, and `DG`
- Direct/reverse action
- Sample-time execution
- Bias and output low/high limits
- Clamp-style anti-windup at output limits

It does not claim to reproduce every internal firmware state. It is meant to expose the commissioning personality of the documented `LOOP` block.

## Siemens TIA PID_Compact

Siemens TIA `PID_Compact` is a PLC technology object, not a simple BAS PPCL command. Public Siemens documentation describes it as a `PIDT1` controller with anti-windup and weighting of proportional and derivative actions.

When the dead zone is deactivated, the operator-training form of the Siemens transfer-function description can be read as:

```text
y = Kp * [ (b*w - x) + (1 / (TI*s))*(w - x) + ((TD*s) / (a*TD*s + 1))*(c*w - x) ]
```

![Training equation for Siemens PID_Compact showing weighted proportional action, integral action, and filtered derivative action.](assets/help/siemens-pid-compact-equation.svg)

The important behavior is that setpoint `w` and process value `x` do not enter every term in the same way. Proportional weighting `b` changes the setpoint kick in the P branch. Derivative weighting `c` changes the setpoint kick in the D branch. The derivative delay coefficient `a` creates the T1 filter on derivative action.

The published symbols map to these faceplate and instruction parameters:

| Icon | Description | Associated `PID_Compact` parameter |
| --- | --- | --- |
| `y` | Output value of the PID algorithm | Not a tuning parameter |
| `Kp` | Proportional gain | `Retain.CtrlParams.Gain` |
| `s` | Laplace operator used in the transfer-function notation | Not a tuning parameter |
| `b` | Proportional action weighting | `Retain.CtrlParams.PWeighting` |
| `w` | Setpoint | `CurrentSetpoint` |
| `x` | Process value | `ScaledInput` |
| `TI` | Integration time. Larger `TI` means weaker integral action. | `Retain.CtrlParams.Ti` |
| `TD` | Derivative action time | `Retain.CtrlParams.Td` |
| `a` | Derivative delay coefficient. The derivative delay is `T1 = a * TD`. | `Retain.CtrlParams.TdFiltRatio` |
| `c` | Derivative action weighting | `Retain.CtrlParams.DWeighting` |
| `DeadZone` | Dead zone width where small error can be suppressed | `Retain.CtrlParams.DeadZone` |

![Training block diagram for Siemens PID_Compact showing setpoint and process value entering P, I, and D branches before gain, limiting, and anti-windup.](assets/help/siemens-pid-compact-block-diagram.svg)

![Training block diagram for PIDT1 with anti-windup showing P, I, and filtered D branches plus limiter feedback to the integrator.](assets/help/siemens-pidt1-anti-windup.svg)

The PIDT1 idea means derivative action is filtered. This is valuable because raw derivative amplifies noise.

```text
PID_Compact training interpretation:
Output = weighted P + integrated I + filtered D
then anti-windup and output/error handling are applied
```

Siemens also documents constant-time execution through cyclic interrupt organization blocks. Operators do not need to know the PLC programming details, but they should understand the practical consequence: a PID technology object expects consistent timing.

### PID_Compact Tuning Feel

- Compared with simple BAS gain fields, `Ti` and `Td` make the controller feel more like standard process-control PID.
- Setpoint weighting can make setpoint changes calmer without making load-disturbance recovery equally slow.
- Derivative filtering lets a small derivative term be useful on faster loops, but too much derivative still causes noisy output.
- Manual and substitute output modes can hide a control problem if the operator only looks at PV and not controller state.

### PID_Compact in the Vendor PID Lab

The `Siemens TIA PID_Compact` profile models:

- `Kp`, `Ti`, and `Td`
- Proportional setpoint weighting
- Derivative filtering
- Deadband/dead zone behavior
- Tracking-style anti-windup during saturation
- Manual-to-auto behavior with a bumpless target

It is intentionally different from `Siemens PXC/APOGEE LOOP` so operators can feel the difference between a BAS loop command and a PLC PID technology object.

## Honeywell JACE 8000

Honeywell JACE 8000 public product material describes a compact embedded IoT controller and server platform for connecting multiple and diverse devices and subsystems. The public context emphasizes Niagara 4 operation, integrated control, supervision, data logging, alarming, scheduling, and network management.

The public product material does not openly expose the same level of PID algorithm detail that Siemens LOOP or JCI Metasys PRAC documentation exposes. Some additional Niagara/JACE application documentation may require account or partner access. For that reason, the Vendor PID Lab labels the Honeywell JACE 8000 profile as a training approximation.

### Why the App Uses a BAS EPID-Style Approximation

Operators still need a practical Honeywell JACE / Niagara-flavored training model. The app therefore models JACE 8000 as a conservative BAS EPID-style controller with:

- Throttling range
- Integral time
- Derivative time
- Startup value
- Error ramping
- Bias
- Deadband
- Output limits
- Sample period

`Throttling range` is treated like proportional band:

```text
Internal training gain = 100 / throttling range
```

A narrower throttling range means more aggressive proportional action. A wider throttling range means calmer output and slower correction.

`Integral time` is treated as reset time:

```text
Integral strength approximately follows gain / integral time
```

`Startup value` and `error ramp` are used to make Auto recovery calmer. The profile is meant to feel like a BAS controller used on slow HVAC equipment, not like a high-speed PLC motion loop.

### Honeywell Tuning Feel

- Narrow throttling range: output reacts strongly to small errors.
- Wide throttling range: output moves calmly but offset may last longer.
- Short integral time: offset clears faster but overshoot risk increases.
- Long integral time: stable but slow recovery.
- Startup value wrong: Auto takeover begins from a poor output center.
- Error ramp too long: loop may look calm but under-responsive.

> Commissioning Note: Because the exact Niagara/JACE PID application internals are source-limited, validate the field controller by trending SP, PV, output, mode, limits, and any exposed internal PID or application-block values. Do not assume the simulator profile is a firmware reference.

## Automated Logic WebCTRL/EIKON

Automated Logic exposes a programming environment through EIKON and WebCTRL. Public EIKON training material is especially useful for operator training because it discusses computerized PID interval, hunting, initial gains, and open-loop versus closed-loop tuning.

ALC training material emphasizes that interval matters. It also notes that if you change interval, you may need to change gains because integral and derivative include a time term.

### Interval-Based PID

The ALC-style training model is discrete:

```text
Every interval:
  error = SP - PV, adjusted for action
  P = Kp * error
  I = I + (Kp / Ti) * error * interval
  D = Kp * Td * (error change / interval)
  Output = Bias + P + I + D
```

The exact internal controller implementation may vary by controller and application, but this interval-based model is valuable because operators can see why a loop with the same gains behaves differently when the interval changes.

### Hunting

Hunting is cycling above and below setpoint. It can come from:

- Proportional gain too high
- Integral too aggressive
- Interval too long for a fast process
- Deadtime in the plant
- Output deadband or actuator stiction
- A process disturbance being mistaken for a tuning issue

The ALC training workflow encourages watching trends or status displays. That maps well to WebCTRL field practice: trend SP, PV, output, and equipment status before changing multiple gains.

### Open-Loop and Closed-Loop Tuning

ALC public training references `TUNE_OL` and `TUNE_CL` EIKON examples that use Ziegler-Nichols equations:

- `TUNE_OL`: open-loop tuning from process response after an output step.
- `TUNE_CL`: closed-loop tuning from controlled oscillation behavior.

These are useful teaching tools, but operators should remember that classic Ziegler-Nichols results are often aggressive for comfort and critical HVAC loops. Use them as a starting point, then reduce aggressiveness for stable field operation.

### ALC in the Vendor PID Lab

The `ALC WebCTRL/EIKON` profile models:

- Discrete interval execution
- `Kp`, `Ti`, and `Td`
- P, I, and D contribution display
- Output limits and bias
- HVAC-friendly PI defaults
- A Ziegler-Nichols-style mental model, not exact proprietary firmware

## JCI Metasys PID/PRAC+

JCI Metasys documentation is unusually rich for operator education. The public PID/PRAC help guide covers proportional band, integral time, process dead time, time constant, process range, saturation time, interval, anti-windup, bumpless transfer, setpoint weighting, and PRAC+ adaptive tuning.

### Proportional Band

Metasys uses proportional band as the controller input rather than gain. The proportional band is the amount of PV change that produces a full output change.

```text
Approximate gain = output span / proportional band
```

For 0-100% output:

```text
Gain = 100 / proportional band
```

JCI also exposes effective proportional band for PRAC+ automatic tuning. That is important: the operator may enter a standard proportional band, but adaptive tuning can report an effective value that reflects PRAC+ changes.

### Integral Time

Metasys describes integral time as the time required for integral action to contribute the same output amount as proportional action for a constant error.

Operator interpretation:

- Smaller integral time: stronger reset
- Larger integral time: weaker reset
- If proportional band changes, the effective integral behavior changes too

### Process Identification Values

The JCI PRAC material uses process concepts that every commissioning tech should know:

| Term | Meaning |
| --- | --- |
| Process dead time | Delay from output step until PV begins to respond. |
| Time constant | Time from the first PV movement until the PV reaches about 63% of its total change. |
| Process range | PV change caused by output moving from 0% to 100%. |
| Saturation time | Time output must remain at a low or high limit before saturation status is set. |
| Interval or period | Time between PID executions. |

These terms explain why PRAC+ works best on certain mechanical systems. A linear first-order-plus-delay loop gives the adaptive logic a recognizable pattern. A nonlinear or sequenced plant may not.

### Tracking Anti-Windup

Metasys documentation describes tracking anti-windup as a way to prevent large oscillations caused by integral windup. If the output is beyond high or low limits, the output is clamped. Without anti-windup, the integral term can keep accumulating even though the actuator cannot move further.

The practical behavior is a tradeoff:

- If saturation is brief, the controller can exit saturation before crossing setpoint to reduce overshoot.
- If saturation lasts a long time, the controller may stay saturated until the PV crosses setpoint.

Operators should trend both output and saturation status. A loop that looks "stuck" may be following tracking anti-windup logic rather than failing.

### Bumpless Transfer

Metasys bumpless transfer uses startup value. In standard applications, the last output value can be tied to the startup value for PIDs that may control the actuator. When control switches, the new PID starts from the last output instead of jumping.

This is especially important on fast loops such as static pressure where a sudden fan command jump can create noise, comfort issues, or equipment stress.

### Setpoint Weighting

Setpoint weighting prevents large output reactions during setpoint changes. Metasys documentation describes using weighting parameters so the full setpoint does not necessarily enter every PID term the same way.

The operator-facing concept is simple:

```text
Weight setpoint response to avoid output kick.
Keep disturbance response strong enough for real load changes.
```

Derivative kick is avoided when derivative does not fully react to a step change in setpoint.

### PRAC+ Adaptive Tuning

PRAC+ means Pattern Recognition Adaptive Control. It watches setpoint, process variable, and output behavior to decide whether tuning should be updated.

JCI documentation describes two monitoring situations:

- PV leaves the minimum tune band around setpoint.
- SP changes outside the minimum tune band.

PRAC+ then looks for response patterns. It counts sign changes and samples. For load disturbances, it looks for more sign-change evidence than for setpoint changes because the disturbance begins while PV is moving away from setpoint. It also stops monitoring after a sample limit if the required pattern is not observed.

When PRAC+ determines tuning is required, it uses response features including:

- Maximum output change, `h`
- Maximum slope between response extremes, `S1`
- Maximum slope between later response extremes, `S2`
- Process interval time, `T`
- Oscillation ratio
- Clear time

These values are used to calculate new proportional band and integral time.

### Systems Not Suited for PRAC+

JCI documentation says PRAC+ is designed for many linear first-order-plus-delay mechanical systems. It is less ideal for:

- Redundant systems
- Delay-time-dominant systems
- Oversized staged systems
- Systems controlled with a sequencer
- Nonlinear systems

> Field Tip: PRAC+ is powerful when the plant produces a clean, recognizable pattern. Turn it off or distrust the result when resets, staging, sequencers, lockouts, or mechanical faults are controlling the trend more than the PID is.

### JCI in the Vendor PID Lab

The `JCI Metasys PID/PRAC+` profile models:

- Proportional band to gain conversion
- Effective proportional band
- Integral time and effective integral time
- Saturation time
- Interval execution
- Startup value and bumpless behavior
- Setpoint weighting
- Tracking anti-windup
- PRAC+ training approximation that speeds recovery for sluggish response and relaxes tuning for hunting

The simulator deliberately shows `Eff PB`, `Eff Ti`, and `PRAC Status` so operators learn to watch the adaptive layer, not only the raw PV trend.

## Operator Translation Table

| Lab concept | Siemens LOOP | Siemens PID_Compact | Honeywell JACE 8000 profile | ALC WebCTRL/EIKON profile | JCI Metasys PID/PRAC+ |
| --- | --- | --- | --- | --- | --- |
| Proportional strength | `PG` | `Gain`, `Kp` | Throttling range converted to internal gain | `Kp` or P gain | Proportional band converted to gain |
| Integral strength | `IG` | `Ti` | Integral time/reset time | `Ti` or I gain based on interval | Integral time and effective integral time |
| Derivative strength | `DG` | `Td`, derivative weighting, derivative filter | Derivative time | `Td` | Derivative time, normally disabled in adaptive PRAC+ profile |
| Timing | `st` sample time | Cyclic interrupt and PID sampling time | Period/sample time | Interval | Interval/period |
| Bias or starting output | `bias` | Manual/substitute output and internal tracking | Startup value and bias | Bias | Startup value and bias |
| Limits | `lo`, `hi` | Output lower/upper limits | Output min/max | Output min/max | Output low/high limit and saturation status |
| Anti-windup | Automatic prevention at limits | Anti-windup in PIDT1 block | Modeled as conservative BAS tracking | Modeled clamp behavior | Tracking anti-windup |
| Setpoint kick handling | Not the main exposed concept | P/D weighting | Error ramp approximation | Usually handled by tuning/interval choices | Setpoint weighting |
| Adaptive behavior | ADAPTS/ADAPTM as separate adaptive commands | Pretuning/fine tuning modes | Not publicly modeled from Niagara/JACE internals | TUNE examples support tuning workflow | PRAC+ adaptive tuning |

## What to Trend by Vendor

| Vendor profile | Minimum trend points | Extra points that help |
| --- | --- | --- |
| Siemens LOOP | SP, PV, CV, sample interval, output limits | `PG`, `IG`, `DG`, direct/reverse flag, bias |
| Siemens PID_Compact | SP, scaled input, output, mode/state | `Gain`, `Ti`, `Td`, P weighting, D weighting, dead zone, manual/substitute output |
| Honeywell JACE 8000 | SP, PV, output, mode, command source | Throttling range, integral time, startup value, limit status if exposed |
| ALC WebCTRL/EIKON | SP, PV, output, interval, equipment status | P/I/D contribution if available, trend around step tests, actuator feedback |
| JCI Metasys PID/PRAC+ | SP, PV, output, saturation status, PRAC status | Proportional band, effective proportional band, integral time, effective integral time, interval, startup value |

## When to Distrust Auto or Adaptive Tuning

Auto or adaptive tuning can be very helpful, but it is not magic. Distrust or postpone it when:

- The actuator is stuck, overridden, hunting mechanically, or not matching command.
- The loop is inside a reset sequence that is moving the setpoint at the same time.
- The output is saturated for most of the test.
- The system is staged or sequenced and the PID only controls part of the response.
- The process is strongly nonlinear.
- Sensor noise is large compared with the tune band.
- The loop is not under a typical load.
- Another controller is fighting the loop.
- Someone changes setpoints, lockouts, or manual overrides during the test.

> Commissioning Note: A clean trend is more valuable than a fancy tuning routine. If the pattern is contaminated, the tuning result is contaminated too.

## How to Compare Vendors Without Copying Numbers

Use this sequence when moving tuning knowledge between vendors:

1. Identify whether the proportional field is gain, proportional band, or throttling range.
2. Identify whether integral is gain-like or time-like.
3. Confirm direct/reverse action against the actual equipment response.
4. Confirm sample interval or execution period.
5. Confirm output scaling and limits.
6. Confirm whether derivative acts on error or measurement and whether it is filtered.
7. Confirm anti-windup behavior by observing saturation recovery.
8. Confirm bumpless behavior by switching Manual to Auto at a safe operating point.
9. Validate with a small setpoint or load change.
10. Save a trend before and after the change.

Do not translate tuning by matching faceplate numbers. Translate the meaning first.

## Why the Simulator Profiles Are Not Firmware Replicas

The Vendor PID Lab has two jobs:

- Give operators realistic exposure to vendor-specific faceplate terms and response personalities.
- Make controller behavior visible enough to teach commissioning decisions.

The lab does not have access to proprietary firmware source code. Where public documentation is strong, the simulator follows it closely. Where documentation is limited, the simulator uses a conservative, transparent approximation and labels it that way.

This honesty is part of the training. In the field, operators rarely know every internal detail either. Good commissioning depends on recognizing the faceplate terms, trending the right points, understanding the process, and changing one thing at a time.
