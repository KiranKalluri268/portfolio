# What is left

Work still to do before this portfolio is finished, and the order it makes
sense to do it in. `ARCHITECTURE.md` and the rest of `docs/` describe what the
code *is*; this is what it is *not yet*.

Two kinds of entry live here: things Saikiran has decided he wants, and things
found while building something else and deliberately not fixed at the time.
Both are listed with what they actually involve, because "make the carousel
smoother" is a sentence and a week is a week.

---

## The list

### 1. Audit the content

Images, live-demo links, GitHub links, the written copy — read all of it, check
all of it, fix what is stale.

This is a chore and it is also the only item that can make the site *wrong*
rather than merely unfinished. Everything else here is polish on top of
content; a dead demo link or a stale claim is the one failure a reader will
actually hold against it.

Worth doing as part of it:

- Every `liveUrl` and `repositoryUrl` in `src/data/projects/*.json`, followed by
  hand. A 404 behind "Open live project" is worse than no link.
- Project images: five projects have none. They are not broken without one —
  `ProjectThumbnail` draws a monogram from the title on a warm gradient panel,
  so the grid stays even — but a real screenshot says more than "AX" does.
- `showInResume`, `showInProjectsSection` and `featured` flags — they decide
  three different things and nothing checks they still say what is meant. Note
  that no project is currently "personal" on the grid's colour key, because
  every project outside a role happens to be flagged into the projects section.
- The résumé and CV read differently from the case studies by design; both need
  reading in their own right, not skimmed against each other.

Cannot be done without Saikiran: every fact in it is his. The gaps that can be
found without him are listed below.

#### What is missing, as of this writing

Counted from `src/data/**`, not guessed:

- **Five of ten projects have no image**: `aude-diagnostics`, `axion`,
  `digichikitsak`, `elphie`, `healthymitra`. They fall back to a generated
  monogram panel rather than a hole, so the pages read as finished; the gap is
  that a screenshot of the actual work would say far more. These are exactly
  the five built inside a role, so every green card on the grid's colour key is
  a monogram.
- **Two of ten have a live link** (`certisafe`, `third-eye-ai`) and **three have
  a repository link**. For the five work projects that is policy, and the page
  already says so in his voice. `mind-plan` and `resume-by-ai` have neither and
  are his own, which reads as a gap rather than a decision; `ipl-score-predictor`
  has a repository but no demo.
- **Two of ten have outcomes.** The outcome tiles on a case study render from
  `outcomes`, so eight case studies show nothing there.
- **No project has a gallery.** `gallery` is empty in all ten, so that part of
  the case-study template never appears.
- **No work item has an `impact`.** Zero across all nine work items in the three
  roles.
- **`eduskills-aws` is thin**: one work item and one skill, against four work
  items and seven to twelve skills for the other two roles.
- **Three skills have no brand mark**: `deep-learning`, `mobile-development`,
  `rag`. They fall back to initials in the marquee and on their own page, which
  is the same thing that was reported and fixed for other skills earlier.
- **`flutter`'s "how I learned" is about half the length of every other skill's**
  (42 characters against a median of 71).
- **Every link needs opening by hand.** They cannot be checked from inside the
  build environment, which has no outbound network.

One decision rather than a gap: `resume.json` publishes a phone number, a
personal email and a home address to a public page. That is normal on a résumé
handed to a recruiter and a different thing on a web page that anyone can
scrape. Worth deciding deliberately rather than by default.

### 2. Sort out the background music

Two separate things wearing one hat, and they should be split.

**The licence, first and on its own.** The current track may not be licensed
for this use. That is a risk that grows with traffic and it is cheap to close:
replace it with something clearly licensed, or get a licence. Until then the
site is quietly carrying a problem that no amount of design work offsets.

**Section-aware music, second and much later.** One track per scene, crossfaded
as the visitor moves. This is a real feature: it needs the tracks to exist, to
be licensed, to be short enough to loop without irritating, and it needs a
crossfade that survives fast scrolling between sections. `AudioContextProvider`
currently holds one `<audio>` element and a boolean; this would replace it.

### 3. Make the carousel feel smoother

The pinned projects carousel on the home page. It is the most-travelled
interaction on the site — everyone scrolling the page goes through it, where
`/projects` and `/skills` are opt-in.

Before touching it, read `docs/ANIMATIONS.md` and the traps section of
`CLAUDE.md`. Scroll has one owner here: vertical scroll drives the track
through ScrollTrigger, and nothing else may transform it or hold a second
source of truth. The momentum on touch also depends on an internal Lenis flag
(`lenisStopPropagation`), which no unit test covers — it has to be re-checked
on a real touch device after any Lenis upgrade.

"Smoother" needs pinning down before it is work: it could mean the easing
between panels, the feel of a flick, how it behaves when someone scrolls fast
through the whole section, or the moment it hands back to vertical scrolling at
the end. Those are four different changes.

### 4. Update the skill web

`/skills` is already an interactive map, so this is not a rebuild.

