# Resume Serif

A subset of CMU Serif (Computer Modern Unicode) used by `/resume` and
`/resume/ai`, on the page and in the downloaded PDF.

- Source: `computer-modern@0.1.3` on npm (`fonts/cmu-serif-{500,700}-{roman,italic}.ttf`).
- Subset to Basic Latin, Latin-1, general punctuation, €, ™, → and − with
  fontTools, keeping `kern` and `liga`.
- The ASCII `~` glyph is moved down onto the maths axis (the centre of `+`).
  CMU draws it as a raised accent, so "~3 minutes" read as a macron; LaTeX
  sets it as `\sim`, and copied text still comes out as `~`.
- Renamed to "Resume Serif": a subset is a modified version under the SIL Open
  Font License, which may not use the Reserved Font Name. See `OFL.txt`.
