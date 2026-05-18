# 0.6 Process Model Library

The `Process Model` selector is one of the most important controls in the simulator because it changes the plant being controlled, not just the numbers on the screen. When the model changes, the simulator changes the engineering units, operating range, control direction, process gain, lag structure, deadtime, and starting controller defaults.

![Process model family map showing generic, flow, pressure, level, temperature, and humidity model groups.](assets/help/process-model-map.svg)

This section explains what each model represents, what makes it different technically, and what operators should watch for on the trends.

## What Changes When You Change Models

Each model includes a different combination of the following process properties:

| Process property | What it means | Why it changes the response |
| --- | --- | --- |
| `Units and span` | The engineering range shown on SP and PV | A small movement in `in. w.c.` is not interpreted the same way as a small movement in `deg F` or `%RH` |
| `Controller direction` | Whether increasing CO raises PV or lowers PV | A cooling loop and a heating loop should not react the same way to a higher output |
| `Process gain` | How strongly the plant reacts to output movement | Higher gain means the same output change creates a larger PV change |
| `Lag` | How quickly the process state moves toward a new value | More lag means a slower response and longer settling |
| `Second lag` | A second layer of stored energy or transport delay | Creates a more sluggish and damped-looking response than a simple first-order process |
| `Deadtime` | Pure delay before output change affects PV | Makes the controller wait longer before it sees whether its action helped |
| `Response type` | Whether the process is self-regulating or integrating | Integrating processes keep drifting until the net input is balanced |
| `Default limits and bias` | The normal operating output range and starting point | Some processes are intended to operate around a midrange output rather than near zero |

## How The Simulator Makes A Model Respond

The simulator uses a shared step-based engine, but the selected model changes the process-side math.

### Self-Regulating Models

Most models in the library are self-regulating. In these models, the PV tends toward a new equilibrium after a change in output or disturbance.

This means:

- the process moves toward a new steady value
- the PV eventually settles if the controller and process are stable
- output movement changes the destination and the speed of travel, but not an endless ramp

### Integrating Models

The `Integrating Liquid Level` model is intentionally different. It behaves more like a storage process where imbalance changes the rate of PV movement instead of only changing the final equilibrium.

This means:

- the PV can keep drifting while a net inflow or outflow imbalance exists
- the controller must remove the imbalance, not only reduce a position error
- sustained disturbance has a stronger long-term effect than it does in a self-regulating process

### Single-Lag And Double-Lag Behavior

Some models use one main lag and others use two.

- `Single lag` models feel simpler and more direct
- `Double lag` models feel softer, slower, and more delayed in their visible response

Double-lag models are useful for teaching why a controller may look calm at first and then continue drifting or overshooting later because more than one stored-energy or transport effect is involved.

<!-- widget:process-type-comparison -->

### Deadtime

Deadtime is the period between an output change and the first visible PV response.

In the simulator, output movement passes through a delay queue before it affects the plant. This matters because:

- aggressive tuning during deadtime can make the controller "push blind"
- operators may see CO move well before PV reacts
- overshoot often becomes worse when deadtime is large relative to process lag

### Direct And Reverse Response

The model also decides whether the process is `direct` or `reverse`.

- `Direct` process: increasing CO increases PV
- `Reverse` process: increasing CO decreases PV

Examples:

- heating is usually direct
- cooling is usually reverse

The process model therefore changes the sign of the control response, not just the label on the screen.

![Comparison of self-regulating and integrating response to the same output step.](assets/help/self-regulating-vs-integrating.svg)

> Common Pitfall: A loop with the wrong process direction will often look like a severe tuning problem even though the real issue is that the controller is pushing in the wrong direction.

## Model Families

The model library is grouped so users can compare similar plant types before they compare specific loops.

| Family | Typical behavior | Why operators should care |
| --- | --- | --- |
| `Generic` | Clean teaching models that isolate lag and deadtime effects | Best for explaining control concepts without BAS-specific distractions |
| `Flow` | Fast response and low storage | Good for showing output chatter, noise sensitivity, and quick correction |
| `Pressure` | Fast to medium-fast response with strong sensitivity to disturbance | Good for showing aggressive control, oscillation risk, and actuator issues |
| `Level` | Slower storage-driven behavior, including integrating response | Good for teaching offset, accumulation, and long-term drift |
| `Temperature` | Slower thermal behavior with stored energy and transport lag | Good for teaching overshoot, filtering, and patience in tuning |
| `Humidity` | Very slow response with long lags | Good for teaching why fast tuning changes can be misleading |
| `Motion` | Fast mechanical response with load effects, backlash, or speed sag | Good for teaching quick correction without confusing it with thermal or pressure behavior |
| `Chemistry` | Nonlinear-feeling behavior near target with long settling | Good for teaching conservative tuning and careful interpretation of gain |
| `Reactor` | Stored-energy thermal behavior with strong disturbance risk | Good for teaching why saturation, overshoot, and slow recovery matter |
| `Separation` | Deadtime-dominant composition response | Good for teaching patience, model-based tuning, and why blind aggressive action fails |

