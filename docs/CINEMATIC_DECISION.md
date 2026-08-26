# The 3D cinematic portfolio — decisions

What was decided about turning this portfolio into a scroll-driven cinematic,
and why. `ARCHITECTURE.md` describes what the code is; this describes what it
is becoming and which options were rejected on the way.

**Status:** steps 1–5 of the build order are done. The scene lives in this repo
and the cinematic is now a choice rather than a flag: `/cinematic` is a real
route, the site menu offers it, and a cookie remembers it. **Plain is still the
default**, so nothing changes for anyone who does not go looking. The tier ladder
has `still` as its bottom rung, so a device that cannot fly — or a visitor who
has asked not to be flown — is handed back to the site instead of stranded. The
hero is the first section scored against the flight; the rest of the portfolio
is not there yet, which is the only reason the default has not flipped. Step 6 is
untouched.

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

### First section through, and what it proved

The hero. Same three facts in both presentations, now read from
`src/data/hero.json` by each — they were string literals inside the plain hero's
component until this step, which means the rule above was already being broken
before there was a second presentation to break it with. Worth knowing that the
fork does not need two files to start: one component holding facts nobody else
can reach is the same failure, one step earlier.

What differs is everything else. The plain hero types itself, centred, at the top
of a page. The cinematic hero is bottom-left, all four roles at once, over a
wormhole — no typing, because the camera is already moving and a second animation
competes with it. Neither of those is content.

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
| **still** | The site's ordinary presentation: `StarsBackground`, `BlackholeEffect`, and the projects grid. No *journey*. Also the `prefers-reduced-motion` and no-WebGL2 answer |
| **low → high** | The journey, with the resolution slider moving inside each |

**`still` is not "no WebGL", and this table used to say it was.** The projects
grid renders its cards through `ogl` — a separate, much smaller WebGL renderer
from the journey's three.js, with its own context-loss handling in
`useGlRecovery`. That grid keeps working at `still` and must: it is one of the
main things the site is for. `still` means *no journey*, nothing more. Written
down because the old wording would have led someone to gate the carousel off
along with the flight.

It follows that **"no WebGL2" cannot be what selects `still`** — `still` needs
WebGL itself. The WebGL2 probe in `CinematicScene.tsx` asks on behalf of the
journey only. A browser with no WebGL at all is the grid's problem and has its
own answer.

`still` is what this repo ships today. It is already built, already tested, and
confirmed smooth on the oldest phone available. It is the floor of the same
ladder, not a consolation prize.

It is also the honest response to `prefers-reduced-motion`, which had no answer
on the cinematic route until step 4. A scroll-driven camera flight is precisely
what that setting asks you not to do, and lowering the frame rate is not a
reduction in motion.

Add a fourth rung only when a real device is badly served by all of these. Let
hardware ask for it.

### How `still` is reached, and the number that decides it

Unlike the other rungs, `still` is not a preset the manager can apply. There is
no cheaper way to draw the journey, only the decision not to draw it — so the
manager asks (`onStillRequired`) and the scene answers. On `/cinematic` that
answer is a navigation back to the site, because the route has no content of its
own without the flight. Four ways in:

| Trigger | Decided | Where |
|---|---|---|
| `prefers-reduced-motion` | before the import | `CinematicScene.tsx` |
| no WebGL2 | before the import | `CinematicScene.tsx` |
| the scene throws on the way up | at mount | `CinematicScene.tsx` |
| p90 > **50ms** while already on `low`, or the benchmark deadline expiring there | end of warmup | `ThreeDQualityManager.js` |

The first two run before the dynamic import, so a device that was never going to
draw a frame does not download three.js and 9.7MB of texture to find that out.

**The 50ms bar is the panic line, deliberately not the heavy one.** `low` failing
the 25ms heavy line means *marginal*, not incapable — the Realme measures
24.3–27.7ms at `low` in the fall, straddling that bar, and runs the journey there
perfectly happily. Pinning `still` to the heavy line would take away a tier a
real phone can hold. Above 50ms p90 a device is under 20fps sustained on the
cheapest rung there is, with nothing left to give up. There is a test whose only
job is to hold that line.

**Entry-only.** `lockOutStill()` fires as the gate is passed. Tearing three.js
down mid-flight, while someone is scrolling a camera through a wormhole, is worse
than any frame rate; from there `low` is the floor. A hard failure is the one
exception, because the alternative is a frozen page.

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

Held each tier still with the preset lock and read the counter. **These numbers
were read off the FPS meter, which was itself costing about 150ms a second — see
"Every reading above was taken with the FPS meter mounted" below. Treat them as
depressed by roughly 10–20%, and the ordering rather than the values as the
finding.**

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

