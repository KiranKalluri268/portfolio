# Building the cinematic world — execution plan

`CINEMATIC_DECISION.md` §8 says *what* the world is and why. This says *how it
gets built*, in what order, and what has to be true before each part is called
done.

It is written to be executed by someone — or something — with no memory of the
conversation that produced it, on a different machine. Everything it relies on is
either stated here or cited by file and line. If a claim in here disagrees with
the code, the code is right and this document is stale: fix it in the same change.

---

## 0. Before you touch anything

### Where things are

| | |
|---|---|
| Site | `K:\kiran\Projects\Portfolio\my-portfolio` — this repo |
| Lab | `K:\kiran\Projects\Portfolio\portfolio3D` — shader tuning only |
| Route | `/cinematic`, or `/?presentation=cinematic` |
| Dev tools | `/cinematic?devtools=1` — FPS meter and tier switcher |
| Cost sweep | `/cinematic?curve=1` — walks the journey and reports frame time |

### Commands

```
npm run dev            # next dev --turbopack
npm run build          # must stay green; / must stay ○ (Static)
npm run lint           # 0 errors. 5 pre-existing warnings are known, see §7
npm test               # vitest run
npm run test:e2e       # playwright
node scripts/port-shader.mjs <path-to-lab-fragmentShader.glsl>
```

### The one workflow rule that is easy to get wrong

**`src/cinematic/scene/graphics/fragmentShader.ts` is generated. Do not edit it.**
Its first line says so. Shader work happens in the lab's
`src/graphics/fragmentShader.glsl`, where Vite's `?raw`, `lil-gui` and a tight
visual loop are, and comes across with `scripts/port-shader.mjs`. Anything typed
into the generated file is lost on the next port, silently, and the failure mode
is a black frame explained only in the console.

Its default path used to be wrong — one directory too high — so it could never
run without an explicit argument. Fixed in phase 0. Running it now confirms the
lab and this repo hold identical GLSL.

### Working agreements

- **Ask rather than assume.** Where this document leaves a decision open (§8), it
  is open on purpose. Bring options and a recommendation; do not pick silently.
- **Commits and PRs are written in the repo author's first person** — what was
  wrong, why it was wrong, what the fix rests on, with measured numbers where
  there are any. No tool or assistant attribution anywhere: not in branch names,
  commit messages, PR titles, PR bodies, or trailers. Use the local git identity.
- **One phase, one PR.** Each phase below is sized to be reviewable on its own and
  revertable on its own.

---

## 1. Constraints that never move

These are inherited from `CINEMATIC_DECISION.md` and are not up for
re-litigation inside this plan. A change that breaks one of them is wrong even if
it looks better.

1. **Content is real DOM markup.** §3. A planet is how a project is *shown*. Its
   name and description are text in the document that a crawler and a screen
   reader can reach. Nothing may exist only as pixels in a canvas.
2. **`src/data/**` is the only source of facts.** The world reads the same files
   the plain presentation reads. No copy of a project title, a skill name or a
   role date may live in the scene.
3. **One Lenis, one scroll position, one owner.** §7. The journey is a pure
   function of scroll. Nothing may stop, hijack or add a second source of truth
   for scroll — which is also why the camera never stops (§8).
4. **`/` stays statically prerendered.** Check the build output for `○ (Static)`.
5. **`still` stays reachable.** Reduced motion, no WebGL2, a scene throw, and a
   benchmark verdict all hand the visitor back to the plain site. Any new failure
   mode must land in the same place.
6. **Plain stays the default** until §8's world is real. `DEFAULT_PRESENTATION`
   in `src/lib/presentation.ts` is a one-line change and is not part of any phase
   below.

---

## 2. The render budget, and the three rules that follow from it

This is the most important section in the document. Get it wrong and the world is
unshippable; get it right and it is close to free.