## Detailed Model Reference

### Generic Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Generic Deadtime + Single Lag` | A simple self-regulating plant with one main time constant | One dominant lag and moderate deadtime make the cause-and-effect relationship easy to see | Best for basic SP step training, `P` versus `PI`, and deadtime awareness |
| `Generic Deadtime + Double Lag` | A self-regulating plant with two stored-response stages | The second lag makes the response feel softer and more sluggish than the single-lag model | Best for showing why slow settling does not always mean low gain alone and why derivative or filtering choices matter |

### Flow Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Liquid Flow` | A fast water-flow style loop | Low deadtime and high sensitivity make PV react quickly to output changes | Good for teaching sharp correction, output chatter, and valve-characteristic effects |
| `Gas / Air Flow` | A fast airflow loop such as duct or terminal flow | Fast movement with short lag makes setpoint changes show up quickly, but poor tuning can look jumpy | Good for teaching proportional sensitivity, filter tradeoffs, and damper nonlinearity effects |

### Pressure Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Liquid Pressure` | A liquid-pressure loop in a piping system | Faster than thermal loops but less immediate than pure flow loops | Good for comparing disturbance rejection and moderate derivative use |
| `Gas / Duct Pressure` | A duct or gas-pressure loop | Fast, disturbance-sensitive, and more likely to show CO chatter when PV is noisy | Good for teaching PV filtering and why pressure loops can look aggressive |
| `Pump Differential Pressure` | A pump-loop remote differential pressure control problem | Moderate lag and some minimum-output behavior make it feel less immediate than fan pressure | Good for teaching PI response, saturation, and distribution-loop stability |
| `Fan Static Pressure` | A supply-fan static pressure loop | Quick PV movement makes hunting easy to see when gain is too high or the signal is noisy | Good for teaching fast-loop tuning, damper interaction, and noise sensitivity |

### Level Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Integrating Liquid Level` | A tank or basin where imbalance changes the stored level | Integrating response means PV can continue drifting until the net flow balance is corrected | Good for teaching why integral action and disturbance balance matter more than fast output movement |
| `Self-Regulating Tank Level` | A level loop with some natural balancing | Slower than flow and pressure, but less drift-prone than a true integrating process | Good for comparing self-regulating versus integrating behavior with similar operator actions |

### Temperature Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Heating Coil Temperature` | A heating valve or coil discharge-temperature loop | Increasing output raises PV, and the thermal lags make overshoot persist after the output moves | Good for teaching direct-acting thermal control and the value of softened SP changes |
| `Cooling Coil Temperature` | A cooling valve loop | Increasing output lowers PV, so the process is reverse-acting and direction matters immediately | Good for teaching reverse response, coil lag, and why wrong direction causes runaway behavior |
| `Heat-Exchanger Outlet Temperature` | A slower outlet-temperature control problem | Thermal storage and transport effects make it slower and smoother than fast flow loops | Good for teaching patient tuning and derivative as damping rather than speed |
| `Mixed-Air / Discharge-Air Temperature` | An airside discharge-temperature loop | Dual lag and moderate deadtime make it responsive enough for clear training without being extremely fast | Good for showing interaction between setpoint changes, disturbance load, and output saturation |

### Humidity Model

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Humidity / Moisture` | A moisture-control loop with long process delay | Very slow response and long lags mean that short observation windows can be misleading | Good for teaching patience, long-trend review, and caution against over-tuning from short-term movement |

### Motion Models

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Motor Speed` | A VFD or motor-speed loop responding to load changes | Very short deadtime and quick lag make corrections appear almost immediately | Good for teaching fast-loop tuning, disturbance rejection, and why too much derivative can amplify measurement noise |
| `Conveyor Speed` | A transport speed loop with load sag and mechanical slack | Moderate deadtime plus backlash makes the output-to-PV relationship less clean than a pure motor-speed loop | Good for teaching backlash, load upset recovery, and why a clean trend may still need mechanical context |

### Chemistry Model

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Neutralization pH` | A neutralization process where apparent gain changes near target | Small output changes near the operating point can look more powerful than they do far away from target | Good for teaching conservative gain, long settling review, and why pH loops are easy to over-correct |

### Reactor Model

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Reactor Temperature` | A stored-energy reactor temperature loop | Long lag and deadtime make overshoot and saturation risk more important than raw speed | Good for teaching slow thermal tuning, disturbance sensitivity, and why stable recovery matters more than a quick first move |

### Separation Model

| Model | What it represents | What is different about it | System considerations |
| --- | --- | --- | --- |
| `Distillation Column Section` | A composition or purity loop inside a separation process | Long transport delay and sluggish stored-energy behavior make it deadtime-dominant | Good for teaching model-based tuning, cautious integral action, and why operators should not keep pushing output before the PV has responded |

## Model-By-Model Comparison Matrix

Use this table when comparing model dropdown choices before a run.

