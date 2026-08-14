# Merging the black hole simulation into this site

A guide for combining this repository with the separate three.js black hole
project, and for adding physicality to the sections that do not have it yet.

This is not a plan to follow step by step. It is the set of things that decide
whether the result works, written down before the decisions get made by accident.

## Where this repository stands today

Three WebGL scenes, all built on [OGL](https://github.com/oframe/ogl):

| Scene | Route | Created |
| --- | --- | --- |
| `ProjectsGridGL` | `/projects` | on mount |
| `ProjectsStack` | `/projects` | first time the list view is opened |
| `HomeProjectsRow` | `/` | on mount |

So `/projects` holds up to two live contexts and the home page one. Everything
else that looks like graphics is canvas 2D, not WebGL: `StarsBackground`
(mounted in `layout.tsx`) and the entry screen in `LoadingScreen`.
`SpaceBackground` is not imported anywhere — decide whether it is being kept
before building on top of it.

All three scenes share a shape worth knowing before adding a fourth:

- Cards are composed in a 2D canvas by `stack-card.ts` and uploaded as textures.
  The wide card's texture is 1392×882.
- No scene keeps drawing for nothing, but each decides that differently, and a
  new one has to choose deliberately. `HomeProjectsRow` stops when an
  `IntersectionObserver` says it is off screen. `ProjectsStack` stops while the
  grid view is the one showing. `ProjectsGridGL` stops once the scene has come
  to rest, which is about being *static* rather than about being *visible* — it
  is the whole page on its route, so it is always on screen and would idle
  forever otherwise.
- Every scene releases its context on teardown, and rebuilds itself if the
  browser takes one away (`useGlRecovery`).
- Motion is eased per second, never per frame. A 120Hz display must not move
  half as far, or bend half as hard. The row and the stack state their constants
  against 60Hz and divide by `gsap.ticker.deltaRatio(60)`; the grid works in
  elapsed seconds directly (`FRICTION_PER_SECOND ** elapsed`). Either is fine.
  A bare per-frame lerp is not.

## The decision that shapes everything else: how many contexts

**One.** Decide it now, before the shape of the code makes it hard.

A WebGL context is the live connection between one `<canvas>` and the GPU. It
owns everything uploaded to it — textures, buffers, compiled shaders. Two facts
about them drive this decision:

**Browsers cap how many can be alive at once.** The limit is on the order of
eight to sixteen and varies by browser. Exceeding it does not fail: the browser
silently destroys the *oldest* context to make room. A page that creates one too
many does not see an error, it sees an unrelated section somewhere else go blank.

**One context can draw as much as you like.** There is no need for a context per
section. A single full-viewport canvas can draw the black hole and every
section's geometry — as one scene with a camera that moves, or as several scenes
rendered in turn through the same renderer. Section-level effects become meshes
in a scene that already exists, not new canvases.

The current three contexts are already worth consolidating. Adding a persistent
background makes it four, and the plan adds more after that.

## three.js or OGL, not both

Shipping both means shipping two WebGL runtimes, two scene graphs, two material
systems, and two sets of conventions for the same job.

OGL is deliberately minimal, which is why the scenes here are written directly
against WebGL concepts — shaders are strings in the component, and there is no
postprocessing to speak of. three.js is substantially larger but brings the
ecosystem a black hole simulation is likely already using: `EffectComposer`,
postprocessing passes, loaders, controls.

Measure before deciding rather than guessing:

```bash
npx next build            # per-route First Load JS is in the output table
```

Take the numbers for `/` and `/projects` now, then again after the merge. A
raymarched black hole is unlikely to be worth porting off three.js by hand, so
the realistic choice is usually "move the sections to three.js" rather than the
reverse. Whichever wins, finish the migration. Two runtimes shipped side by side
is the worst of the options.

## The black hole is bound by pixels, not by complexity

This is the single most important performance fact in the merge.

Most WebGL cost scales with how much you draw — meshes, draw calls, state
changes. A raymarched black hole does not. Its cost is *per pixel*, because
every pixel runs a loop that steps a ray through curved space. Doubling the
window's area doubles the work. Adding more geometry to the scene barely
changes it.

Two consequences:

- It will be the most expensive thing on the page by a wide margin, and it will
  be worst on exactly the devices this version is meant to serve — phones have
  high pixel ratios and weak fill rate.
- It is also the easiest thing to make cheap, because rendering it at a fraction
  of the resolution and scaling the result up costs almost nothing in fidelity
  for a soft, glowing subject. **Render the black hole to a smaller framebuffer,
  not to the screen.** Half resolution is a quarter of the work.

Treat that resolution factor as the main quality dial for the whole page.

## Quality tiers: measure, do not sniff

The intent — this version for older and less powerful devices — is right. The
usual way of implementing it is not.

User-agent sniffing ages badly and is wrong constantly: it cannot tell a current
midrange phone from a flagship, and it says nothing about whether the device is
hot, throttled, or on battery saver. `navigator.hardwareConcurrency` and
`deviceMemory` are weak proxies and `deviceMemory` is not available everywhere.

Do this instead:

1. Start at the lowest tier. First paint is the moment that matters most and the
   one you cannot recover.
2. Measure real frame time for a second or two once the scene is running.
3. Step up a tier only while the measurement holds, and step back down if it
   stops holding.

The worst case is then a page that looks simpler than it could have, never one
that stutters. Tiers should differ by render resolution and effect count, not by
whether the content is there — every tier shows the same projects, the same
words, the same links.

Also honour `prefers-reduced-motion` at every tier. Every scene here already
does; a new one that does not is a regression.

## What could go wrong

**A context is lost and the page goes dark.** The browser takes contexts back
for reasons that have nothing to do with the page: driver resets, the system
reclaiming graphics memory, a laptop switching between its two GPUs, a phone
backgrounding the tab. Today that costs one section. With a background behind
everything, it costs the whole site.

`useGlRecovery` handles this, and two details in it are easy to get wrong when
writing a new scene:

- **The lost event must be cancelled.** A `webglcontextlost` that nobody calls
  `preventDefault()` on is never followed by a `webglcontextrestored`. Miss this
  line and the canvas stays blank for good.
- **The teardown must not release the context when the teardown is the rebuild.**
  Recovery re-runs the scene's effect, which runs its cleanup — and a cleanup
  that calls `loseContext()` unconditionally throws away the very context it is
  about to draw into.

**GPU memory runs out and the tab is killed.** Textures live on the GPU until
deleted. This has already bitten once here: the projects grid held 54 MB of
textures until they were drawn at half resolution, which brought it to 13 MB.
A phone with shared graphics memory does not get slow when you overrun it, it
dies. Budget textures explicitly, and prefer one atlas over many separate
uploads.

**Scroll gains a second owner.** The most expensive trap in this repository, and
it gets worse with more scenes. Vertical scroll position drives the pinned
carousel through ScrollTrigger, and also the scene indicator, `?section=` deep
links, and the arrow controls. `HomeProjectsRow` reads the pin's progress as a
*target* and eases towards it — the lag is where its sense of speed comes from —
but it never writes scroll. A background that scrubs on scroll must do the same.
Nothing may hold a second source of truth. See `docs/ANIMATIONS.md`.

**The pin breaks because something became a containing block.** A CSS transform
makes an element a containing block, which re-anchors any `position: sticky`
inside it and breaks a ScrollTrigger pin outright, since a pin works by
`position: fixed`. A full-viewport background canvas is a likely place for a
stray transform to be added for positioning. Use `inset: 0` rather than a
translate.

**Text quietly stops being text.** The thing that makes this plan sound is that
the physicality goes *behind and around* the content, not into it. The moment a
paragraph is rendered into a texture it stops being selectable, searchable,
translatable, zoomable and readable by a screen reader, and you end up writing
the page twice — once as textures and once as hidden markup to carry the meaning.
The projects carousel is already at the limit of what is reasonable here: its
cards are pixels, so the section publishes a hidden list to carry the content.
Do not extend that pattern to sections whose content *is* the text.

**Everything becomes the same effect.** Physicality per section is the goal, not
one animation applied six times. The bend in the carousel works because a row of
cards is the kind of thing that can sit on a cylinder. A paragraph is not. This
was already tried the lazy way — a velocity-driven skew across the whole home
page — and it failed, because the feel never came from "something driven by
velocity", it came from objects that can plausibly exist in three dimensions.

**Two libraries, two loops.** GSAP's ticker already drives Lenis and every scene
here. A second library bringing its own `requestAnimationFrame` loop means two
clocks, and frame-order bugs that only appear under load. Drive everything from
the one ticker.

**It looks right and is not.** The overlay text in the carousel was written to
follow its card, passed review, and did nothing at all for the life of the page —
the limit on how far it could travel was measured before the text it measures
existed. It was checked at rest, where the correct answer is zero, and on a
phone, where the correct answer is also zero. It only failed on a wide screen, in
motion. Check the state the effect is *for*, not the state that is easy to
screenshot.

## Doing it properly

**1. Consolidate onto one renderer and one context first.**
Before any new visuals. Move `ProjectsGridGL`, `ProjectsStack` and
`HomeProjectsRow` onto a shared renderer, or accept the cost of porting them to
whichever library wins. Doing this after the background exists means doing it
under pressure.

**2. Put the background in the layout, not in a page.**
It has to survive route changes, or every navigation destroys and rebuilds a
simulation. `StarsBackground` is already mounted in `layout.tsx` and is the
right precedent. Decide at the same time what happens to the canvas 2D
starfield: two background systems drawing stars is one too many.

**3. Give it a resolution dial from the first commit.**
Not as a later optimisation. If the black hole renders to a framebuffer whose
size is a settable fraction of the viewport, tiering is a number; if it renders
straight to the screen, tiering is a rewrite.

**4. Make one section physical, and stop.**
The skills marquee is the strongest candidate: it is already a moving strip of
brand marks, which is the most card-like thing left. Ship it, look at it on the
old phone, and only then decide whether the pattern deserves a third outing.

**5. Keep the content in the DOM.**
Every section's text, links and form fields stay as markup. WebGL adds
physicality behind and around them. This is what makes the whole plan viable —
and it is worth re-reading whenever a section starts to feel like it would be
easier as a texture.

**6. Measure on the real device at each step.**
Not at the end. Frame time on the old phone is the acceptance criterion, and it
is the only one that cannot be inferred from a development machine — nor from
the containers these changes are usually verified in, which have no GPU at all
and rasterise WebGL on the CPU.

## Verifying WebGL work

**Context loss can be tested directly.** The extension that reports it can also
cause it, so recovery does not have to be taken on trust:

```js
const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
const ext = gl.getExtension("WEBGL_lose_context");
ext.loseContext();      // canvas goes transparent, contextlost fires
ext.restoreContext();   // only works if the lost event was cancelled
```

Assert that the scene draws again *and* still works — that it responds to input
and navigates — not merely that `isContextLost()` came back false.

Note that a page here has canvases that are not WebGL. Asking a 2D canvas for a
WebGL context returns `null`, so select the canvas by testing for a context
rather than by document order.

**There is no unit-test coverage for any of this.** jsdom has no WebGL, so
nothing in the test suite exercises a shader, a texture or a context. Every
guarantee about these scenes comes from a real browser at a real viewport.
Chromium is at `/opt/pw-browsers/chromium`; pass it as `executablePath` and do
not run `playwright install`.

**Prove the frame loop is alive, not just that pixels exist.** A screenshot
cannot distinguish a live loop from a frozen last frame. Assert on something the
loop writes every frame — the carousel's overlay transform is used for exactly
this.
