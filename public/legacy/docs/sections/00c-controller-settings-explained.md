# 0.3 Controller Settings Explained

The `Settings` tab is where the user changes the controller math. These controls affect how the PID block interprets error, accumulates correction, reacts to rate of change, filters signals, and limits output.

## How The Simulator Calculates CO

At each simulation step, the controller follows this sequence:

1. Start with the active setpoint. If `SP Filter` is enabled, the setpoint is filtered before it reaches the control calculation.
2. Read the process variable. This may include measurement noise or an advanced PV override.
3. If `PV Filter` is enabled, filter the measured PV before using it in the control calculation.
4. Apply controller direction so the controller responds correctly for `direct` or `reverse` processes.
5. Calculate the `P`, `I`, and `D` terms based on the selected algorithm, controller form, and signal source choices.
6. Add the terms to the controller `Bias` to create the requested CO.
7. Clamp CO to the configured output limits.
8. If output is saturated, reduce unnecessary integral build-up through anti-windup logic.

In short form, the app is using the following ideas:

- `P = proportional gain x selected proportional signal`
- `I = previous integral + integral gain x error x dt`
- `D = derivative gain x rate of change of the selected derivative signal`
- `CO = Bias + P + I + D`, then limited by output limits

![PID terms overview showing how proportional, integral, and derivative action feel different in practice.](assets/help/pid-terms-overview.svg)

## PID Terms In Operator Language

### Proportional

Proportional action responds to present error. The farther the PV is from SP, the more immediate push the controller applies.

Higher proportional gain usually means:

- faster initial response
- larger CO movement
- greater risk of overshoot or oscillation

### Integral

Integral action responds to error that remains over time. It exists to remove offset.

If the PV gets close to setpoint but never quite reaches it, integral action keeps adding correction until the remaining error is reduced.

Lower `Ti` means stronger integral action because the integral term builds faster.

### Derivative

Derivative action responds to how fast the signal is changing. It adds damping and can help reduce overshoot, especially on faster loops.

Derivative is useful when:

- the process moves quickly
- overshoot is a problem
- the measurement is reasonably clean

Derivative is risky when:

- the PV is noisy
- the sensor jumps or chatters
- the loop is slow enough that derivative adds little value

![Filtering versus noise comparison showing a noisy measured PV and a smoother filtered PV.](assets/help/filtering-vs-noise.svg)

> Field Tip: If derivative seems to make the output noisy, the first questions should be "Is the PV noisy?" and "Should D be on PV with more filtering?" rather than "Should I keep increasing D?"

<!-- widget:pid-term-explorer -->

## Controller Settings Reference

| Setting | What it means technically | Why an operator or trainer uses it |
| --- | --- | --- |
| `Algorithm` | Chooses whether the controller uses `P`, `PI`, or `PID` behavior | Use to compare how offset removal and damping change the response |
| `Form` | Chooses `Standard`, `Series`, or `Parallel` gain interpretation | Use to demonstrate that controller form changes how the same numbers behave |
| `P Action On` | Chooses which signal drives proportional response | Use to discuss proportional response on `Error` versus `PV`-related behavior |
| `D Action On` | Chooses whether derivative reacts to `Error` or `PV` | Use to show why derivative on PV is often calmer during setpoint changes |
| `Kp` | Sets proportional gain strength | Use when teaching aggressiveness, hunting, and response speed |
| `Ti (s)` | Sets integral time | Use when teaching offset removal and recovery after disturbances |
| `Td (s)` | Sets derivative time | Use when teaching damping and overshoot control |
| `Bias (%)` | Sets the baseline output around which PID terms add or subtract | Use when explaining normal operating position and controller trim |
| `SP Filter` | Filters the setpoint before the controller responds to it | Use to soften sharp SP steps on slower loops |
| `SP Filter Time (s)` | Sets how slowly the SP filter moves toward a new SP | Use to teach ramped or softened target changes |
| `PV Filter` | Filters measured PV before it enters the control math | Use to reduce reaction to measurement noise |
| `PV Filter Time (s)` | Sets how strong the PV filter is | Use to compare noise reduction versus added lag |
| `Output Min (%)` | Lowest allowed controller output | Use to demonstrate actuator limits or minimum speed/position constraints |
| `Output Max (%)` | Highest allowed controller output | Use to demonstrate saturation and recovery limits |

## P, PI, And PID Modes

| Mode | What is included | Expected behavior |
| --- | --- | --- |
| `P` | Proportional only | Fast reaction but usually leaves steady-state offset |
| `PI` | Proportional and integral | Common default for HVAC loops because it removes offset without relying on derivative |
| `PID` | Proportional, integral, and derivative | Adds damping and predictive response, but is more sensitive to PV quality |

## Standard, Series, And Parallel Forms

The simulator includes three controller forms because real BAS and PLC platforms do not all interpret `Kp`, `Ti`, and `Td` in the same way.

- `Standard` uses proportional gain as the main scale and derives integral and derivative from it
- `Parallel` treats `P`, `I`, and `D` more independently
- `Series` couples the terms differently and often feels stronger for the same nominal settings

Training value:

- users learn that copying numbers between platforms without checking controller form is risky
- trainers can show that "same tuning numbers" does not always mean "same response"

## Bias And Output Limits

`Bias` is the controller's baseline output. It is the position the loop would tend to sit around before the dynamic PID terms push it higher or lower.

This matters because many BAS loops do not operate around `0%`. A valve or VFD may normally run near a mid-range output, so PID action trims around that normal operating point.

Output limits matter because the controller cannot command below the minimum or above the maximum. Once the output saturates, integral action can become misleading unless anti-windup is applied.

The simulator includes anti-windup behavior so the integral term does not continue building in the wrong direction while CO is pinned at a limit.

For the deeper field explanation, use `6. Bias, Offset, and Manual Reset` and `9. Anti-Windup, Bumpless Transfer, and Mode Changes`.

## Direct And Reverse Acting

The selected process model determines whether increasing CO raises PV or lowers PV.

- `Direct` acting model: more output increases PV
- `Reverse` acting model: more output decreases PV

Example:

- A heating valve loop is typically `direct`
- A cooling valve loop is typically `reverse`

The controller direction is not just a label. It changes the sign of the control error and therefore changes how the PID terms react.

> Common Pitfall: Wrong control direction can look like "extreme tuning problems" because the controller pushes harder in the wrong direction. Always verify direction before tuning.

For the full direction-check procedure, use `7. Direct-Acting vs Reverse-Acting Control`.
