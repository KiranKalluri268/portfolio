# The 3D cinematic portfolio — decisions

What was decided about turning this portfolio into a scroll-driven cinematic,
and why. `ARCHITECTURE.md` describes what the code is; this describes what it
is becoming and which options were rejected on the way.

**Status:** steps 1–3 of the build order are done. The scene lives in this repo
and runs at `/cinematic?cinematic=1`; nothing is enabled for visitors, and every
other route still gets `still`. Steps 4–6 are untouched.

---

## Where this came from

The original idea was one 3D portfolio. Performance work on the black hole was
hard enough at first that it split into two: `portfolio-3D` for the cinematic,
and this repo for the version that runs everywhere.

That split solved a real problem in the wrong dimension. It made the quality
tier a property of the **repository** rather than of the **device**, which costs
two things:

- Two portfolios to maintain, with the content in only one of them. Every
  project added and every résumé edit is a fork waiting to drift.
- The safe one is the one actually sent to people. So the most ambitious work is
  the work almost nobody is directed to.

The decision is to undo that split — not by abandoning the version that runs
everywhere, but by making it the bottom of one ladder instead of a separate
building.

---

## 1. One repo: this one

The scene moves here. `portfolio-3D` stays alive as the lab.

The direction of travel is *add a renderer to a site*, not *add a site to a
renderer*. What lives here is expensive and hard to replace: the content
pipeline in `src/lib/content` with its build-time relationship validation, the
statically generated project/skill/experience routes, the résumé→PDF path, ~300
tests, the deployment, the metadata. What lives in `portfolio-3D` is ~2,800
lines of scene code and its assets, which are portable.

A third combined repo was rejected: it strands both histories, and in particular
it strands `portfolio-3D/status.md`, which holds the planet's placement geometry,
the 45°/90° projection bug, and the known-good fallback commits. That file is the
most valuable thing across either repo.

`portfolio-3D` keeps earning its place as the tuning environment. Shader work
needs a tight visual loop, and Vite's dev server with `lil-gui` and `stats.js` is
a better place for it than a Next build. Tune there, port stable scenes across.

### Two things this commits us to

**The licence is now decided rather than open.** `portfolio-3D` is
GPL-3.0-or-later and not by choice — the accretion disk asset and parts of the
GLSL derive from Starless, which is GPL. If the scene is the site, the site is
GPL-3.0-or-later. The practical cost is low because this repo is already public,
and `LICENSE-CONTENT.md` already separates the writing and images from the code,
so the content stays reserved. It should be recorded deliberately, not
discovered later.

> **Done.** The code moved from MIT to GPL-3.0-or-later in its own commit,
> landed *before* the scene rather than after, so the history says why. Content
> is untouched and stays CC BY 4.0. See `THIRD_PARTY_NOTICES.md`.

**Three.js 0.148 is from 2022.** Port the scene as a plain module mounted by one
client component — not react-three-fiber. Two things break on the way across:
the `.glsl` import, which Vite handles natively and Next does not, and the ~17MB
of textures, which must load after first paint rather than sitting in the bundle.

> **Done, and both were worse and better than expected.** The textures are
> **9.7MB, not 17MB** — only three of the four files in `portfolio-3D/assets` are
> ever imported; `milkyway-generated.jpg` is the source plate, not a runtime
> asset. They now live in `public/textures/`.
>
> The `.glsl` import is the one that bit. Turbopack's `type: "raw"` rule looks
> like the answer and is not: it produces a module with no ES namespace, the
> import lands as `undefined`, and the shader compiles as the literal text
> `undefined`. That fails at the GPU driver rather than at the build — the page
> loads, the canvas appears, and only the console says why the frame is black.
> The shader is generated into a TypeScript string by `scripts/port-shader.mjs`
> instead, which needs no bundler config and behaves the same in Vitest.
>
> A third thing broke that this list did not predict: the site drives
> `lenis.raf()` from the GSAP ticker, so the scene's own `raf` call had to go or
> Lenis steps twice a frame and scroll runs at double speed.

---

## 2. Two switches, not one

Presentation and performance are separate decisions and must not be welded
together.

| Switch | Decided by | Values |
|---|---|---|
| **Presentation** | the visitor, with a sensible default | cinematic · plain |
| **Tier** | the device, via `ThreeDQualityManager` | still · low · medium · high |

