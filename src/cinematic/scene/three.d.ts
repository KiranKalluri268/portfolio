// three 0.148 ships no type declarations of its own, and `@types/three` is not
// installed. Nothing here needed it until now: the whole cinematic scene is
// untyped JavaScript, so the only TypeScript that touches three is the test for
// composeShift.js, which builds a real PerspectiveCamera rather than a stand-in
// because the point of that test is to agree with three's actual projection
// matrix and not with a reimplementation of it.
//
// Scoped to the scene directory deliberately. If three is ever used from typed
// application code, install the real types and delete this — a shim that makes a
// widely used library `any` across the app would hide more than it helps.
declare module 'three';
