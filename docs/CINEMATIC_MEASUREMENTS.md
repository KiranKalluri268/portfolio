# Cinematic measurements

Every frame-time reading taken of the journey, with the conditions it was taken
under. `CINEMATIC_WORLD_PLAN.md` gates each phase on this file: a phase does not
merge if it makes the curve measurably worse on the Realme.

**Append, never overwrite.** A superseded reading is still evidence — most of
what is known about this scene came from noticing that two readings disagreed.

---

## How to take a reading

1. Open `/cinematic?curve=1` on the device. It holds the tier still and walks the
   camera through the whole journey a pose at a time — every 1.5 viewport units
   up to `approachEnd` (27.0), discarding 10 settle frames and sampling 30 per
   pose. It drives the camera itself, so **do not scroll while it runs**; it says
   so on screen.
2. Let it finish. It reports a curve, not a number, and it now reports two
   columns rather than one:
   - **frame** — the gap between animation frames. What the visitor experiences,
     and capped from below by the display's refresh rate.
   - **gpu** — how long the GPU actually spent, from
     `EXT_disjoint_timer_query_webgl2`. What the frame *cost*, unrelated to when
     it was presented. A dash means this device has no such extension, which is
     normal on iOS.

   **Read the gpu column when it is there.** Where it is not, the sweep renders
   at a fixed multiple of the tier's resolution so the frame column sits clear of
   the refresh floor — the header says which scale was used, and two runs being
   compared must have used the same one.

   If the report prints a `NOTE:` about quantisation, the frame column is
   describing the screen rather than the scene. That is the failure this whole
   file was rewritten around.
3. Record every column in the table below. The ones that look like bureaucracy
   are the ones that have already caused wrong conclusions:
   - **Tier**, because a downgrade partway through makes the second half of the
     curve a measurement of a different scene. The curve runner locks the tier
     for exactly this reason.
   - **Power**, because on the laptop, power state moved readings more than the
     tier did. A reading on battery is not comparable to one on mains.
   - **Dev tools**, because the FPS meter was found to be stalling the
     compositor about once a second and causing much of what was being
     investigated. **Take readings with the meter off.**
4. Add a row to *Runs*, and the per-pose numbers to a subsection under *Curves*.

## Reference devices

| Name | Why it is here | Known behaviour |
|---|---|---|
| Realme 9 Speed Edition | The floor. `low` is the only rung it has | low 50–75fps, medium 15–20, high 5–10. 13.9ms in the tunnel, 152.7ms in the fall |
| iPhone 16 Pro | The ceiling that real visitors have | Runs `high` at 40–60fps comfortably |

A headless Chromium reading is **not** a substitute for either. The e2e suite
runs SwiftShader, which raymarches this scene at roughly 5.6 seconds a frame —
useful for asserting that DOM exists, worthless as a cost measurement.

---

## The first sweep measured the display, not the scene

Kept in full, because it is the evidence for why the runner changed and because
the same mistake is easy to make again.

Three sweeps were taken on 2026-08-27 against commit `b1aacbe`. Every reading on
two of the three devices is an integer number of the display's refresh
intervals — the laptop and the Realme both run 144Hz screens, one interval being
**6.944ms**:

| Reading | Intervals |
|---|---|
| 7.0ms | 1 |
| 13.9ms | 2 (13.89) |
| 20.9ms | 3 (20.83) |
| 27.5ms | 4 (27.78) |

The Realme's `17.4ms` is the clinching detail. No frame took 17.4ms. `median()`
averages the two middle values of an even-length sample set, and `SAMPLE_FRAMES`
is 30, so a pose alternating between two and three intervals reports
`(13.89 + 20.83) / 2 = 17.36`.

This happens because the runner measured the gap between `requestAnimationFrame`
callbacks, which cannot be shorter than the refresh interval however cheap the
frame is. Where a device draws faster than its screen, the curve reports the
screen. It is a staircase, and a change smaller than one step is invisible in it
— which makes "no phase may make the curve worse" unenforceable, since the world
could add 5ms and nothing would move until it crossed a 7ms threshold.

It also explains three sweeps suggesting `BENCHMARK_APPROACH_PROGRESS` of
**0.57, 0.04 and 0.14**. That is not three devices disagreeing about where the
fall is expensive; it is `report()` taking the maximum of a flat staircase, so
the answer is decided by which pose happened to land a step higher. The shipped
`0.30` came from the same instrument. It is left alone for now rather than
replaced with another number from the same source.

The iPhone is the exception and is probably the only honest column of the three:
ProMotion varies the refresh rate to match the renderer, so its readings sit on
no grid.