If presentation is welded to tier, then a mid-range phone gets a structurally
different portfolio because of its graphics chip. Nobody chose that, and it is
not a decision hardware should be making. Split, a cheap phone can still have the
cinematic layout with a cheap background behind it, and someone on a fast machine
who only wants the résumé can have the plain one.

**Exactly two presentations.** Two is a design that can be maintained; one per
tier is five sites.

---

## 3. What may differ between presentations, and what may not

The cinematic is allowed to present the content differently. That is the point
of it. What is not allowed is content that exists in one presentation and not the
other.

- **The facts are one source.** `src/data/**` — projects, roles, skills, copy.
  This never forks.
- **The presentation may differ freely.** Where things appear, how they arrive,
  what they are wrapped in, what the camera is doing behind them.
- **Reachability is guaranteed.** Every project, role and skill must be reachable
  and readable in both presentations. *How* it is reached is a design decision;
  *whether* it can be is not.

The failure this guards against is narrow and specific: a fact reachable only in
one presentation is tier-locked, visible only to people whose hardware qualified.
That is the fork, rebuilt inside one repo where it is harder to see.

This pattern already exists here and works. `/projects` has two views — the DOM
grid and the WebGL card stack — drawing from the same JSON, with completely
different presentations, neither unmounted. This is the same shape one level up.

### The hard constraint

Content must exist as real, server-rendered HTML in both presentations. Not only
as textures inside a canvas.

Crawlers, screen readers, and anyone tabbing through the page all read the DOM. A
card painted into a WebGL texture is invisible to all three. This is already live
in this codebase rather than hypothetical: the `/projects` list view composes card
text into canvas textures.

This does not restrict the cinematic. The canvas is *how it is shown*, with the
real markup underneath.

---

## 4. The tier ladder

### Quality has two knobs, and they behave differently

**Resolution is continuous.** Render at any fraction and scale up. This is where a
raymarcher's cost actually lives — it is priced per pixel, so it scales with
screen area rather than with scene complexity, and it does not get cheap the way
ordinary 3D does when detail is cut. Being continuous, it fits every device
exactly.

**Features are discrete.** The disk, bloom, the star field, the planet, the
tunnel. On or off.

So: **the resolution slider delivers "best possible on this device"; tiers decide
"what this device gets at all."** Named tiers like very-low and very-high are not
needed and are actively costly — each one is a look that has to be tuned and
checked on real hardware, and two tiers close in cost cannot be told apart from
frame timing, so the manager oscillates between them visibly. A rung earns its
place by being roughly half the cost of the one above.

### The rungs

| Rung | What runs |
|---|---|
| **still** | `StarsBackground` + `BlackholeEffect`. No WebGL required. Also the `prefers-reduced-motion` and no-WebGL2 answer |
| **low → high** | The journey, with the resolution slider moving inside each |

`still` is what this repo ships today. It is already built, already tested, and
confirmed smooth on the oldest phone available. It is the floor of the same
ladder, not a consolation prize.

It is also the honest response to `prefers-reduced-motion`, which currently has
no good one. A scroll-driven camera flight is precisely what that setting asks
you not to do, and lowering the frame rate is not a reduction in motion.

Add a fourth rung only when a real device is badly served by all of these. Let
hardware ask for it.

### Measured so far

- `still` — smooth on the oldest phone tested.
- `low` — selected automatically and runs smoothly on that same phone.
- `medium` — **untested on that phone.** Could not be selected by hand until the
  preset switcher existed; it now does (`src/gui/presetSwitcher.js` in
  `portfolio-3D`). This is the next measurement, and it decides whether the middle
  of the ladder is real or whether there are effectively two rungs to tune
  properly instead of three badly.

Sustained load is what matters, not first-frame FPS: a mid-range Android on
battery, ten minutes in, after thermal throttling.

### The measurement changed the shape of this section

Held each tier still with the preset lock and read the counter:

| | Realme 9 Speed Edition | iPhone 16 Pro |
|---|---|---|
| low | 50–75 fps | — |
| medium | 15–20 fps | — |
| high | 5–10 fps | 40–60 fps, smooth |
| high, **inside the tunnel** | **75 fps** | — |

Two things follow that this section did not anticipate.

