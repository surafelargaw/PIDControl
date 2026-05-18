# 13. Long-Term Performance Evaluation Strategy

Successful PID work does not end after startup. Long-term trending is what reveals whether a loop remains stable across the operating envelope it will actually see in service.

## Recommended Trending Signals

- Process variable
- Setpoint
- Controller output
- Control error or a signal that allows error reconstruction
- Relevant reset inputs, if they materially affect the loop

## What to Evaluate Over Time

- Day versus night behavior
- Low load versus high load response
- Outdoor air swings and seasonal transitions
- Startup and post-maintenance recovery behavior
- Repeating disturbances such as staging, occupancy changes, or valve position resets

## Signs of Performance Drift

- The loop gradually needs more output to achieve the same result
- Output travel increases without a corresponding process benefit
- Oscillation appears only in certain weather or load conditions
- Recovery becomes slower after maintenance or filter loading
- Control quality depends too heavily on one operating mode

## Likely Causes Behind Drift

- Sensor calibration change
- Valve or damper stiction
- Fouled coils or heat exchangers
- Flow balance changes
- Re-sequencing or reset interaction added after original tuning

## Datacenter-Specific Evaluation Considerations

Datacenter HVAC loops face a more demanding long-term environment than typical comfort systems because IT load can change rapidly, continuously, and at any time of day or night.

**Outdoor air temperature effect:**
Cooling coil performance, chiller efficiency, and economizer capacity all change with outdoor conditions. A loop tuned at peak summer conditions may have too much authority in winter when chilled water is colder and coil capacity is higher. Plan to evaluate — and potentially re-tune — loops at seasonal extremes, not just at initial commissioning.

**Overnight evaluation:**
Many datacenter cooling problems only appear during overnight low-load periods when:
- Fewer IT systems are active and the thermal load drops sharply
- Chilled water supply temperature may be lower than daytime targets
- Economizer modes may engage, changing the control authority of mechanical cooling
- Minimum flow or minimum speed requirements become dominant constraints

Trend overnight behavior specifically when evaluating whether a loop is truly performing well across its full range.

**Monitoring over hours and days:**
A loop that looks stable over a 30-minute trend window may exhibit slow drift that only becomes visible over several hours. Metrics to watch in long-term trends:

| Signal to trend | What slow-developing problems it reveals |
|----------------|----------------------------------------|
| Integral term alone | Integral windup accumulating slowly against a limit or offset |
| Output vs. valve position gap | Growing actuator friction or stiction over time |
| SP-PV error rolling average | Bias that was adequate at startup but needs adjustment as loads shift |
| Disturbance signal vs. PV excursion | Whether disturbance rejection is degrading as coils foul or filters load |

**Identifying external influences:**
Before declaring a tuning problem, rule out external causes:
- Upstream flow changes (other zones, other AHUs on the same chilled water loop)
- Chiller staging events that cause sudden ΔT changes in chilled water supply
- IT load surges from batch jobs, backup operations, or hardware deployment
- Building automation system reset schedules that override local setpoints

> Commissioning Note: A loop that was acceptable at startup can still require later review once the system experiences real load diversity and seasonal conditions.

> Field Tip: Trend enough variables to explain the story. A PV-only trend rarely shows whether the problem was tuning, reset interaction, actuator saturation, or mechanical drift.