| Model | Family | Response speed | Direction | Main behavior to watch |
| --- | --- | --- | --- | --- |
| `Generic Deadtime + Single Lag` | Generic | Medium | Direct | One clear lag plus deadtime; easiest model for seeing cause and effect |
| `Generic Deadtime + Double Lag` | Generic | Medium-slow | Direct | Softer response with more stored movement after the first correction |
| `Liquid Flow` | Flow | Fast | Direct | Quick PV movement, high sensitivity, and output chatter if tuning is aggressive |
| `Gas / Air Flow` | Flow | Fast | Direct | Rapid airflow response with visible damper or measurement effects |
| `Liquid Pressure` | Pressure | Fast-medium | Direct | Quicker than temperature, less jumpy than pure flow, useful for disturbance recovery |
| `Gas / Duct Pressure` | Pressure | Fast | Direct | Duct-pressure style behavior where noise and chatter show up quickly |
| `Pump Differential Pressure` | Pressure | Medium | Direct | Remote DP behavior with minimum-output limits and moderate lag |
| `Fan Static Pressure` | Pressure | Fast | Direct | Supply-fan pressure hunting is easy to see when gain is too high |
| `Integrating Liquid Level` | Level | Slow | Direct | PV can keep drifting until inflow and outflow balance |
| `Self-Regulating Tank Level` | Level | Slow-medium | Direct | Level has natural balancing, so it settles more easily than the integrating tank |
| `Heating Coil Temperature` | Temperature | Slow | Direct | Thermal storage makes overshoot persist after output changes |
| `Cooling Coil Temperature` | Temperature | Slow | Reverse | Increasing output lowers PV; wrong direction looks like runaway |
| `Heat-Exchanger Outlet Temperature` | Temperature | Slow-medium | Direct | Smooth thermal behavior where derivative acts more like damping than speed |
| `Mixed-Air / Discharge-Air Temperature` | Temperature | Medium | Direct | Airside temperature with dual lag, disturbance load, and saturation visibility |
| `Humidity / Moisture` | Humidity | Very slow | Direct | Long lags make short-term tuning judgments misleading |
| `Motor Speed` | Motion | Very fast | Direct | Load disturbances show quickly; excessive gain or derivative can make the loop nervous |
| `Conveyor Speed` | Motion | Fast-medium | Direct | Backlash and speed sag can mimic poor tuning even when PID math is reasonable |
| `Neutralization pH` | Chemistry | Slow-medium | Direct | Apparent gain near target requires conservative tuning and careful trend review |
| `Reactor Temperature` | Reactor | Slow | Direct | Stored energy, saturation, and disturbance recovery dominate the training value |
| `Distillation Column Section` | Separation | Very slow | Direct | Long deadtime teaches why model-based tuning and patience matter |

## What Operators Should Notice On The Trends

When comparing models, the first goal is not to memorize every parameter. The first goal is to recognize response patterns.

| If you see this trend behavior | It usually means | Models where it is especially visible |
| --- | --- | --- |
| CO moves well before PV reacts | Deadtime is important | Generic models, temperature models, humidity model |
| PV moves quickly and CO chatters | Fast process or noisy measurement | Flow and pressure models |
| PV continues drifting after the first correction | Integrating or highly stored process behavior | Integrating liquid level, slow thermal models |
| Same CO change creates very different PV response | Different process gain or characteristic behavior | Flow, pressure, and valve-characteristic exercises |
| Wrong-direction runaway | Process direction does not match control action | Cooling coil temperature if interpreted like a direct loop |
| Output moves repeatedly before the PV catches up | Deadtime-dominant process | Distillation column, humidity, reactor, and some temperature models |
| PV responds almost immediately but looks nervous | Fast process or mechanical/noise effect | Motor speed, liquid flow, fan static pressure, gas / duct pressure |
| Response looks reasonable at first, then continues past target | Stored energy or second lag | Double-lag generic, heat exchanger, reactor temperature, distillation column |

## How To Choose The Right Model For Training

Use these shortcuts when planning a lesson:

- Choose `Generic Deadtime + Single Lag` for first-time PID explanation
- Choose `Fan Static Pressure` or `Gas / Duct Pressure` for fast-loop and noise training
- Choose `Cooling Coil Temperature` for reverse-acting instruction
- Choose `Integrating Liquid Level` for storage-process and integral-action instruction
- Choose `Humidity / Moisture` for slow-loop patience and long-trend review
- Choose `Motor Speed` for very fast response and disturbance-rejection practice
- Choose `Conveyor Speed` for backlash and load-sag discussion
- Choose `Neutralization pH` for nonlinear-feeling process gain and conservative tuning
- Choose `Reactor Temperature` for stored-energy thermal risk and saturation discussion
- Choose `Distillation Column Section` for deadtime-dominant model-based tuning practice

## Final Training Guidance

The right model is the one that matches the control problem being explained. If the lesson is about noise sensitivity, use a fast pressure or flow model. If the lesson is about overshoot and stored energy, use a temperature model. If the lesson is about accumulation and drift, use an integrating level model.

> Field Tip: Before discussing tuning, first ask the trainee what kind of plant they think they are looking at: fast or slow, direct or reverse, self-regulating or integrating. That single habit improves trend interpretation dramatically.
