/**
 * Convert portfolio-3D's fragmentShader.glsl into the TypeScript module this
 * repo imports.
 *
 * Shader tuning happens in portfolio-3D, where the Vite dev server, lil-gui and
 * a tight visual loop are. What lands here is the settled result. There it is a
 * .glsl file that Vite reads with `?raw`; here it has to be a string, because
 * Turbopack has no equivalent that works (see the note at the top of the
 * generated file), and a string behaves the same in dev, in the build and in
 * Vitest with no configuration at all.
 *
 * That conversion is the one thing standing between the two copies, so it is a
 * script rather than a chore. Run it after retuning the shader:
 *
 *   node scripts/port-shader.mjs ../../portfolio3D/src/graphics/fragmentShader.glsl
 *
 * It only escapes what a template literal cannot hold - backslashes, backticks
 * and ${ - so the GLSL itself is untouched and the diff against the lab's
 * version stays readable.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Two levels up from scripts/, not three. The lab sits beside this repo inside
// the same Portfolio folder — Portfolio/my-portfolio and Portfolio/portfolio3D —
// so a third `..` climbs out of Portfolio entirely and looks for the lab
// somewhere it has never been. The script then prints its "could not read the
// shader" help and exits 1, which reads like a missing lab rather than a wrong
// default, so the fix is to pass the path by hand and the default stays broken.
const DEFAULT_SOURCE = resolve(here, "../../portfolio3D/src/graphics/fragmentShader.glsl");
const TARGET = resolve(here, "../src/cinematic/scene/graphics/fragmentShader.ts");

const source = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DEFAULT_SOURCE;

let glsl;
try {
  glsl = readFileSync(source, "utf8");
} catch {
  console.error(`Could not read the shader at:\n  ${source}\n`);
  console.error("Pass the path explicitly if portfolio-3D lives somewhere else:");
  console.error("  node scripts/port-shader.mjs <path-to-fragmentShader.glsl>");
  process.exit(1);
}

// Order matters: backslashes first, or the escapes added below get escaped too.
const escaped = glsl
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

const header = `// The black hole raymarcher. Generated - do not edit by hand.
//
// Tuned in portfolio-3D as fragmentShader.glsl, where Vite reads it with
// \`?raw\`, and brought across by scripts/port-shader.mjs. Edit it there and
// re-run the script; anything changed here is lost on the next port.
//
// It is a string rather than a .glsl file because Turbopack has no import that
// survives contact with one. Its \`type: "raw"\` rule produces a module with no
// ES namespace, so the import arrives as undefined and the shader compiles as
// the literal text "undefined" - which fails at the GPU driver rather than at
// the build, so the page loads, the canvas appears, and only the console says
// why the frame is black. A webpack raw-loader through import attributes would
// work, at the cost of a build dependency in a production site, and Vitest
// would still need telling separately. A string needs none of that.

export const fragmentShader = \``;

writeFileSync(TARGET, `${header}${escaped}\`;\n`, "utf8");

const backticks = (glsl.match(/`/g) || []).length;
const interpolations = (glsl.match(/\$\{/g) || []).length;
console.log(`Ported ${glsl.length} bytes of GLSL -> ${TARGET}`);
console.log(`Escaped ${backticks} backtick(s) and ${interpolations} \${ sequence(s).`);
