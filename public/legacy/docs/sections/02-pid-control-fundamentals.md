# 2. PID Control Fundamentals

## BAS-Oriented Definitions

- **PV (Process Variable)** is the measured condition being controlled, such as supply air temperature, duct static pressure, differential pressure, airflow, or humidity.
- **SP (Setpoint)** is the intended target value for the process.
- **CV (Control Variable or Output)** is the controller command sent to the final control element, such as valve position, damper command, or VFD speed.
- **Control Error** is the difference between the setpoint and the measured process variable.

In words, the control block diagram is:

Setpoint -> compare to measured process variable -> controller calculates output -> actuator changes the process -> sensor measures the result -> feedback returns to the controller.

## What P, I, and D Mean in HVAC Terms

### Proportional Action

Proportional action responds to present error. If the loop is far from setpoint, the controller pushes harder. If the loop is close, the controller backs off.

In HVAC terms, proportional action is what makes a valve open more when supply air is too warm or makes a fan slow down when duct pressure rises above target.

### Integral Action

Integral action responds to accumulated error over time. It exists to remove offset that proportional action alone may leave behind.

In HVAC terms, integral action helps a loop stop hovering slightly above or below setpoint once the initial response settles.

### Derivative Action

Derivative action responds to the rate of change of the process. It can damp a loop that moves quickly or tends to overshoot, but it is sensitive to noisy sensors and poor signal quality.

In HVAC terms, derivative may help a fast pressure loop, but it is often avoided in slower thermal loops unless there is a clear reason to use it.

> Commissioning Note: In BAS work, derivative is usually the last term considered, not the first. Many field problems come from bad sensors, poor authority, or reset interaction rather than from “not enough D.”

## Typical BAS-Controlled Processes

- Space, supply, return, or leaving air temperature
- Coil discharge temperature
- Duct static pressure
- Chilled or condenser water differential pressure
- Airflow or water flow trim loops
- Humidity control in slower-response environments

## Practical Response View

When reading a trend, think in plain field terms:

- Did the PV move toward setpoint in the expected direction
- Did it overshoot excessively
- Did it settle without continuous oscillation
- Did the CV move smoothly or chatter
- Did another reset or limit change at the same time

> Common Pitfall: A loop can appear "aggressive" because the process itself is poorly commissioned. If flow is unstable or the sensor is wrong, changing tuning alone may only hide the real issue.

<!-- widget:pid-response-chart -->