**The Realme falls off a cliff, not a slope.** The presets are pure resolution
ladders, so cost should track the square of the effective pixel ratio — about
1.6× from low to medium on that device. Observed is 3–5×. Low already sits at
that GPU's limit and everything above it goes off a bandwidth edge. For that
phone the ladder is not three rungs: low is the only one it has, and medium is
not a fallback but a tier it cannot reach.

**One tier cannot fit the whole journey.** 75fps in the tunnel against 5–10fps in
the fall — same tier, same device, a tenfold spread across one run. A tier that
survives the fall wastes the tunnel; one that suits the tunnel dies in the fall.
Benchmarking the worst moment, which is what the fixed benchmark now does, buys
correctness by giving up everything the cheap acts could have had.

The fix would be a per-act budget, and there is already a free place to change
it: the wormhole→tunnel handover is covered by a flash that burns to black, and
a resolution change under that flash cannot be seen. Deliberately not built —
it is a feature rather than a tuning change, and it belongs after step 4 rather
than tangled into it.

### The cost curve, measured

`?curve=1` locks a tier, walks the camera through all 19 poses of the journey and
reports frame time at each. Run on both phones. This replaces every earlier guess
about where the expensive frames are — there were two, and both were wrong, in
opposite directions.

**Read the caps first.** 17.0ms is 59fps and 13.9ms is 72fps: those are display
refresh limits, not scene cost. The iPhone runs at 60Hz here (Safari caps `rAF`
at 60 regardless of ProMotion), so **its `medium` and `low` sweeps are capped on
every row and contain no cost information at all**. The Realme's tunnel rows are
capped too. Usable data: iPhone `high`, and Realme at all three tiers.

| units | phase | iPhone `high` | Realme `low` | Realme `medium` | Realme `high` |
|---|---|---|---|---|---|
| 0–3 | crossing, far | 22–24ms | 20.8–20.9 | 55.5–55.6 | 125–132 |
| 4.5–6 | crossing, near | 17 *(cap)* | 13.9 *(cap)* | 13.9 *(cap)* | 13.9–20.8 |
| 7.5–10.5 | tunnel | 17 *(cap)* | 13.9 *(cap)* | 13.9 *(cap)* | 13.9 *(cap)* |
| 12–21 | arrival + fall | **22–23** | **24.3–27.7** | **62.4–62.5** | **145.8–152.8** |
| 24–27 | fall, very close | 21→17 | 20.8 | 48.5–55.6 | 138.8→111.1 |

**The fall is a plateau, not a peak.** Flat from the arrival at 12 units to about
21, then falling away as the black hole grows to fill the frame. Up close the
shadow terminates rays early; at distance almost nothing terminates and nearly
every ray spends its whole step budget on mildly-lensed background. The note on
`arriveDist` in `main.js` says the same thing from the other side — beyond ~43
units on `low`, the most-bent rays run out of steps entirely.

That plateau is why the sweep's own suggested constant came out as 0.36, 0.04,
0.25 and 0.57 on different runs: the argmax of a flat stretch is noise.
`BENCHMARK_APPROACH_PROGRESS` is now **0.30**, the middle of it, and anything from
about 0.05 to 0.55 measures the same thing.

**The tunnel/fall ratio is now a number rather than an impression:** 13.9ms
against 152.7ms on the Realme at `high`. **Eleven times.**

**The rungs, for that phone:** `low` 24–28ms in the fall, `medium` 62ms, `high`
153ms. Roughly 2.5× per rung rather than the ~1.6× predicted from pixel counts,
and it confirms `low` is the only tier it can use.

**One thing this method cannot see.** Every pose is measured standing still, and
the journey is normally scrolled. Scrolling costs more — Lenis, ScrollTrigger and
compositing all land on the same frame — which is why `high` on the iPhone reads
a comfortable 22–24ms here but was observed dropping tiers under an actual scroll.
The curve is a floor on cost, not the whole of it.

### The laptop, and why power state matters more than the tier

A 144Hz laptop on a Radeon 780M iGPU (the browser does not pick the discrete
3050), swept in three power states. Frame time in the fall:

