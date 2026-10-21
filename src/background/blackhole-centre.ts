import type { BlackholeCamera } from "./baked-blackhole/renderer";

/**
 * Where the drawn black hole's centre is on screen, in CSS pixels from the
 * viewport's top-left, so other things can point at it — the projects
 * carousel's cards come out of it.
 *
 * Written by BakedBlackhole whenever its camera moves, read every frame by
 * whoever wants it. A plain object rather than React state, so neither side
 * re-renders for a number that changes sixty times a second while the camera
 * glides. `drawn` is false while nothing is drawn: the video fallback, the
 * cinematic over the top, or before the first frame.
 */
export const blackholeCentre = { x: 0, y: 0, drawn: false };

/** The centre for a camera on a canvas of this size at this place. The camera
 *  looks straight at the hole, so before the compose shift its centre is the
 *  middle of the frame; the shift moves it by half-screens, x across, y up. */
export function centreOnScreen(
  camera: Pick<BlackholeCamera, "shift">,
  canvas: { left: number; top: number; width: number; height: number },
) {
  return {
    x: canvas.left + ((camera.shift[0] + 1) / 2) * canvas.width,
    y: canvas.top + ((1 - camera.shift[1]) / 2) * canvas.height,
  };
}
