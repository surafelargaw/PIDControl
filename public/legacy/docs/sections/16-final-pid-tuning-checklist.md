# 16. Final PID Tuning Checklist

## Design Phase Checklist

- Confirm the process requires modulating control rather than simpler logic
- Select P, PI, PD, or PID based on process behavior and field practicality
- Define intended control direction from the physical process
- Identify expected output limits, bias needs, and any deadband strategy
- Anticipate how resets, safeties, and mode changes will interact with the loop

## Commissioning Phase Checklist

- Verify sensor calibration and point scaling
- Confirm actuator stroke, command range, and minimums
- Validate direct versus reverse action with a controlled test
- Coordinate with TAB so air and water conditions are meaningful
- Trend PV, SP, CV, and related reset or mode signals during tuning
- Change one parameter at a time and allow the process to settle
- Confirm acceptable Auto to Manual to Auto behavior

## Post-Occupancy or Long-Term Verification Checklist

- Review trend behavior across different loads and seasons
- Watch for increased output travel, drift, or new oscillation
- Reconfirm that sequence changes did not invalidate prior tuning
- Investigate fouling, stiction, or calibration drift before retuning
- Document why any tuning change was made and what improved

## Final Reminder

The best PID tuning result is not the most aggressive loop. It is the loop that consistently supports the sequence intent, protects reliability, and remains understandable to the next engineer who has to operate or troubleshoot it.

> Design Consideration: Standardize the verification process more strongly than the numeric settings. Cross-platform consistency comes from shared engineering method, not from identical gain values.
