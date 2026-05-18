# 9. Anti-Windup, Bumpless Transfer, and Mode Changes

## Integral Windup

Integral windup occurs when the controller keeps accumulating corrective action even though the actuator cannot deliver more useful response. This often happens when the output is already at a maximum or minimum, or when the loop is held in a constrained condition during startup, override, or equipment limitation.

Common field symptoms include:

- Large overshoot after the process finally starts responding
- Long recovery time when an override is removed
- Abrupt output changes during Auto restoration

<!-- widget:windup-demo -->

## Anti-Windup Concepts

| Technique | Conceptual Purpose |
| --- | --- |
| Output clamping | Limits controller output to a valid range |
| Integral freezing or limiting | Prevents continued accumulation when the actuator is saturated |
| Back-calculation | Keeps the internal integral state aligned with the actual output |
| Mode tracking | Helps the controller re-enter Auto without a large internal mismatch |

## Bumpless Transfer

Bumpless transfer means switching between Auto and Manual without creating a sudden, unnecessary jump in output. This matters during commissioning, troubleshooting, and operator intervention.

In BAS practice, a poor Auto to Manual to Auto experience can make a healthy loop appear badly tuned when the real issue is state tracking during the mode change.

## Saturation Can Also Create Offset

A common assumption is that any loop with integral action should always remove offset. In practice, that is not always true. Some PID implementations stop or modify integration whenever the internal controller output hits a limit. Under repeated disturbances, that can leave the average PV below or above setpoint even though the loop includes I action.

This does not mean anti-windup is wrong. It means the details matter:

- Check whether the PID block's internal output limit is the same as the physical actuator limit
- Trend saturation events during the periods where offset appears
- Confirm whether the integrator is frozen, back-calculated, or otherwise modified at the limit
- Review whether a separate external limiter is more appropriate for the actuator in that specific platform

Any change to saturation handling should be validated carefully. The right approach depends on the controller implementation and the safety envelope of the real process.

## Gain Scheduling and Split-Range Need Bumpless Logic

When a controller changes gains across operating regions, or hands off between heating and cooling devices, the transition should be bumpless. A mathematically correct gain schedule that causes a visible output bump still creates avoidable process upset.

Watch for this especially when:

- A loop changes between heating and cooling authority
- A split-range block hands off to a different actuator
- A controller changes tuning sets by operating point or load
- An override or safety sequence returns control to the PID block

## Best Practices for Overrides and Mode Changes

- Use Manual only long enough to verify direction, stroke, or process effect
- Record the manual output value before returning to Auto
- Remove overrides in a controlled sequence
- Watch both PV and CV immediately after returning to Auto
- Confirm that resets, safeties, and limit logic are not simultaneously forcing the output
- Validate mode changes with the same seriousness as setpoint steps

> Field Tip: If a loop behaves well during steady Auto operation but reacts poorly after overrides, investigate anti-windup and transfer behavior before reworking the tuning.

> Common Pitfall: Operators may leave a loop in Manual to "keep it stable" when the real need is to correct transfer behavior, sequence conflicts, or actuator limits.