**The raymarcher dominates everything.** It is fullscreen, per-pixel, hundreds of
steps, bending rays around the photon sphere. That is why the fall measured
**152.7ms per frame against the tunnel's 13.9ms** on a Realme 9 Speed Edition —
same device, same tier, one journey — and why the tier ladder's main lever is
resolution (`0.5` / `0.75` / `1.0`) rather than object count. Meanwhile the scene
already draws **2,500 additive point sprites every frame** and nobody has ever
measured them as a problem.

So:

### Rule 1 — N objects, one target

Every `WebGLRenderTarget` is a fullscreen allocation, a fullscreen clear, and a
fullscreen texture fetch composited inside the shader. Eleven planets in one
scene drawn to one target cost about what one planet costs. Eleven targets would
not be shippable at any tier.

The scene currently has three targets: `particleTargetLensed`,
`particleTargetUnlensed` (`render.js:180`), and the planet's own
(`planet.js`, currently not created because the feature is off). **The world adds
at most one more, total, for all bodies and rings combined.**

### Rule 2 — per-pixel work inside the raymarch is the expensive kind

The planet's compositing block at `fragmentShader.ts:616` runs for every pixel of
every frame, and multiplies against resolution. Adding meshes to an offscreen
scene does not. Prefer geometry in a target over branches in the shader, always.

### Rule 3 — the sky is free

Sampling a procedural starfield from the ray direction costs one function call at
ray termination, has no radius, and is lensed by the bent ray automatically. It
is the cheapest large visual change available and it is also the one that fixes
the sphere.

### The gate

**No phase merges if it makes the `?curve=1` sweep measurably worse on the
Realme, at the tier that device runs.** Not "within 10%" — no worse. 152.7ms is
already the ceiling; the world is free or it does not ship at that tier. High-tier
devices are measured too, and a regression there needs an explicit decision
rather than a shrug.

---

## 3. What the sphere actually is, and how it goes away

Recorded here because the fix is phase 1 and the diagnosis is easy to lose.

`render.js:180` builds a **hollow, flattened shell**:

- Layer 1: `COUNT_S = 2200` points, `size 0.08`, radius `8 + rand*34` → 8 to 42
- Layer 2: `COUNT_B = 300` points, `size 0.11`, radius `8 + rand*30` → 8 to 38
- Both multiply Y by `0.25`, so it is an oblate lens rather than a ball
- `sizeAttenuation: true`, additive, `depthWrite: false`

The fall runs the camera from `arriveDist = 30` (`main.js:800`) down to
`blackHoleDist = 3.6 * (1 + 0.55 * narrowFraming)` (`main.js:826`). So the visitor
arrives inside the shell near its outer wall and ends inside its **inner void**,
with every star outside them at radius ≥ 8 and nothing at all beyond 42. That
bounded bubble is the sphere.

Enlarging the shell moves the wall without removing it, and because
`sizeAttenuation` is on, every star dims and shrinks as the radius grows.

**The fix is to separate the sky from the field.** Distant stars have no parallax:
they are a direction, not a position. Sampled from the escaped ray direction in
GLSL they sit at infinity, have no boundary to hit, and are lensed for free. The
2,500-point shell then stops pretending to be the universe and becomes local dust
with real parallax, which is what actually sells motion.

---

## 4. The phases

Each phase is one PR. Each has a flag so it can be switched off in production
without a revert, the way the old `PLANET_ENABLED` did. Flags live in one place:
`src/cinematic/scene/worldConfig.js`, created in phase 0.

---

### Phase 0 — Groundwork, flags and a baseline

**Done, except the baseline itself, which needs the physical devices.** It also
grew a fourth item that was not in the original list: the curve runner was
measuring the display rather than the scene, and had to be fixed before any
baseline taken with it would have meant anything. See
`CINEMATIC_MEASUREMENTS.md`.

**Goal.** Make the following phases measurable and revertable. Change nothing a
visitor can see.

**Do:**

1. Fix the default source path in `scripts/port-shader.mjs` (one `../` too many).
2. Create `src/cinematic/scene/worldConfig.js` exporting one frozen object of
   feature flags, all `false`: `sky`, `bodies`, `rings`, `contentAnchors`,
   `heroStar`. Read it in `main.js`; do not scatter flags.