**What changed as a result.** The runner now asks the GPU how long the frame
actually took, through `EXT_disjoint_timer_query_webgl2`, and reports it as its
own column. Where that extension does not exist — iOS Safari, some Chrome
builds — a sweep instead renders at a fixed multiple of the tier's resolution, so
every pose sits clear of the refresh floor and differences between them are
visible again. And the report now detects the quantisation itself and says so,
rather than leaving it to be noticed.

### The readings

Laptop, **on battery**, tier high — so soft twice over, since power state has
moved readings here more than the tier has.

| Units | Phase | Frame | Intervals |
|---|---|---|---|
| 0–3 | crossing | 20.9ms | 3 |
| 4.5 | crossing | 13.9ms | 2 |
| 6–10.5 | blackout/tunnel | 7.0ms | 1 |
| 12 | arrival | 27.5ms | 4 |
| 13.5–27 | fall | 20.5–21.1ms | 3 |

iPhone 16 Pro, tier high:

| Units | Phase | Frame |
|---|---|---|
| 0 | crossing | 23.0ms |
| 1.5–3 | crossing | 22.0–21.0ms |
| 4.5–10.5 | crossing/tunnel | 17.0ms |
| 12–19.5 | arrival/fall | 22.0ms |
| 21–27 | fall | 21.5 → 17.0ms |

Realme 9 Speed Edition, tier low:

| Units | Phase | Frame | Intervals |
|---|---|---|---|
| 0 | crossing | 20.8ms | 3 |
| 1.5–10.5 | crossing/tunnel | 13.9–14.0ms | 2 |
| 12 | arrival | 20.7ms | 3 |
| 13.5–27 | fall | 13.9–20.8ms | 2–3 |

### What they do say, despite everything

Two things survive the instrument problem, because they are about *shape* rather
than absolute cost:

- **Nothing is struggling at the tier it actually runs.** The Realme sits at
  48–72fps across the whole journey at `low`, worst pose 20.8ms. The 152.7ms
  recorded elsewhere in these docs was that phone at `high`, which is not a rung
  it has.
- **The fall may not be the expensive part after all.** The laptop's peak is the
  **arrival at 12 units**, and the iPhone's is the **crossing at 0**. On the
  iPhone the fall gets steadily *cheaper* as it goes, 22ms down to 17ms, which
  fits the note in `curveRunner.js` about rays terminating early and cheap once
  the shadow fills the frame. Worth re-checking against GPU time before anything
  is concluded from it.

---

## Runs

| Date | Commit | Device | Tier | Power | Dev tools | Notes |
|---|---|---|---|---|---|---|
| 2026-08-27 | `b1aacbe` | Laptop | high | battery | off | **Superseded.** Vsync-quantised, 144Hz. Not a baseline |
| 2026-08-27 | `b1aacbe` | iPhone 16 Pro | high | | off | **Superseded.** Not quantised, but taken without GPU timing |
| 2026-08-27 | `b1aacbe` | Realme 9 Speed Edition | low | | off | **Superseded.** Vsync-quantised, 144Hz. Not a baseline |
| _(pending)_ | | Realme 9 Speed Edition | low | | off | Phase 0 baseline — everything in `worldConfig` off |
| _(pending)_ | | iPhone 16 Pro | high | | off | Phase 0 baseline — everything in `worldConfig` off |

The first three are kept as evidence rather than as measurements; the section
above says why. They are not what any phase gate compares against.

## Curves

### Phase 0 baseline

**Not yet taken.** Both rows above are placeholders, and every phase gate in
`CINEMATIC_WORLD_PLAN.md` compares against them — so phase 1 cannot honestly be
called done until they exist. They need the physical devices; they cannot be
produced from a development machine.

Paste the per-pose output here when they are taken, one table per device:

| Scroll (vu) | Phase | Frame time (ms) |
|---|---|---|
| 0.0 | crossing | |
| … | | |
| 27.0 | approach | |

---

## Earlier readings, before this file existed

Kept because the phase gates lean on them and they are otherwise scattered
through `CINEMATIC_DECISION.md`.

| Device | Tier | Where | Frame time | Source |
|---|---|---|---|---|
| Realme 9 Speed Edition | high | tunnel | 13.9ms | §5, the benchmark-workload fix |
| Realme 9 Speed Edition | high | fall | 152.7ms | §5 — same device, same tier, 11× the cost across one journey |
| Realme 9 Speed Edition | low | — | 50–75fps | §4, the three-rung measurement |
| Realme 9 Speed Edition | medium | — | 15–20fps | §4 |
| Realme 9 Speed Edition | high | — | 5–10fps | §4 |
| iPhone 16 Pro | high | — | 40–60fps | §4 |

The cost sweep behind the benchmark's `0.30` parking position is written up in
`CINEMATIC_DECISION.md` §5 rather than repeated here: frame time is flat across
the fall, so the benchmark stands in the middle of a plateau rather than on a
peak.
