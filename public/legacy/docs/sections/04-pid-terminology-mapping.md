# 4. PID Terminology Mapping (Cross-Platform)

Different BAS platforms often describe the same control behavior with different labels, units, and configuration fields. Before copying tuning concepts between systems, confirm what each setting actually means inside that platform.

## Common Mapping Table

| Common Concept | Alternate Names Seen Across BAS Platforms | Practical Meaning |
| --- | --- | --- |
| Proportional Gain | Proportional Band | Strength of immediate response to current error |
| Integral Time | Reset Time, Repeats per Minute | How quickly accumulated error is corrected |
| Derivative Time | Rate, D Gain | Response to rate of change of the measured process |
| Output Bias | Offset, Manual Reset | Base output around which the controller modulates |
| Deadband | Neutral Zone, Hysteresis | Area where small changes do not cause output movement |
| Direct Acting | Positive Acting in some interfaces | Output increases as measured value rises, depending on implementation |
| Reverse Acting | Negative Acting in some interfaces | Output decreases as measured value rises, depending on implementation |

## What Must Be Verified Before Reusing a Tuning Concept

- Units used for proportional action
- Whether integral is time-based, repeat-based, or gain-like
- Whether derivative acts on error or measurement
- Output scaling such as 0 to 100 percent, engineering units, or custom range
- Control direction relative to the actual physical process
- Any built-in anti-windup, output limits, or bias tracking behavior

> Commissioning Note: Always verify units, direction, and scaling before applying tuning values. A setting that looks familiar may represent the inverse of what another platform calls by the same name.

## Practical Translation Rule

Translate the concept first, not the number. A gain or reset value that works on one BAS may be too aggressive, too slow, or even inverted on another because the underlying implementation is different.

> Common Pitfall: Teams sometimes copy a “known good” tuning package across projects without checking sensor range, output scaling, or proportional band versus gain format. That shortcut can create the appearance of tuning work while actually introducing new instability.
