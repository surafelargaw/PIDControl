# 15. Example Walkthroughs

## Temperature Control Valve Loop

Consider a cooling coil valve controlling supply air temperature. The process is usually moderate to slow because thermal mass, coil response, airflow stability, and sensor location all add lag.

Expected good behavior:

- The valve output moves in the correct direction without delay caused by logic conflicts
- The process variable trends toward setpoint with limited overshoot
- Output does not continuously chatter once the loop is close to target
- Integral removes the remaining offset gradually rather than forcing oscillation

What this loop often teaches:

- PI is usually enough
- Too much integral can create repeated hunting after the first correction
- Poor valve authority or unstable airflow can look like bad tuning even when the controller logic is reasonable

> Field Tip: If the valve moves significantly but temperature barely responds, check flow, valve authority, and sensor placement before pushing gains upward.

## Static Pressure Fan Control Loop

Consider a supply fan VFD controlling duct static pressure. This process is usually faster than a thermal loop, but the measured pressure can move because dampers, resets, and duct conditions are changing at the same time.

Expected good behavior:

- Fan speed responds promptly to the pressure error
- Pressure returns toward target without repeated overshoot
- Output movement remains understandable rather than constantly busy
- The loop remains stable while downstream dampers and static reset logic are active

What this loop often teaches:

- PI is still a common starting point
- Derivative may help in select cases, but only when the signal quality supports it
- Apparent tuning problems are often caused by setpoint reset interaction or unstable minimum fan limits

> Commissioning Note: Judge a fan static loop with both PV and CV visible. A pressure trend alone can hide excessive speed movement that increases wear and energy use.