3. Capture a baseline `?curve=1` sweep on **both** reference devices and commit
   the numbers to `docs/CINEMATIC_MEASUREMENTS.md` (create it) with device, tier,
   date and browser. Every later phase diffs against this file.
4. Add a vitest for `worldConfig` asserting every flag defaults to `false`, so a
   flag cannot be left on by accident.

**Exit criteria.**
- ~~All flags off, and `/cinematic` renders identically to `main`.~~ **Met, and
  by argument rather than by screenshot.** The only behavioural change is that
  `const PLANET_ENABLED = false` became `worldConfig.bodies`, which is also
  `false` — the same expression with the constant moved. A screenshot comparison
  would have run through SwiftShader at ~5.6s a frame and shown two black
  frames, which is not evidence. What was worth checking in a browser, and was
  checked, is that the new import resolves at runtime: `/cinematic` mounts, both
  canvases are created, the hero `h1` is real DOM, and nothing falls back.
- ~~`npm test`, `npm run lint`, `npm run build` green; `/` still `○ (Static)`.~~
  **Met.** 305 tests, 0 lint errors, `/` still `○`.
- **Baseline curve committed for both devices — NOT MET.** The table exists in
  `CINEMATIC_MEASUREMENTS.md` with the rows and the protocol; the numbers need
  the Realme and the iPhone in hand. **Phase 1 cannot honestly be called done
  until these exist**, because its gate is a comparison against them.

**Risk.** None material. This phase exists so the rest can be measured.

**What it found.** `scripts/port-shader.mjs` could never have run without an
explicit path, and with the default fixed it turns out the lab's shader and the
generated copy in this repo are **identical** — there is no divergence to
reconcile before phase 1 touches the GLSL.

---

### Phase 1 — The sky

**Goal.** Remove the bounded sphere. Give the world a galaxy that is genuinely
behind everything.

**Flag.** `worldConfig.sky`.

**Do:**

1. In the **lab**, in `src/graphics/fragmentShader.glsl`, add a background
   function sampled at ray escape — where a ray leaves without hitting the
   horizon or the disk. It takes the **bent** direction, so lensing is automatic.
   It produces: a broad galactic band, a star field, and five coloured arms.
2. The five arms are **not hardcoded**. `src/data/skill-web.json` gives each
   domain an `angle` and an `accent`. Read that JSON in `main.js`, pass the five
   angles and five colours as uniforms. Constraint 2 holds: the shader has no
   opinion about what a domain is, and adding a sixth domain to the data changes
   the sky with no shader edit.
3. Port with `node scripts/port-shader.mjs <lab path>`.
4. Re-purpose the point shell in `render.js:180` as **local dust**: pull the outer
   radius in, so it reads as nearby particles with parallax rather than as the
   universe. Exact numbers are tuned in the lab, not guessed here.

**Exit criteria.**
- At every pose in the `?curve=1` sweep, no visible boundary and no empty region:
  step the journey at 0, 5, 8, 12, 16, 20, 24, 27 units and screenshot each.
- The five arm hues match `skill-web.json`'s `accent` values. Assert this in a
  unit test on the uniform-building function, not by eye.
- Curve no worse than the phase 0 baseline on the Realme.
- Editing `skill-web.json` changes the sky. Prove it with a test that feeds a
  modified fixture through the uniform builder.

**Risks.**
- **The generated-file trap.** If the diff touches `fragmentShader.ts` without a
  matching lab change, the change will be lost. The PR must show both.
- Bloom. The sky is a new light source; `bloomPass.threshold` is set per phase in
  `main.js` and was tuned against a dark background. Expect to re-tune, and read
  the comment at `main.js` explaining why nothing may sit at threshold 0.

---

### Phase 2 — The body system

**Goal.** One system that can place and draw N bodies, with the existing planet
absorbed into it as one instance rather than kept as a special case.

**Flag.** `worldConfig.bodies` — already the planet's flag. Phase 0 migrated it
rather than leaving a second boolean beside it, so this phase extends a flag that
already governs the one body that exists.

