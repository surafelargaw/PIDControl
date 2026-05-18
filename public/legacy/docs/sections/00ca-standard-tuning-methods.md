# 0.35 Standard Tuning Methods

This help topic is the operator-training guide for the `Method-Based Tuning Study` card in the `Settings` tab. It explains the PID tuning methods available in the app, why each method exists, what assumptions it makes, how the simulator runs it, and what the operator should look for after the suggested tuning is applied.

The content is based on the MTU reference document [`Standard PID Tuning Methods`](https://pages.mtu.edu/~tbco/cm416/tuning_methods.pdf), but this section is written for training and trend interpretation rather than for academic note-taking alone.

## Method Names In The App

The tuning-method dropdown includes these study modes:

- `Cohen-Coon Open-Loop`
- `Ziegler-Nichols Ultimate Gain`
- `Tyreus-Luyben Ultimate Gain`
- `Relay Autotune`
- `IMC / Lambda`
- `Bump Test`

These names match the help section on purpose so operators can move back and forth between the simulator and the help page without translation.

## Why There Are Multiple Tuning Methods

There is no single PID tuning method that is best for every process.

Different methods exist because real processes differ in:

- deadtime
- lag
- process gain
- noise sensitivity
- actuator quality
- comfort or safety consequences of overshoot
- how much testing the plant can tolerate

Some methods are more aggressive and give faster response. Others are more conservative and prioritize stability. Some methods need an open-loop test. Others need a closed-loop oscillation test. Some methods are easier to explain in a classroom than to perform on a live building system.

> Design Consideration: The app includes several tuning methods so operators can learn that tuning is a structured engineering decision, not only a trial-and-error adjustment of `Kp`, `Ti`, and `Td`.

## Quick Selection Guide

| Method | Test style | Best for teaching | Typical character | Main caution |
| --- | --- | --- | --- | --- |
| `Cohen-Coon Open-Loop` | Open-loop step test | Process gain, deadtime, and lag concepts | Often assertive when deadtime matters | Requires a clear step response and a usable first-order-plus-deadtime fit |
| `Ziegler-Nichols Ultimate Gain` | Closed-loop P-only ultimate-gain test | Ultimate gain and oscillation-based tuning | Usually aggressive and fast | Can overshoot and work the actuator hard |
| `Tyreus-Luyben Ultimate Gain` | Closed-loop P-only ultimate-gain test | Conservative alternative to ZN | Usually calmer and slower | No `P`-only recommendation in the source rules |
| `Relay Autotune` | Closed-loop relay limit cycle | Autotune concepts and `Ku/Pu` estimation | Depends on chosen rule family | Relay amplitude must be chosen sensibly |
| `IMC / Lambda` | Model-based closed-loop target | Robustness and deliberate response speed | Usually calm and adjustable | Requires a usable process fit and sensible Lambda factor |
| `Bump Test` | Open-loop output bump | Process identification without applying tuning | Diagnostic rather than automatic | Does not directly write tuning values |

## Core Terms Operators Should Know

| Term | Plain-language meaning | Why it matters |
| --- | --- | --- |
| `Open-loop test` | The output is stepped directly and the controller is not actively correcting error | Useful for measuring the process itself |
| `Closed-loop test` | The controller is still part of the behavior being measured | Useful for ultimate-gain and oscillation-based methods |
| `Ultimate gain Ku` | The proportional gain that causes sustained oscillation | Used by Ziegler-Nichols and Tyreus-Luyben |
| `Ultimate period Pu` | The oscillation period at `Ku` | Used to derive `Ti` and `Td` |
| `Relay limit cycle` | Repeating oscillation created by switching output high and low | Used to estimate `Ku` without manually searching for it |
| `Process gain K` | How much PV changes for a given output change | Stronger gain usually means stronger loop reaction |
| `tau` | Main process time constant | Describes how quickly the process responds |
| `tau_del` | Apparent deadtime | Describes the pure delay before PV starts moving |
| `r = tau_del / tau` | Deadtime severity relative to process lag | Used directly by Cohen-Coon |
| `Step` | Output bump size used during open-loop studies | Too small gives a weak signal; too large may hit limits or nonlinear behavior |
| `Relay Amplitude h` | Half of the relay output swing around the baseline | Used by relay autotune to create a measurable limit cycle |
| `Lambda Factor` | Multiplier used to choose the IMC/Lambda closed-loop target speed | Higher is calmer and more robust; lower is faster and more aggressive |

![Conceptual comparison of tuning philosophies from calmer to more aggressive.](assets/help/method-comparison.svg)

## What The Simulator Does Before Running A Tuning Study

The tuning-study card runs the selected method in a clean sandbox copy of the current process model.

The sandbox disables:

- measurement noise
- process disturbances
- valve deadband
- valve stiction
- positioner overshoot
- nonlinear valve characteristic

That matters because most textbook tuning methods assume a clean test. If noisy sensing or mechanical defects are left in the study, the suggested tuning constants can describe the bad test conditions more than the actual plant dynamics.

The study does not change the live loop until the user presses `Apply Suggested Tuning`.

## How To Use The Tuning Card

1. Select a process model.
2. Open the `Settings` tab.
3. In `Method-Based Tuning Study`, choose a method.
4. Choose the target algorithm, such as `PI` or `PID`.
5. If using `Cohen-Coon`, select the open-loop step size.
6. If using `Bump Test`, select the output step size for the identification bump.
7. If using `Relay Autotune`, choose the relay half-amplitude `h` and the rule family to apply afterward.
8. If using `IMC / Lambda`, choose the Lambda factor.
9. Click `Run Tuning Study`.
10. Review the calculated summary.
11. Click `Apply Suggested Tuning`.
12. Watch the live trends and decide whether the result is fast, calm, aggressive, conservative, or actuator-intensive.

## Tuning Study Input Controls

The tuning-study card has three numeric study controls. They do not all apply to every method, but they stay visible so operators can compare methods quickly.

| Control | Used by | What it means | Practical effect |
| --- | --- | --- | --- |
| `Step` | `Cohen-Coon` and `Bump Test` | The open-loop output change, in output percent, used to make the PV respond | Larger steps are easier to measure, but excessive steps can hit limits or excite nonlinear behavior |
| `Relay Amplitude` | `Relay Autotune` | The relay half-amplitude `h`; output switches between `u0 + h` and `u0 - h` | Larger amplitude makes the oscillation clearer, but also makes the test more aggressive |
| `Lambda Factor` | `IMC / Lambda` | The multiplier used to choose the desired closed-loop response speed from the fitted process time constant | Higher Lambda factor gives slower, calmer, more robust tuning; lower values give faster but less forgiving tuning |

In the simulator, `IMC / Lambda` chooses a target speed using `lambda = max(deadtime, tau * Lambda Factor)`. That means the Lambda factor is not a gain by itself. It is a design preference for how cautious or assertive the model-based tuning should be.

## Cohen-Coon Open-Loop

### What It Is

`Cohen-Coon Open-Loop` is an open-loop step-response method. It is meant to identify a process using a step change and then calculate tuning from the fitted process behavior.

In practical terms, it answers the question:

"If I step the output and simply watch the process react, what does that tell me about gain, deadtime, and lag?"

### Why Operators Should Learn It

This method teaches the process-first view of tuning. Before talking about `P`, `I`, or `D`, the user learns to ask:

- How much does PV move for a given output step?
- How long does it wait before responding?
- How quickly does it move once it starts?

That is valuable because many tuning problems are really process-understanding problems.

### How The App Runs It

The simulator performs a clean output step and measures the PV response.

It then finds the response landmarks used in the source document:

- `t0`, the step-start time
- `t2`, the time when PV reaches `50%` of the total response
- `t3`, the time when PV reaches `63.2%` of the total response

From those points, the app calculates:

- `t1 = (t2 - ln(2)t3) / (1 - ln(2))`
- `tau = t3 - t1`
- `tau_del = t1 - t0`
- `K = B / A`
- `r = tau_del / tau`

Where:

- `A` is the output step size
- `B` is the total PV change

The app then applies the Cohen-Coon formulas to produce recommended standard-form values for `P`, `PI`, or `PID`.

![Cohen-Coon step test showing the output step and the response landmarks t0, t2, and t3.](assets/help/cohen-coon-step-test.svg)

### What Makes This Method Different

- It is the only method in the dropdown that starts from an open-loop process step instead of an oscillation test.
- It is strongly tied to process deadtime and lag estimation.
- It helps explain the plant before it explains the controller.

### When It Is Most Useful

- teaching first-order-plus-deadtime concepts
- deadtime-dominant loops
- model-based training
- comparing processes with very different lag and delay structure

### What Operators Should Watch After Applying It

After pressing `Apply Suggested Tuning`, watch for:

- how quickly CO reacts
- whether PV begins moving after a noticeable delay
- whether overshoot is acceptable
- whether the loop feels "too bold" for the process

If the loop reaches setpoint quickly but overshoots hard or makes the actuator move excessively, the method may be technically correct but operationally too aggressive for the comfort or equipment goal.

### Strengths

- builds intuition about process gain, deadtime, and lag
- works well as a teaching tool
- explains why deadtime changes tuning behavior

### Limitations

- requires a clear, usable step response
- assumes the process can be approximated reasonably as first-order plus deadtime
- can be less reliable if the response is very noisy, weak, integrating, or heavily nonlinear

### Training Questions

- Did the process wait before moving?
- Was the PV response large or small compared with the output step?
- Did the tuning feel balanced for this process, or too aggressive?
- Would this process be safe to step openly in a real building system?

## Ziegler-Nichols Ultimate Gain

### What It Is

`Ziegler-Nichols Ultimate Gain` is a closed-loop method based on finding the proportional gain that produces sustained oscillation.

It answers the question:

"How hard can proportional action push before the loop becomes continuously oscillatory?"

### Why Operators Should Learn It

This method teaches the meaning of:

- instability margin
- sustained cycling
- ultimate gain
- oscillation period

It is one of the clearest ways to explain why a loop can be "too aggressive" even when it moves toward setpoint quickly.

### How The App Runs It

The simulator runs a clean P-only closed-loop test and estimates:

- `Ku`, the gain at sustained oscillation
- `Pu`, the oscillation period

It then applies the Ziegler-Nichols rules:

- `P: Kc = Ku / 2`
- `PI: Kc = Ku / 2.2, Ti = Pu / 1.2`
- `PID: Kc = Ku / 1.7, Ti = Pu / 2, Td = Pu / 8`

If a selected model does not give a clean P-only ultimate-gain oscillation, the app can fall back to a relay-based `Ku/Pu` estimate so the operator can still complete the training workflow.

![Sustained oscillation concept used to estimate ultimate gain Ku and oscillation period Pu.](assets/help/ultimate-gain-oscillation.svg)

### What Makes This Method Different

- It is based on the edge of instability.
- It usually produces more assertive tuning than more conservative methods.
- It is excellent for teaching the relationship between speed and oscillation risk.

### When It Is Most Useful

- showing how aggressive tuning is created
- fast-loop training
- comparing `PI` and `PID` on the same oscillation basis
- demonstrating why "faster" is not always "better"

### What Operators Should Watch After Applying It

Look for:

- fast CO response
- reduced offset
- possible overshoot
- greater CO and valve travel
- a trend that may feel sharp or busy compared with a calmer rule set

### Strengths

- intuitive for teaching ultimate gain and oscillation
- widely known in control education
- easy to compare with more conservative alternatives

### Limitations

- often aggressive
- may create more overshoot than desired
- can increase actuator wear if taken literally in a real plant

### Training Questions

- Did the tuned loop recover fast at the cost of overshoot?
- Did CO movement become heavy or noisy?
- Would an operator be comfortable with this response in an occupied building?

## Tyreus-Luyben Ultimate Gain

### What It Is

`Tyreus-Luyben Ultimate Gain` uses the same basic `Ku/Pu` idea as Ziegler-Nichols, but the resulting tuning is more conservative.

It answers the question:

"If I start from the same ultimate-gain test, can I choose a calmer rule set?"

### Why Operators Should Learn It

This method teaches that the same measured plant behavior can lead to different tuning recommendations depending on the design goal.

That is a key operator lesson: tuning is not only measurement. It is also judgment.

### How The App Runs It

The app uses the same `Ku/Pu` style ultimate-gain study as above and applies:

- `PI: Kc = Ku / 3.2, Ti = 2.2Pu`
- `PID: Kc = Ku / 2.2, Ti = 2.2Pu, Td = Pu / 6.3`

The app restricts the target algorithm to `PI` or `PID` because the source rule set does not provide a `P`-only recommendation.

### What Makes This Method Different

- It starts from the same ultimate-gain concept as Ziegler-Nichols.
- It intentionally backs away from the more aggressive ZN recommendations.
- It often produces slower but calmer response.

### When It Is Most Useful

- operator training on conservative tuning philosophy
- comfort-sensitive loops
- actuator-wear discussions
- comparing "fastest recovery" versus "best operational behavior"

### What Operators Should Watch After Applying It

After applying Tyreus-Luyben, compare it with ZN on the same model:

- Is overshoot lower?
- Is the loop calmer?
- Does it take longer to settle?
- Is valve travel reduced?

### Strengths

- calmer than ZN in many cases
- useful for comfort and stability discussions
- good counterpoint to aggressive tuning methods

### Limitations

- can feel slow on some processes
- still depends on a valid `Ku/Pu` estimate
- not intended as a universal best answer

### Training Questions

- Was the calmer behavior worth the slower recovery?
- Which response would be better for comfort?
- Which response would be better for protecting a valve or VFD?

## IMC / Lambda

### What It Is

`IMC / Lambda` is a model-based tuning method. It starts from an estimated process gain, lag, and deadtime, then chooses a desired closed-loop response speed called `lambda`.

In plain language, Lambda tuning asks:

"How fast do I want the closed-loop response to be, given how much lag and deadtime this process has?"

### Why Operators Should Learn It

This method is useful for HVAC and data center loops because it makes robustness a visible design choice. Instead of tuning right at the edge of oscillation, the operator deliberately chooses a calmer or faster target.

That teaches a practical field lesson:

- aggressive tuning is not automatically better
- slow thermal or pressure loops often need margin
- deadtime should make the target response more conservative
- the right answer depends on reliability, comfort, alarms, and actuator wear

### How The App Runs It

The app first performs the same kind of clean open-loop identification used by the bump-test path. It estimates:

- process gain
- process lag `tau`
- apparent deadtime

It then calculates a target closed-loop speed using:

- `lambda = max(deadtime, tau * Lambda Factor)`

The `Lambda Factor` control is therefore a tuning philosophy control:

- higher Lambda factor = slower, calmer, more robust
- lower Lambda factor = faster, more aggressive, less forgiving

The app then calculates `Kp`, `Ti`, and `Td` from that target speed.

### What Operators Should Watch After Applying It

After applying IMC/Lambda tuning:

- compare overshoot with Ziegler-Nichols
- check whether settling is slower but calmer
- look at CO travel and valve travel
- try a disturbance and confirm recovery is acceptable

### Strengths

- usually more robust than aggressive ultimate-gain tuning
- good for training on engineering judgment
- useful when stability and reliability matter more than speed

### Limitations

- depends on a usable process fit
- very high Lambda factor can be unnecessarily sluggish
- very low Lambda factor can erase the robustness advantage

### Training Questions

- What Lambda factor made the loop feel calm but not lazy?
- Did higher Lambda reduce actuator travel?
- Would this tuning survive seasonal process changes better than Ziegler-Nichols?

## Relay Autotune

### What It Is

`Relay Autotune` is a closed-loop test that creates a limit cycle by switching the output between two levels around a baseline.

It answers the question:

"Can I estimate `Ku` and `Pu` from a controlled relay oscillation instead of manually hunting for the ultimate proportional gain?"

### Why Operators Should Learn It

This method is useful because it introduces the practical idea of autotune:

- create a controlled oscillation
- measure the oscillation
- translate that oscillation into suggested PID constants

It also teaches the operator that autotune is not magic. It still depends on:

- clean process behavior
- sensible relay amplitude
- correct interpretation of the resulting oscillation

### How The App Runs It

The app performs a relay test around the baseline output using a half-amplitude `h`.

The output toggles between:

- `u0 + h`
- `u0 - h`

The PV settles into a limit cycle. The app then measures:

- `a`, the PV oscillation amplitude
- `Pu`, the oscillation period

It calculates:

- `Ku = 4h / (pi a)`

It then applies either:

- `Ziegler-Nichols` rules
- or `Tyreus-Luyben` rules

depending on the selected `Relay Rule Family`.

![Relay autotune illustration showing output switching by h and the resulting PV oscillation amplitude a.](assets/help/relay-autotune.svg)

### What Makes This Method Different

- It estimates `Ku` through a relay oscillation instead of a manual gain search.
- It gives the operator direct control over the test intensity through `h`.
- It connects naturally to the idea of autotuning in modern controls.

### When It Is Most Useful

- autotune concept training
- demonstrating oscillation-based identification
- models where a clean P-only ultimate-gain search is less practical
- comparing rule families from the same relay test

### What Operators Should Watch After Applying It

After applying the result:

- compare overshoot and settling with the ZN or TL direct study
- compare CO travel
- check whether the relay-based estimate gave a similar or calmer result

### Strengths

- practical bridge to real-world autotune ideas
- avoids manual trial-and-error search for `Ku`
- useful fallback when a pure P-only study is awkward

### Limitations

- depends on a good choice of relay half-amplitude
- weak oscillation can make `a` hard to measure well
- too-large relay amplitude can become unnecessarily aggressive

### Training Questions

- Did a larger `h` make the oscillation easier to measure?
- Did it also make the test more aggressive than necessary?
- Did the relay-based tuning differ much from the direct ultimate-gain study?

## Bump Test

### What It Is

`Bump Test` is an open-loop process-identification study. It changes the output by the selected `Step` amount and watches the PV response without asking the closed-loop controller to correct the error.

It answers the question:

"If I make a controlled output bump, what can I learn about process gain, lag, and deadtime?"

### Why Operators Should Learn It

Bump testing is one of the clearest ways to separate process behavior from controller behavior. It helps operators see whether a poor loop response is caused by the tuning constants or by the process itself.

It is especially useful for learning:

- whether the output has enough authority
- whether the process responds in the expected direction
- how much deadtime exists before PV movement begins
- whether the process is too noisy or nonlinear for a clean test

### How The App Runs It

The app places the sandbox controller in manual mode, applies the selected output `Step`, and records the PV response. It reports the fitted process behavior, but unlike Cohen-Coon or IMC/Lambda, the bump test itself is mainly diagnostic.

The `Step` setting matters:

- too small can be buried in noise
- too large can hit output limits or reveal nonlinear behavior
- a useful step is large enough to measure but small enough to stay realistic

### What Operators Should Watch After Running It

After a bump test:

- check that PV moved in the expected direction
- compare the PV change to the output change
- look for deadtime before the PV starts moving
- decide whether the model is clean enough for method-based tuning

### Strengths

- simple and transparent
- teaches process gain, lag, and deadtime directly
- useful before choosing a formal tuning method

### Limitations

- does not directly apply a recommended tuning in the app
- requires a safe output bump size
- poor process data leads to poor interpretation

## Method Comparison For Operators

| If the training goal is... | Start with... | Then compare with... |
| --- | --- | --- |
| Learn what the process itself looks like | `Cohen-Coon Open-Loop` | `Ziegler-Nichols` |
| Learn how aggressive tuning is created | `Ziegler-Nichols Ultimate Gain` | `Tyreus-Luyben Ultimate Gain` |
| Learn a calmer alternative to aggressive tuning | `Tyreus-Luyben Ultimate Gain` | `Ziegler-Nichols Ultimate Gain` |
| Learn the idea behind autotune | `Relay Autotune` | `Ziegler-Nichols` or `Tyreus-Luyben` |
| Compare rule families on the same measured oscillation | `Relay Autotune` | switch `Relay Rule Family` between ZN and TL |
| Learn model-based robust tuning | `IMC / Lambda` | `Ziegler-Nichols` |
| Learn process identification before tuning | `Bump Test` | `Cohen-Coon` or `IMC / Lambda` |

## What "Apply Suggested Tuning" Actually Does

When the user presses `Apply Suggested Tuning`, the app:

- switches the controller to the recommended target algorithm
- sets the controller form to `Standard`
- writes the calculated `Kp`, `Ti`, and `Td` into the live controller
- leaves the operator in the simulator so the loop reaction can be watched immediately

This matters for training because the tuning study is not the final lesson. The final lesson is the live response after the suggested tuning is applied.

## What Operators Should Judge After Any Method

No matter which method was used, the operator should ask:

1. Did PV move in the correct direction?
2. How much overshoot occurred?
3. How long did settling take?
4. How much did CO move?
5. How much did the valve move?
6. Would this response be acceptable for comfort, stability, and equipment life?

That is how the web app becomes a one-stop training tool: the user learns the theory, runs the method, applies the result, and then judges the response like an operator instead of stopping at the formula.

## Recommended Training Sequence

1. Run `Cohen-Coon Open-Loop` on a generic model.
2. Apply the tuning and watch the live response.
3. Reset the run.
4. Run `Ziegler-Nichols Ultimate Gain`.
5. Apply the tuning and compare overshoot and CO travel.
6. Reset again.
7. Run `Tyreus-Luyben Ultimate Gain`.
8. Compare calmness, settling time, and actuator movement.
9. Finish with `Relay Autotune` and compare the two relay rule families.

> Field Tip: The best operator takeaway is not "this formula is always right." The best takeaway is "I understand what kind of tuning philosophy each method produces, and I know how to judge the loop response after applying it."
