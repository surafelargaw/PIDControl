# 10. Common TAB & Commissioning Considerations

PID tuning should not begin until the process is actually commissionable. TAB conditions and mechanical realities strongly influence loop behavior.

## Typical Prerequisites Before Tuning

- Sensor calibration has been verified
- Actuator stroke or command range is confirmed
- Valve authority is acceptable for the loop purpose
- Air and water flows are balanced to the extent required by the sequence
- Fan curves, minimum speeds, and stable operating regions are known
- Damper leakage, outside air constraints, and minimum position logic are understood

## How TAB Conditions Influence PID Behavior

- Poor balance can make a loop look slow or ineffective
- Oversized or authority-poor valves can create nonlinear response
- Unstable minimums can create apparent hunting that is really a mechanical limit issue
- Sensor location can make the controller react to local turbulence instead of the intended process

## Coordination Expectations

| Discipline | Main Responsibility During Tuning |
| --- | --- |
| Controls | Confirm logic, direction, scaling, trends, and tuning changes |
| TAB | Confirm actual air and water behavior, minimums, and balancing state |
| Commissioning | Verify the sequence intent, testing conditions, and acceptance criteria |
| Operations | Provide operating context, observed issues, and mode constraints |

> Commissioning Note: Tune under conditions that represent how the system is expected to operate. A loop tuned during an artificial test state may not behave the same way under live load and reset interaction.

> Field Tip: If TAB is still adjusting flows or minimum positions, treat tuning as provisional. Final loop behavior should be confirmed after balance is stable.