**Context you need.** `src/cinematic/scene/graphics/planet.js` renders one sphere
to its own target, which the raymarcher samples back along the **bent** ray — so
it is lensed, throws a second image, and is occluded by the hole for free. It is
currently switched off (`worldConfig.bodies`) with two known
problems recorded in the comment: it grazed the accretion disk, and the end of
the fall came to be governed by the photon ring rather than by where it was
anchored.

It is also **hand-tuned**. `ORBIT_RADIUS = 12.0` carries a comment recording two
failed attempts and the trigonometry explaining why 65 → 30 barely moved
anything: separation is `atan(R sin f / (d + R cos f))`, so far out `d` dominates
and `R` scales it, and close in the anchor angle `f` governs it and `R` does not
matter at all. Its free occlusion holds only while it is genuinely further from
the camera than the hole is, and that margin "never gets above about 10 units".

**Do:**

1. Generalise `planet.js` into `graphics/bodies.js`: **one scene, one target, one
   camera, N meshes** (Rule 1). Keep `COMPOSE_SHIFT` / `COMPOSE_SHIFT_Y` handling
   — the projection is slid sideways and every body must carry the same shift or
   it will disagree with the shader about where a direction lands.
2. Replace the hand-picked radius with a **placement rule**: a body's radius and
   angle are computed from its data (which ring it is on, its index on that ring)
   and from the camera distance, such that the occlusion margin and the disk
   clearance hold at every pose. The rule is a pure function and is unit-tested
   across the whole journey, not eyeballed at one pose.
3. Re-tune the single existing planet as the first instance of that rule, fixing
   the two recorded problems.

**Exit criteria.**
- Exactly one new render target exists. Assert it: count targets in a test or a
  dev-mode console warning.
- The placement function is pure, exported, and tested at every pose from 13.0 to
  27.0 in 0.5-unit steps, asserting (a) no body inside the disk's radius, (b)
  occlusion margin positive throughout, (c) no two bodies overlapping on screen.
  This mirrors what `/skills` already does — its layout module asserts no node
  overlaps another.
- Curve no worse than baseline with all 11 bodies enabled.
- Mutation test the placement rule: break each clause and confirm a named test
  fails.

**Risks.** This is the highest-risk phase in the plan. Budget for it accordingly,
and if the placement rule cannot be made to hold for 11 bodies, that is a finding
to bring back rather than a thing to force — the fallback is fewer, larger bodies
and a link out, which is §8's "still open".

---

### Phase 3 — The rings

**Goal.** Experience becomes the orbital rings the bodies sit on.

**Flag.** `worldConfig.rings`.

**Do:** three rings, one per role, radius ordered by `startDate` — earliest
outermost, so falling inward is moving forward in time. Drawn into the **same**
scene and target as phase 2 (Rule 1), as line geometry or a thin instanced band.

**Exit criteria.**
- Ring order derives from `startDate` in `src/data/experience/*.json`. Test it
  with a fixture whose dates are shuffled.
- `eduskills-aws` has no `projectSlug` on any work item, so **one ring is empty**.
  Decide deliberately what an empty ring looks like and write the decision down;
  do not let it silently render as a bug.
- Still one target. Still no curve regression.

---

### Phase 4 — Content anchored to the world

**Goal.** The thing this is all for: the DOM sections stop being screen-parented
captions and take positions in the world.

**Flag.** `worldConfig.contentAnchors`.

**Do:**

1. Extend `story/storyTimeline.js` so a scene may carry a **world anchor** — a
   body or ring id — in addition to its four scroll positions. Scenes without one
   keep behaving exactly as they do now.
2. In `story/StoryOverlay.js`, when a scene has an anchor, project that anchor's
   world position to screen through the same camera and the same `COMPOSE_SHIFT`
   the bodies use, and drive the element's transform from it. The element is still
   real DOM, still in the document, still readable with the canvas removed.
3. `StoryOverlay` already loops over every `[data-story-scene]` and already
   distinguishes a *beat* (`forwardOnly`) from a *place*. Extend it; do not
   rewrite it.

