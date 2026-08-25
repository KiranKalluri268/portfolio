# Third-Party Notices

This project includes or derives from the following third-party work. These
notices do not replace the license texts supplied by the respective projects.

Everything below arrived with the black hole journey in `src/cinematic/`, ported
from [portfolio-3D](https://github.com/KiranKalluri268/portfolio-3D). The Starless
entry is the reason this repository is GPL-3.0-or-later rather than MIT — see
`LICENSE` and the note in `docs/CINEMATIC_DECISION.md`.

## Starless by Anton Raskovalov

- Project: <https://github.com/rantonels/starless>
- Copyright: Anton Raskovalov and contributors
- License: GNU General Public License, version 3
- Use here: the accretion-disk texture and referenced/reproduced GLSL rendering
  techniques and formulae.

`public/textures/accretion_disk.png` is derived from the Starless asset and has
been modified. It remains covered by GPLv3, and parts of the GLSL in
`src/cinematic/scene/graphics/fragmentShader.ts` derive from the same source.

**This is the licence obligation that governs the repository.** GPLv3 is
copyleft: a work that derives from it must itself be distributed under the GPL.
The scene is not separable from the site once it ships as part of it, so the
whole of this repository's code is GPL-3.0-or-later.

## Black-hole rendering by Otto Seiskari

- Project: <https://github.com/oseiskar/black-hole>
- Copyright: Otto Seiskari and contributors
- License: MIT
- Use here: black-hole rendering concepts, implementation references, and
  derived formulae.

The MIT license requires preservation of its copyright and permission notice.
See the upstream repository for its complete notice and source history.

## Three.js

- Project: <https://github.com/mrdoob/three.js>
- License: MIT
- Installed as an npm dependency. Three.js example modules are also imported.

## stats.js

- Project: <https://github.com/mrdoob/stats.js>
- License: MIT
- Installed as a development dependency. Used only by the cinematic route's
  optional dev instruments.

## Lenis

- Project: <https://github.com/darkroomengineering/lenis>
- License: MIT
- Installed as an npm dependency.

## GSAP

- Project: <https://github.com/greensock/GSAP>
- License: GreenSock standard "no charge" license for the core and ScrollTrigger
  as distributed on npm.
- Installed as an npm dependency.

## OGL

- Project: <https://github.com/oframe/ogl>
- License: MIT
- Installed as an npm dependency.

## Procedural project assets

The following are generated from original scripts in portfolio-3D
(`scripts/generate_milkyway.py`, `scripts/generate_star_noise.py`) and are not
copied from the former non-commercial Milky Way asset:

- `public/textures/milkyway-preview.jpg`
- `public/textures/star_noise-generated.png`

These files are distributed under GPL-3.0-or-later with the rest of this
project.

## Written content, design and résumé data

Not covered by the GPL. The writing, imagery and portfolio data are licensed
separately — see `LICENSE-CONTENT.md`.