| tier | plugged in | on battery | battery + saver |
|---|---|---|---|
| `low` | 7.0ms *(cap)* | 7.0ms *(cap)* | 7.0ms *(cap)* |
| `medium` | 7.0ms *(cap)* | 7.0–7.3ms *(cap)* | 7.0–7.2ms *(cap)* |
| `high` | **20.9ms** (48fps) | **27.8ms** (36fps) | **27.8ms** (36fps) |

**`low` and `medium` are the same tier here.** Both sit on the 143fps cap in every
power state, so the manager cannot tell them apart from frame timing — the exact
condition this document warns makes a rung worthless. `medium` is strictly better
on this machine: more resolution at identical measured cost. `low` earns nothing
on a desktop, and that is now measured rather than assumed.

**Unplugging costs 33%, and it straddles the heavy line.** `high` passes at 20.9ms
plugged and fails at 27.8ms on battery, against a 25ms bar. Same machine, same
scene, same session.

That is a real limit on the tier ceiling. The ceiling's stated reasoning is that
*nothing that happens later is evidence the device got faster* — and plugging in
is precisely that evidence. Unplug mid-journey, `high` fails, the ceiling pins the
session to `medium`, and plugging back in does not release it.

**Accepted deliberately rather than fixed.** Plugging in mid-journey is rare;
picking a tier by hand already clears the ceiling; and the churn the ceiling
prevents — climb, fail, drop, climb again, every thirty seconds — is a worse
experience than the recovery it blocks. The obvious fix, listening for the
Battery Status API, works on this laptop and on neither phone, which makes it a
desktop-only patch for a problem the phones share.

**Clocks ramp during the first seconds of a sweep.** On battery, `high` reads
21.2 → 24.2 → 27.7ms across units 0 / 1.5 / 3 and then drops to 14.0. That is not
a cost gradient, it is the GPU spinning up. Worth remembering because warmup runs
in exactly that cold window.

---

## 5. Choosing the tier

### The benchmark measures the wrong workload

> **Half right, and the wrong half was load-bearing.** The claim below — that the
> opening is the cheapest thing in the journey — is false, and it was measured
> false with `?curve=1` on two phones. On a Realme 9 Speed Edition at `high` the
> opening costs **132ms against the fall's 153ms**: 87% of peak, and the second
> most expensive part of the whole journey. Benchmarking the fall is still
> correct, because the fall genuinely is the peak — but the gap being closed is
> a sixth, not the chasm this section describes. See *The cost curve, measured*
> below.

`ThreeDQualityManager` judges the device from frame times during warmup. At the
loading screen, what is rendering is the **opening** of the journey — the wormhole
far off and small on screen. The expensive part is the **fall**: the raymarcher up
close, the disk, the lensing, the photon ring, minutes later.

So the tier calculated at load is measured on the cheapest frames in the whole
experience and comes out optimistic. The device then reaches the fall, struggles,
and downgrades — contradicting a number already shown at the door.

Two fixes, both wanted:

- **Benchmark something representative.** The shader is already being compiled
  during loading; render a few frames of the fall's pose off-screen and judge on
  those.
- **Present it as a starting point, not a verdict.** "Starting at High", not
  "Your device: High". A later downgrade is then the system working rather than
  the system contradicting itself.

### A hand-picked tier pins the manager

Downgrades stay on. Upgrades turn off.

- **Downgrades stay** because they are protection, and cannot be experienced as
  interference — the alternative is a broken frame rate.
- **Upgrades stop** because once someone has chosen, the manager should have no
  further opinion about going higher.

Without the second half the visitor watches a fight they did not start: pick low,
climb to medium, stumble, drop to low, wait out the cooldown, climb again.

Implemented in `portfolio-3D` as `setUserTier()` / `clearUserTier()`, which
suppress `upgrade()`, `trackUpgradeHeadroom()` and `startMediumProbe()` while
leaving every downgrade path alone.

### Announce only what the visitor chose

Toast when the tier **the user picked** stops being the tier running. Not on
internal churn.

The manager deliberately flips low → medium → low to probe for headroom. That is
machinery, not a decision; announcing it narrates internals at somebody. The same
goes for the first settle after warmup, which is still setup.

Once per session, not per event. A thermally throttling device downgrades
repeatedly, and three toasts during the fall are worse than the frame rate that
caused them.

---

## 6. Where the controls live

