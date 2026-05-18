# 5. Deadband / Neutral Zone

Deadband exists to prevent a loop from reacting to every small fluctuation around setpoint. In BAS work, that usually means less hunting, less actuator wear, and less output noise when the process is already acceptably close to target.

## Key Distinctions

- **Deadband or Neutral Zone** means a small region where the controller intentionally does not move the output for minor changes.
- **Hysteresis** usually means different thresholds are used for turning on versus turning off, often in staged or binary logic.
- **Proportional Band** describes how proportional response is scaled across a range of error. It is not the same thing as deadband.

<!-- widget:deadband-valve-demo -->

## When Deadband Helps

- Loops with noisy sensors near setpoint
- Valves that chatter with very small output changes
- VFD loops where minor fluctuations do not justify constant speed movement
- Staged equipment trim logic where cycling must be limited

## When Deadband Should Be Used Carefully

- Tight process loops where even small deviation matters
- Slow loops that already respond sluggishly
- Critical cooling applications where a large neutral zone may hide instability until it becomes significant

## Typical Application View

| Application | Typical Use of Deadband | Reason |
| --- | --- | --- |
| Modulating valves | Small deadband may help | Reduces seat wear and small output chatter |
| Fan VFD loops | Often useful | Prevents continuous speed trim from tiny measurement noise |
| Pump VFD loops | Often useful | Limits unnecessary speed movement around stable load |
| Staged equipment | Common and often essential | Avoids short cycling and stage thrashing |
| Alarm thresholds | Separate from control deadband | Alarm logic may need hysteresis, but this is not the same as loop tuning |

## Datacenter HVAC Application

In datacenter environments, deadband decisions have direct energy and reliability consequences.

**Concrete example:** A supply air temperature loop with a setpoint of 72°F and a ±1°F deadband will not move the cooling valve as long as the measured temperature stays between 71°F and 73°F. This prevents the valve from hunting around setpoint when minor fluctuations are well within acceptable range.

| Equipment | Recommended Approach | Reason |
|-----------|---------------------|--------|
| Chilled water valves | Small deadband (0.5–1°F) acceptable | Prevents seat chatter; cooling margin is typically adequate |
| Fan VFD duct pressure | Narrow deadband only | Static pressure loops are fast; wide deadband can allow meaningful swings |
| Chiller pump DP | No deadband or minimal | Differential pressure control needs tight response to flow changes |
| CRAC/CRAH unit speed | Small deadband acceptable | Thermal time constants are slow enough to tolerate brief neutral zones |

**Critical caution for datacenter cooling:** A deadband that is too wide can allow supply air temperature to drift several degrees before the controller responds. In high-density environments this can mean thermal excursions that reach IT equipment before the loop reacts. Size deadband based on the actual thermal margin available, not on the general assumption that a wider deadband is always safer.

> Field Tip: If output is moving constantly while PV is already close to target, review deadband before assuming the loop needs more tuning aggressiveness.

> Common Pitfall: A large deadband can make a loop look calm while actually allowing poor control quality. Reduced movement is not automatically better if the process drifts too far from setpoint.