### Every reading above was taken with the FPS meter mounted, and the meter was breaking the scene

This is the most expensive thing on this page, so it goes at the end of the
measurements rather than in a footnote.

`?devtools=1` mounted stats.js. Its panel is an 80×48 `<canvas>` redrawn once a
second (`Stats.js:77`), sitting over the WebGL canvas. On the AMD 780M through
ANGLE/D3D11 that redraw costs **76–723ms of presentation time**, once a second,
on the dot. Not script time: `long-animation-frame` reported `blockingDuration: 0`
and no scripts at all on every one of them. The compositor simply stopped
producing frames for about twenty refreshes.

Same tab, seconds apart, at the entry gate:

| | frames / 8s | median | p90 | max | spikes |
|---|---|---|---|---|---|
| with the meter | 955 | 7.0ms | 7.1ms | **201.8ms** | 10, at gaps of 1002 995 1009 1002 1009ms |
| without it | 632 | 13.9ms | 20.9ms | **21.6ms** | none, and it held `high` throughout |

Reproduced from scratch to be sure it was not stats.js specifically: an empty
80×48 canvas appended to the page and filled once a second brought the spikes
straight back on a clean tab. Layer promotion did not help — `will-change:
transform` and `contain: strict` both still spiked — and neither did moving it
out to `<body>`. **Text does not spike at all**, which is what the meter is now.

**What this invalidates.** Every tier transition observed on a device: the iPhone
dropping the moment a scroll started, "instantly drops to low when unlocked",
`low` being selected at the entry gate on a plugged-in laptop. Those were the
meter tripping the panic rule, not the devices. Several days went into chasing
them, and the last of them — a supposed bug in the benchmark's pose handover —
did not exist at all.

**What survives, and why.** The cost curves above are medians of 30 frames per
pose (`curveRunner.js:68`); a once-per-second stall touches at most one sample in
thirty and cannot move a median. So the fall plateau, the 11× tunnel/fall ratio,
"the opening is not cheap", and `BENCHMARK_APPROACH_PROGRESS = 0.30` all stand.
Warmup's p90 figures survive for the same reason — three spikes in three hundred
frames do not move a 90th percentile. The eyeballed fps numbers read off the
meter are depressed by roughly 10–20% (about 150ms lost per second) rather than
void.

**The lesson worth keeping.** An instrument that shares a frame budget with the
thing it measures has to be proven not to spend any of it. This one was mounted
specifically to diagnose frame drops and was itself the cause. The tell was
available the whole time and went unread: `median 7.0ms, p90 7.1ms, max 201.8ms`
describes a healthy scene with something else on top of it, not a struggling one.

### Re-measured with the instrument fixed, and the ladder agrees with the curve

Every device re-run after the meter became text and the panic rule started
needing two frames instead of one. The point of this section is that the
behaviour is now *predictable from the tables above* — which is the check that
the tables themselves are sound.

| device | settles at | what it does | the curve says |
|---|---|---|---|
| laptop, plugged | `high` | warmup → `high`, no downgrades, 12s+ | `high` 20.9ms vs a 25ms bar |
| iPhone 16 Pro | `medium` | starts `high`, drops once when scrolling starts, then stable | `high` 22–23ms static, and scroll adds the rest |
| Realme 9 SE | `low` | starts `low`; a hand-picked `medium` fails after a few seconds | `medium` 62.5ms, every frame past the 50ms panic bar |

**The iPhone's drop is the ladder working, not failing.** 22–23ms static against
a 25ms line is a 2–3ms margin, and the note above already says the curve is a
floor rather than the whole cost: Lenis, ScrollTrigger and compositing land on
the same frame. So `high` crosses the line the moment a scroll begins. `medium`
is the honest answer for that phone and it is now reached in **one** transition.

**The Realme confirms it has one rung.** `medium` at 62.5ms cannot survive a
50ms panic bar for even a second, and `low` at 24–28ms holds only because there
is nothing below it to fall to. The few seconds before a hand-picked `medium`
gives way are the probe evaluation window, not hesitation.

Worth contrasting with the same devices before the fix — the readings that sent
several days sideways: the iPhone "never moved to medium, even if I moved it
without lock it dropped back in few seconds", the Realme "instantly drops to low
when unlocked", the laptop picking `low` at the entry gate while plugged in.
Every one of those was churn. Every device now makes **at most one** automatic
transition and stays there.

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

### Built, and what it cost

The switch is in the menu, under the six destinations and deliberately quieter
than them. Each option carries a line of description, because "cinematic" means
nothing to anyone who has not seen one yet. From a sub-route it only remembers —
`/projects` is `/projects` in either presentation, and switching is not a request
to stop reading what you are reading.

