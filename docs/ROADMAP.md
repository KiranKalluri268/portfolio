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
- Project images: several are placeholders, and the projects grid shows a
  "NOT AVAILABLE" card for anything without one.
- `showInResume`, `showInProjectsSection` and `featured` flags — they decide
  three different things and nothing checks they still say what is meant. Note
  that no project is currently "personal" on the grid's colour key, because
  every project outside a role happens to be flagged into the projects section.
- The résumé and CV read differently from the case studies by design; both need
  reading in their own right, not skimmed against each other.

Cannot be done without Saikiran: every fact in it is his.

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

### The site header's height is written out in several places

Since the header moved into the layout, four things have had to be told how
tall it is by hand: `/projects`, the résumé, the CV, and the skill directory.
The numbers (`56px` on a phone, `96px` above) are repeated as Tailwind classes
with nothing keeping them in step. A fifth page will need the same treatment,
and the first time the header's padding changes, all of them will be wrong at
once. One shared token would end that.

### Nothing has been checked in Safari

Every screenshot and measurement in this repo's recent history was taken in
Chromium. The features leaned on hardest are exactly the ones that diverge
most: `backdrop-filter`, `clip-path` transitions, canvas `mask`/`destination-out`
compositing, `100dvh`, and a transparent video that already ships a
Safari-specific `.mov` alongside the `.webm`. An hour on a real iPhone is worth
more than another day of Chromium screenshots.

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
