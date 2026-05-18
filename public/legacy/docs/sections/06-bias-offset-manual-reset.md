# 6. Bias, Offset, and Manual Reset

Bias, offset, and manual reset all describe the idea that a loop often needs a baseline output even before proportional or integral correction is added.

## What Bias Means in Practice

Bias is the controller output the loop tends to sit around when the process is near stable conditions. In BAS terms, this might be:

- A cooling valve that normally needs some minimum opening under stable load
- A fan that must stay above a minimum speed to maintain airflow or pressure
- A pump loop that requires baseline speed to keep distribution stable

<!-- widget:bias-slider-demo -->

## Manual Reset in Context

Historically, manual reset allowed an operator or engineer to shift the controller output baseline so a proportional loop could hold the process closer to target. In modern BAS practice, integral action usually performs that correcting function automatically, but the concept still matters because many platforms expose a bias or offset term directly.

## How Bias Interacts with Integral Action

- A good starting bias can reduce how much integral action must accumulate
- Poor bias selection can force integral to work harder than necessary
- When a loop returns from Manual to Auto, bias tracking affects whether the transfer is smooth or abrupt

## Practical Examples

| Situation | Role of Bias |
| --- | --- |
| Valve loop with minimum useful position | Prevents starting from a physically unrealistic closed position |
| Fan speed loop with minimum airflow requirement | Establishes the lowest stable output that still meets process needs |
| Baseline output in a stable operating mode | Gives the controller a sensible center point for modulation |

## Datacenter HVAC Application

Bias becomes especially important in cooling-critical applications where the controller must always maintain some minimum output to ensure flow or airflow continuity.

**Heating valve example:** A perimeter heating valve in a datacenter may need to remain slightly open even when the supply air temperature is exactly at setpoint. Without bias, the proportional term produces zero output at setpoint, and the valve closes completely. Minimum flow requirements for the coil — preventing freeze conditions in winter — mean a small positive bias is necessary to hold the valve at its minimum useful position regardless of the error signal.

**Chilled water pump example:** A chilled water pump VFD loop serving a computer room air handler may have a minimum speed requirement (often 20–30% of full speed) below which the pump operates in its surge region. Bias set to that minimum prevents the PID from commanding below the floor even during very light load conditions.

**Practical bias setup for datacenter loops:**

1. Determine the physical minimum output that still maintains safe operation (minimum flow, minimum airflow, minimum cooling capacity)
2. Set bias to that value before enabling Auto
3. Verify the loop does not command below the minimum when at setpoint under low load
4. Confirm the integral term does not wind down against the bias floor

> Design Consideration: Bias is not a substitute for integral tuning, but it can make the loop easier to stabilize by starting the controller near a realistic operating point.

> Commissioning Note: When a loop behaves well in Manual but jumps abruptly in Auto, review how the platform handles output bias, integral memory, and bumpless transfer before changing gains.
