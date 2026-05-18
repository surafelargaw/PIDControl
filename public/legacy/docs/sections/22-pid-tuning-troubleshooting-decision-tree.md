# 22. PID Tuning Troubleshooting Decision Tree

Use this guide after a loop trend shows a clear problem and before changing controller gains. The first branch is deliberate: many loops that look like tuning problems are actually mode, sensor, actuator, scaling, override, or sequence problems.

![PID tuning troubleshooting decision tree showing basic checks, symptom branches, likely causes, and tuning responses.](assets/help/pid-tuning-troubleshooting-decision-tree.svg)

## Start With Basics

Do these checks first every time. If any answer is no, fix the hardware, signal, or sequence logic before treating the issue as a tuning problem.

| Check | Why It Matters | If The Answer Is No |
| --- | --- | --- |
| Loop is in `AUTO` | A manual or overridden loop is not being controlled by the PID block | Restore the expected mode or document the override before judging tuning |
| Sensor is accurate and stable | Bad PV data makes every tuning decision misleading | Calibrate, relocate, repair, or filter the measurement |
| Actuator responds correctly | Valve, damper, drive, or positioner faults can mimic poor gains | Stroke or command the actuator and fix stiction, deadband, lag, or direction |
| Signal scaling and filtering are reasonable | Bad engineering units or excessive filtering changes the apparent process | Correct scaling and review filter time constants |
| No competing loops or overrides are fighting the controller | Reset logic, safeties, cascade loops, and limits can hide the real response | Trend the competing signals and resolve the sequence conflict |

## Primary Symptom Branches

Once the basics pass, identify the main trend symptom. Use the first branch that best matches what the PV and output are doing.

| Symptom Branch | Trend Pattern | Likely Cause | First Tuning Response |
| --- | --- | --- | --- |
| **A. Oscillations or hunting** | Repeating cycles around setpoint | Excessive proportional gain, excessive integral action, noise, dead time, loop interaction, or mechanical cycling | Reduce aggression first; then investigate noise, process delay, and interaction |
| **B. Overshoot** | PV crosses the setpoint after a step and then settles | Kp too high, Ki too high, integral windup, or not enough damping | Reduce Kp or Ki; add small derivative only when the signal is clean |
| **C. Slow response or sluggish loop** | PV moves too slowly or lags the load | Kp too low, integral action too aggressive for the delay, process dead time, or derivative opposing motion | Increase Kp gradually; reduce unnecessary Ki or Kd if they are slowing recovery |
| **D. Steady-state error** | PV stabilizes away from setpoint | Insufficient integral action, disabled integral, output limit, or bias issue | Add integral slowly after confirming output is not saturated |
| **E. Noisy or erratic output** | Output jitters or PV contains rapid fluctuations | Sensor noise, high derivative gain, short filter, poor placement, or turbulent source | Improve signal quality and reduce or remove derivative |
| **F. Output saturation or windup** | Output is pinned at 0 percent or 100 percent, then recovery is poor | Integral windup, undersized equipment, wrong limits, or capacity problem | Reduce Ki, add anti-windup or output limits, and verify equipment capacity |

## A. Oscillations Or Hunting

| If You See | Likely Cause | Action |
| --- | --- | --- |
| Large slow swings | Excessive `Kp` or `Ki` | Reduce `Kp`; increase integral time or reduce `Ki` |
| Fast high-frequency oscillation | Noise or too much `Kd` | Reduce or disable derivative; add filtering only as much as needed |
| Continuous oscillation even at low gain | Dead time, interacting loops, valve sizing, resonance, or mechanical fault | Check process delay, valve authority, mechanical resonance, and whether two loops are fighting |

> Internal training reference: Persistent oscillation often requires lowering proportional action and/or slowing integral action. [1-ca9034]

## B. Overshoot

| If You See | Likely Cause | Action |
| --- | --- | --- |
| Significant overshoot after a setpoint step | High `Kp` or high `Ki` | Reduce `Kp`; reduce `Ki` or increase integral time |
| Overshoot with long settling time | Integral windup | Reduce `Ki`; add anti-windup and realistic output limits |
| Overshoot with slow damping | Not enough damping for the process | Add a small `Kd` only when the PV signal is clean enough |

> Internal training reference: Overshoot is commonly caused by excessive proportional or integral gain, while derivative can reduce it when the signal is clean. [2-3eb4cc]

## C. Slow Response Or Sluggish Loop

| If You See | Likely Cause | Action |
| --- | --- | --- |
| Long rise time | Low `Kp` | Increase `Kp` gradually and wait for the process to respond |
| PV moves but never catches up | Excessive `Ki`, excessive integral action for the process delay, or real process dead time | Reduce `Ki`; check process dead time before making the loop more aggressive |
| Output feels sticky or fights itself | High derivative action opposing motion | Reduce or remove `Kd` |

> Internal training reference: Slow response typically relates to low proportional action or excessive integral action for the process dynamics. [3-8a57d3]

## D. Steady-State Error

| If You See | Likely Cause | Action |
| --- | --- | --- |
| PV stabilizes but not at setpoint | Insufficient integral action | Increase `Ki` slowly or reduce integral time carefully |
| PV remains offset while output is pinned | Capacity, authority, or limit problem | Fix the limit, sizing, or authority issue before retuning |

> Internal training reference: The integral term eliminates steady-state error by accumulating past error. [4-1a7b74]

## E. Noisy Or Erratic Output

| If You See | Likely Cause | Action |
| --- | --- | --- |
| PV fluctuates rapidly | Sensor noise, bad placement, turbulence, or scaling issue | Verify sensor quality and placement; filter the PV only as much as necessary |
| Output is jittery with derivative enabled | High `Kd` amplifying noise | Reduce or remove `Kd`; this is common in BAS and HVAC loops |

> Internal training reference: Derivative amplifies noise and is often avoided in HVAC systems. [1-ca9034]

## F. Output Saturation Or Windup

| If You See | Likely Cause | Action |
| --- | --- | --- |
| Output pegged at 0 percent or 100 percent | Integral windup, undersized equipment, wrong limits, or capacity problem | Reduce `Ki`; add output limits or anti-windup; verify equipment capacity |
| Large overshoot after saturation clears | Accumulated integral error | Tune `Ki` lower and consider a reset or anti-windup strategy |

## End By Validating The Trend

After each change, validate from a trend rather than a single faceplate snapshot.

| Validate | What To Look For |
| --- | --- |
| Rise time | PV moves with useful authority without jumping past the target |
| Overshoot | Peak excursion is acceptable for the process and safety limits |
| Settling | PV settles within specification without repeated hunting |
| Stability window | The loop remains stable for the operating window being evaluated, commonly 3 to 5 representative cycles |
| Documentation | Final `Kp`, `Ki` or integral time, `Kd`, filters, limits, mode, and notes are recorded |

> Field Tip: Change one tuning value at a time and wait long enough for the process to answer. If a loop is saturated, overridden, or mechanically unhealthy, the correct next move is not another gain change.