**Exit criteria.**
- With CSS transforms disabled, every fact is still present and in reading order.
  There is already a test of this shape in
  `src/cinematic/__tests__/hero-content.test.tsx` — extend it to all sections.
- An anchored element tracks its body: assert screen position changes when the
  camera pose changes, with a fake camera in a unit test.
- Exactly one `<h1>` in the document, and it is the name.
- `aria-hidden` still flips with opacity, as it does today.

---

### Phase 5 — Contact is the black hole

**Goal.** Give the destination its meaning. The end of the fall is the invitation.

**Flag.** part of `worldConfig.contentAnchors`; no separate flag.

**Do:** score the contact section against the last units of the approach, ending
at `approachEnd = 27.0`. Real links — `mailto:` and the profile links that already
exist in the data. **No form on the journey**: focusing a text input while scroll
drives a camera is a genuine conflict and it needs its own design pass. Link to
the plain page's form.

**Exit criteria.** Links are keyboard reachable and are real anchors. The
source/licence footer already appears at `approachEnd - 0.15`; make sure the two
do not collide.

---

### Phase 6 — The hero becomes a star

**Goal.** Fix the five defects §8 lists, now that there is a world to fix them
against.

**Flag.** `worldConfig.heroStar`.

**Do:** the hero's copy anchors to the star (phase 4's mechanism). Drop the
plain-site halo, which was drawn to lift text off a flat dark page and competes
with real bloom. Give the type a treatment that belongs to this place rather than
to the other presentation.

**Exit criteria.** The name is still present at scroll 0 — that requirement is
older than this plan and `storyTimeline.js` documents why. Screenshot at 1440×900
and 430×932. No regression in `presentation-switch` or `still-fallback` tests.

---

### Phase 7 — Tiers, and what `low` gets

**Goal.** Decide and implement what each rung of the ladder renders, rather than
letting `low` inherit whatever `high` has with fewer pixels.

**Do:** measure the full world at each tier on both devices. If `low` cannot hold
the budget, `low` gets a genuinely simpler world — the sky and the rings without
the bodies, say — rather than the same world at a lower resolution. Write the
decision into `CINEMATIC_DECISION.md` §4 next to the existing rungs.

**Exit criteria.** Every tier is measured, not assumed. `still` still reachable
by all four routes. `prefers-reduced-motion` still hands the visitor back.

---

## 5. How to measure

1. `/cinematic?curve=1`. It holds the tier still and walks the camera through the
   journey a pose at a time — every 1.5 units to `approachEnd`, discarding 10
   settle frames and sampling 30 per pose. It drives the camera itself, so do not
   scroll while it runs; it says so on screen.

   It holds the **resolution** too, at a fixed multiple of the tier's, and it
   reports two columns: wall-clock frame time and real GPU time where the driver
   offers it. **Read the GPU column.** Wall-clock can never fall below the
   display's refresh interval, so on a device drawing faster than its screen it
   reports the screen — which is exactly what the first three sweeps did. The
   report now detects that and says so itself.
2. Run it on **both** reference devices at the **same tier** as the baseline.
   Record device, tier, browser, date, and whether the device was on mains power —
   `CINEMATIC_DECISION.md` already records that power state moved readings more
   than the tier did.
3. Append to `docs/CINEMATIC_MEASUREMENTS.md`. Never overwrite a previous run.
4. **Do not mount the FPS meter while measuring.** It was found to be stalling the
   compositor about once a second and causing much of what was being fixed. That
   is written up in `CINEMATIC_DECISION.md` §4.

Reference devices: **Realme 9 Speed Edition** (the floor — `low` is the only rung
it has) and an **iPhone 16 Pro** (runs `high` at 40–60fps).

---

## 6. Testing

The repo has ~302 vitest tests and a Playwright suite in `e2e/`. The bar here is
the bar the rest of the repo already meets.

- **Pure logic gets unit tests.** Placement rules, ring ordering, uniform
  building, timeline presence. These are the parts that can be tested properly, so
  they are the parts the design pushes logic into.