**Not in the entry.** The loading screen says YOU ARE NOT READY FOR THIS and asks
for a press-and-hold. A settings panel in the middle of that costs more than the
control gains. Default silently to cinematic, show the starting tier small, and
keep any control there secondary — findable if looked for, never required to get
in.

**The real control goes in the site menu.** `ROADMAP.md` records that the menu
"has room it is not using" and was left bare rather than filled with invented
content. This is not invented content: it is a real setting, and it has to be
reachable *during* the experience anyway — someone twenty minutes in on a warm
phone should be able to turn it down without reloading.

Remember the choice between visits, with the rule the deep-linking work already
established: an explicit request outranks a stored preference.

---

## 7. Scroll ownership

One Lenis. One document. One scroll position.

The journey is a pure function of scroll, and the sections are already
scroll-driven through ScrollTrigger, so both read the same number. This needs no
second scroll owner — which is the trap `ANIMATIONS.md` already warns about, and
`portfolio-3D` currently creates its own Lenis instance that must not come across.

Two things to settle before building:

**Pinned sections and the journey.** The projects carousel pins and consumes its
own scroll. Inside the journey, that means either the camera holds while the
visitor browses, or the journey keeps running underneath. Holding is better — a
camera still falling while someone reads a case study competes with the reading —
but it means the journey's units are the *journey's* budget and the page is
longer than the journey.

**Sub-routes must not restart the scene.** `/projects`, `/skills/[slug]`,
`/resume` and `/experience/[slug]` are real pages. Park the scene rather than
re-instantiating it: freeze the camera, drop quality, restore scroll on return.
The deep-linking work already fought this exact fight, choosing
`history.replaceState` over the router specifically to avoid tearing through a
WebGL tree.

**`/projects` list view needs rethinking, not porting.** It locks page scroll and
runs a second WebGL context. Inside a scroll-driven journey, a section that stops
scroll stops the film.

---

## What was rejected

| Option | Why not |
|---|---|
| Keep two repos, deploy the cinematic separately | The content forks. Only one of them gets sent to anyone |
| Build the portfolio on top of `portfolio-3D` | Rewrites routing, SSG, content loaders, the résumé PDF and ~300 tests into vanilla Vite, to keep ~2,800 lines of scene |
| A third combined repo | Strands both histories, `status.md` most of all, and re-poses the same merge |
| The journey as an ambient background behind unchanged sections | It is not ambient. It has a plot, a flash and a scene swap. It would finish during the hero or drag across the résumé |
| Named tiers for very-low / very-high | Each is a look to tune and verify; adjacent tiers cannot be distinguished from frame timing. The resolution slider covers this range continuously |
| Section-to-act mapping as the content's home | Tier-locks the layout. Acts score the sections; they do not decide where content lives |

---

## Order to build in

1. ~~**Measure `medium` on the old phone.**~~ **Done.** Three rungs, but not the
   three that were assumed. On a Realme 9 Speed Edition: low 50–75fps, medium
   15–20, high 5–10 — a 3–5× collapse where pixel-count maths predicted ~1.6×.
   Low is the only rung that phone has. An iPhone 16 Pro runs high at 40–60fps
   comfortably. So the ladder is real, but it is separated by device class
   rather than by anything a phone can climb.
2. ~~**Fix the benchmark workload.**~~ **Done** in portfolio-3D. It now parks the
   camera at 0.85 of the approach instead of judging the device on the wormhole
   opening. Two things came out with it: the heavy-frame line was at 50fps and
   was taking `high` away from the iPhone that was rendering it well, and moving
   that line turned the low→medium probe into a loop that climbed and collapsed
   every 30 seconds. Both fixed there.
3. ~~**Port the scene into this repo** behind a flag~~ **Done.** It runs at
   `/cinematic?cinematic=1`, on a route of its own rather than behind the home
   page, because the journey owns scroll for 28 viewports and is not ambient.
   `still` is unchanged for everyone. What the port cost is recorded in the
   commit: one Lenis instead of two, lil-gui's config extracted, the shader
   generated into a string because Turbopack has no working `?raw`, and 9.7MB
   of texture moved to `/public`.
4. **Make the tier ladder real**, `still` included as a rung rather than a
   separate site.
5. **Add the presentation switch** and build the cinematic presentation against
   content that already exists.
6. **Rethink the `/projects` list view** for a world where scroll is the film.
