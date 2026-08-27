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
2. Let it finish. It reports a curve, not a number.
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

## Runs

| Date | Commit | Device | Tier | Power | Dev tools | Browser | Notes |
|---|---|---|---|---|---|---|---|
| _(pending)_ | `b1aacbe` | Realme 9 Speed Edition | low | | off | | Phase 0 baseline — everything in `worldConfig` off |
| _(pending)_ | `b1aacbe` | iPhone 16 Pro | high | | off | | Phase 0 baseline — everything in `worldConfig` off |

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