The weaker half is what happens *after* someone clicks a node: `/skills/[slug]`
is where the payoff should be and it has never been looked at properly. Worth
auditing that before more work goes into the map itself — a better map that
leads somewhere thin is a worse experience than a plain one that leads
somewhere good.

### 5. Sound effects for interactions

Clicks, hovers, the entry animation, the menu opening, cards coming into focus.

**Deliberately last.** Every interaction added or changed after this needs its
own sound, so doing it before the interactions have settled means doing it
twice. It is also the item most able to make the site worse if it is even
slightly overdone, and the one most likely to need a mute affordance that is
findable in the first two seconds — the audio toggle already exists, so sound
effects should respect it rather than introduce a second control.

---

## Also worth doing

Found while building other things, and left alone at the time rather than
quietly folded into an unrelated change.

### The projects grid leaves a band at the top and bottom

On 1280x860, 1080x820 and 402x860 the field stops short of the top and bottom
edges of the screen. Measured the same before and after the ring budget was cut
from 4.2 to 3.2, so it is not a regression from that — it is the vertical warp
not being scaled against the viewport's aspect ratio. Small, understood, and
visible on the page as it stands.

### The skill web runs at about 51fps while it is just sitting there

Not the entry animation — the page at rest, once everything has arrived.
Measured over 11 seconds on a desktop Chromium at 1280x860: 557 frames where
the résumé page manages 661, a p90 frame of 33.3ms against 16.7ms, and no long
JavaScript task anywhere in the trace. It is paint, not script.

It takes two things together, and removing either one fixes it:

- the animated starfield canvas behind the web, which invalidates the screen
  every frame;
- `backdrop-filter` on all fifty-eight nodes, which means every one of those
  invalidations re-blurs fifty-eight regions.

With the canvas hidden: 597 frames, p90 16.8ms. With the blur off the nodes:
619 frames, p90 16.7ms. Neither alone is the cost; the combination is. This is
the same finding that made the entry animation drop its blur while it builds,
except that this one applies for as long as the page is open.

Left alone deliberately, because the fix is a design decision rather than a
patch: drop the blur on the leaves, stop the starfield on this page, or accept
it. Worth pairing with the accessibility pass, since both are one sweep over
what the page costs rather than a change to what it does.

### The site header's height is written out in several places

Since the header moved into the layout, four things have had to be told how
tall it is by hand: `/projects`, the résumé, the CV, and the skill directory.
The numbers (`56px` on a phone, `96px` above) are repeated as Tailwind classes
with nothing keeping them in step. A fifth page will need the same treatment,
and the first time the header's padding changes, all of them will be wrong at
once. One shared token would end that.

### Safari is covered, but check each new effect there as it lands

Saikiran has been reviewing on iOS and iPadOS Safari throughout, so this is not
an outstanding risk. It stays written down because the automated checks in this
repo are all Chromium, and the features leaned on hardest are the ones that
diverge most: `backdrop-filter`, `clip-path` transitions, canvas
`destination-out` compositing, `100dvh`, and a transparent video that already
ships a Safari-specific `.mov` alongside the `.webm`. Anything new in that list
wants a look on a real device before it is called done — a passing Chromium
screenshot is not evidence about Safari.

### The menu has room it is not using

Five words on a grey field. It could carry contact links, or where you
currently are, or something of the black hole. Deliberately left bare rather
than filled with invented content.

### FAQ and a 3D version

Both were left out of the site menu because neither exists. The menu takes one
line per entry once they do. The FAQ needs real questions and real answers —
its content cannot be generated. The 3D version is a project, not a task.

### An accessibility pass, done once and properly

Contrast has been fixed reactively — the menu's index numbers, the colour key —
each time something else changed underneath it. A single pass over every
surface, with numbers, would find the rest: focus visibility on dark
backgrounds, reduced-motion behaviour in the older components (the newer ones
all define it), and whether the reading order still matches the visual order on
the pages that have grown fixed overlays.

---

## Suggested order

1. **Audit the content.** It gates the meaning of everything else, it is the
   only item that can make the site wrong rather than unfinished, and it is the
   one nobody else can do.
2. **Replace the music with something licensed.** Not the section-aware
   feature — just close the risk. It is an afternoon.
3. **The two small known bugs**: the grid's band, and a shared token for the
   header's height. Both are understood, both are cheap, and the second one
   stops the next page from inheriting the problem.
4. **Check it on a real iPhone.** Do this before more building, not after —
   anything Safari breaks is cheaper to find now than to find in three more
   features' worth of code.
5. **The carousel.** Highest traffic of the remaining polish. Decide first
   which of the four "smoother"s is meant.
6. **The skill detail pages, then the web.** In that order: the destination
   before the map.
7. **Section-aware music.**
8. **Sound effects.** Last, because everything above adds or changes
   interactions that would each need one.

The accessibility pass fits anywhere after the content audit, and is best done
in one sitting rather than spread out. The menu's contents and the FAQ are
blocked on decisions and material rather than on time, so they can be picked up
whenever those exist.