Two costs came with it, both worth recording:

**The menu did not fit.** Six destinations at `clamp(2.5rem, 12vw, 6rem)` already
stood at 960px inside a 709px window. Adding anything below them cut `Home` off
the top. The link size is now capped by viewport height as well as width, and the
panel scrolls if it still does not fit — centred with auto margins rather than
`justify-content`, because `justify-content: center` in a scroll container
centres by pushing content past the scrollable origin, where scrolling cannot
reach it. Measured at 709, 800 and 1000px tall.

**The redirect loop.** Every route to `still` ends in `router.replace("/")`, and
`/` is exactly where the stored preference is read. Rewriting the preference to
`plain` would fix it and would be the welding §2 forbids — a hardware verdict
silently overwriting a person's choice. So there are two cookies: `presentation`
holds the choice and persists; `journey-unavailable` holds the device's verdict
and lasts the session. Asking for the cinematic by name clears the second one,
because a phone that was hot or a browser flag that has changed deserves another
go.

### Where it lives, and the SEO cost

`/cinematic` is its own route rather than a branch inside `/`, and that is a
compromise rather than the destination. §7 wants one document with one scroll
position; two URLs serving one portfolio is duplicate content, so `/cinematic` is
`noindex` with `/` as its canonical. That is fine while the cinematic carries one
section. It stops being fine when it carries the whole portfolio, and the
decision is worth taking again then.

The routing is done in `src/proxy.ts` — Next 16's rename of `middleware`, which
also removed a deprecation warning on every dev start. In the proxy rather than
by reading `cookies()` in the page, because that would make `/` dynamic: the
busiest route on the site rendered on demand to answer a question that is nearly
always "no". It stays statically prerendered.

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
2. ~~**Fix the benchmark workload.**~~ **Done** in portfolio-3D. It parks the
   camera in the fall instead of judging the device on the wormhole opening.
   First at 0.85 of the approach, and now at **0.30** — the cost sweep later
   showed the fall is a flat plateau rather than a peak, so the middle of it is
   the safest place to stand. Two things came out with it: the heavy-frame line was at 50fps and
   was taking `high` away from the iPhone that was rendering it well, and moving
   that line turned the low→medium probe into a loop that climbed and collapsed
   every 30 seconds. Both fixed there.
3. ~~**Port the scene into this repo** behind a flag~~ **Done.** It runs at
   `/cinematic?cinematic=1` — the flag came off in step 5 — on a route of its own
   rather than behind the home page, because the journey owns scroll for 28
   viewports and is not ambient.
   `still` is unchanged for everyone. What the port cost is recorded in the
   commit: one Lenis instead of two, lil-gui's config extracted, the shader
   generated into a string because Turbopack has no working `?raw`, and 9.7MB
   of texture moved to `/public`.
3b. ~~**Make the tier machinery trustworthy.**~~ **Done**, and it was not on this
   list because nobody knew it was needed. The benchmark was moved to the fall
   plateau, warmup was made to judge on a percentile rather than a count of
   outliers, a ceiling was added so a failed tier is not retried all session,
   and the panic rule was made to need two bad frames instead of one. Then the
   FPS meter turned out to be stalling the compositor once a second and causing
   most of what was being fixed. Every device now makes at most one automatic
   transition and settles where the cost curve says it should.
4. ~~**Make the tier ladder real**, `still` included as a rung rather than a
   separate site.~~ **Done.** `still` is reachable four ways — reduced motion,
   no WebGL2, the scene throwing, and the benchmark finding that even `low`
   cannot hold 20fps — and all four hand the visitor back to the site rather
   than to a broken page. Two of those were live bugs rather than missing
   features: `prefers-reduced-motion` had no answer at all on this route, and a
   throw during startup left scroll locked behind a frozen loading overlay. The
   rung is entry-only; once the gate is passed, `low` is the floor.
   One thing this step corrected rather than added: `still` is not "no WebGL".
   The projects grid keeps its `ogl` cards there.
5. ~~**Add the presentation switch** and build the cinematic presentation against
   content that already exists.~~ **Done**, for the switch and for the first
   section. `/cinematic` is a real route with a control in the menu and a cookie
   behind it, and the hero rides the wormhole crossing as real markup. Plain
   stays the default until there is more than one section in there.

   Three things this step corrected rather than added. The hero's copy was
   string literals inside its component, so §3's one-source rule was already
   broken before there was a second presentation to break it with. The story
   overlay drove one hardcoded element, so a second section could be added to
   the markup and would simply never move. And `getScenePresence` treated a
   scene's own first frame as outside its window — invisible until something
   sat at scroll 0, which nothing did until the hero.
6. **Rethink the `/projects` list view** for a world where scroll is the film.