- **Every new assertion is mutation-tested.** Break the line the test claims to
  cover and confirm that test fails. This has already paid for itself here: a
  mutation that *didn't* fail exposed a guard that was unreachable dead code
  carrying a comment about a bug it could never have fixed.
- **Content presence is tested without the canvas.** Render the React tree in
  jsdom and assert the facts are there as text. WebGL never runs in vitest.
- **Playwright for the things only a browser can answer**: menu overflow at short
  viewports, the presentation cookie round-trip, screenshots.
- Two Playwright gotchas already learned: use `127.0.0.1`, not `localhost`; and
  stub `requestAnimationFrame` via `addInitScript` before navigating to
  `/cinematic`, because SwiftShader raymarches at ~5.6s a frame and blocks the
  compositor, which times out screenshots. The React-rendered DOM stays intact.

---

## 7. Definition of done, per phase

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` — 0 errors (5 warnings are pre-existing: the
      `opengraph-image` `<img>`, three in `CameraDragControls`, and
      `DEFAULT_ELEVATION` in `main.js`)
- [ ] `npm test` green, with new tests for everything this phase claims
- [ ] Every new assertion mutation-tested
- [ ] `npm run build` green, and `/` still `○ (Static)` in the output
- [ ] `?curve=1` run on both devices, appended to `docs/CINEMATIC_MEASUREMENTS.md`,
      no regression against baseline
- [ ] Screenshots at 1440×900 and 430×932
- [ ] The phase's flag can be turned off and the route still renders correctly
- [ ] `CINEMATIC_DECISION.md` updated where the phase decided something, and this
      document updated where it turned out to be wrong
- [ ] Commit and PR in the author's voice, no assistant attribution, local git
      identity

---

## 8. Decisions still open

Bring options and a recommendation; do not resolve these silently.

1. **Where the hero's star sits.** It and the black hole cannot both own the
   centre of the frame, and the framing is already shifted off-centre by
   `COMPOSE_SHIFT`. Blocks phase 6, not phases 1–3.
2. **What the six roleless projects orbit.** `certisafe`, `ipl-score-predictor`,
   `mind-plan`, `portfolio`, `resume-by-ai` and `third-eye-ai` belong to no role.
   That is a true and interesting fact about the work — they are his own — and the
   placement rule should say something true about it rather than invent a fourth
   ring to hide it. Blocks phase 2's rule.
3. **What an empty ring looks like.** `eduskills-aws` references no project.
   Blocks phase 3.
4. **Whether About is a held section or continuous across the fall.** Blocks
   phase 4's timing, not its mechanism.
5. **What `low` gets.** Cannot be decided before phase 7's measurements exist.

---

## 9. Numbers this plan depends on

Counted from the repo, not remembered. Re-count before relying on them.

- **11 projects** in `src/data/projects/`. Five carry a `projectSlug` from a work
  item: `digichikitsak`, `elphie`, `axion`, `healthymitra` (AarogyalinQ) and
  `aude-diagnostics` (Aude.ai). The other six belong to no role.
  *Note: `ROADMAP.md` still says ten and computes several audit figures out of
  ten. Those want re-checking.*
- **3 roles** in `src/data/experience/`; `eduskills-aws` references no project.
- **37 skills** across **5 domains**; each domain carries an `angle` and an
  `accent` in `src/data/skill-web.json`.
- **Journey phases** (viewport units, `main.js:293`): crossingEnd 5.0,
  blackoutEnd 6.5, tunnelEnd 11.5, arrivalEnd 13.0, approachEnd 27.0.
- **Camera distance**: 22.0 at scroll 0 → 2.4 → 1.8 held through the passage →
  30.0 at arrival → ~3.6–5.6 at the end.
- **Elevation** ramps 60° → 2.5° across the fall; **roll** ends at 18°.
- **Benchmark** parks at 0.30 of the approach — the middle of a measured plateau,
  not a guess.
- **Frame time**, Realme 9 Speed Edition: 13.9ms in the tunnel, 152.7ms in the
  fall.
