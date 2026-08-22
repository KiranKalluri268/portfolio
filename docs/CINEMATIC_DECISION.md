# The 3D cinematic portfolio — decisions

What was decided about turning this portfolio into a scroll-driven cinematic,
and why. `ARCHITECTURE.md` describes what the code is; this describes what it
is becoming and which options were rejected on the way.

**Status:** decided, not built. Nothing here has shipped.

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

**Three.js 0.148 is from 2022.** Port the scene as a plain module mounted by one
client component — not react-three-fiber. Two things break on the way across:
the `.glsl` import, which Vite handles natively and Next does not, and the ~17MB
of textures, which must load after first paint rather than sitting in the bundle.

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

---

## 5. Choosing the tier

### The benchmark measures the wrong workload

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

1. **Measure `medium` on the old phone.** Decides three rungs or two. Everything
   about tuning follows from it.
2. **Fix the benchmark workload.** Cheap, and every tier decision rests on it.
3. **Port the scene into this repo** behind a flag, at `still` for everyone, and
   confirm nothing regresses.
4. **Make the tier ladder real**, `still` included as a rung rather than a
   separate site.
5. **Add the presentation switch** and build the cinematic presentation against
   content that already exists.
6. **Rethink the `/projects` list view** for a world where scroll is the film.
