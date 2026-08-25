// The `@ts-nocheck` that heads this file in portfolio-3D is dropped here: this
// repo does not type-check .js at all (no `checkJs`, and tsconfig's `include`
// covers only .ts and .tsx), so it suppressed nothing and tripped the lint rule
// against it.
import * as THREE from 'three'
import { Observer } from './Observer';

/**
 * @param {HTMLElement | Document} domElement
 * @returns {domElement is HTMLElement}
 */
function isHTMLElement(domElement) {
  return domElement !== document;
}

/**
 * Orbit-style drag controls — drag orbits the camera around the black hole.
 * Horizontal drag changes azimuth (theta), vertical drag changes elevation.
 * Direction is always computed as normalize(-position) via observer.applyOrbitPosition(),
 * so there is zero gimbal/roll regardless of orbit angle.
 *
 * Touch support:
 *  - Single finger HORIZONTAL swipe → orbit (same as mouse drag, always active on mobile)
 *  - Single finger VERTICAL swipe   → falls through to browser scroll → triggers zoom
 *  - Two finger PINCH               → drives window.scrollBy() for zoom
 *
 * @member {HTMLElement} domElement
 */
export class CameraDragControls {

  /**
   * @param {Observer} observer
   * @param {HTMLElement} domElement
   */
  constructor(observer, domElement) {
    this.domElement = (domElement !== undefined) ? domElement : document;
    this.observer = observer;
    // up stays as world-Y (0,1,0) — look-at handles orientation, no tilt needed

    this.enabled = true;
    this.eventController = new AbortController();
    this.eventSignal = this.eventController.signal;

    this.lookSpeed = 0.005;
    this.pinchScrollSpeed = 2.5; // how aggressively pinch maps to scroll

    // Mouse state
    this.offsetX = 0
    this.offsetY = 0
    this.lastX = 0
    this.lastY = 0
    this.mouseDragOn = false

    // Touch state
    this.touchDragOn = false
    this.touchAxisLocked = null  // 'horizontal' | 'vertical' | null (determined on first move)
    this.lastTouchX = 0
    this.lastTouchY = 0
    this.pinchStartDist = 0

    this.viewHalfX = 0
    this.viewHalfY = 0

    if (isHTMLElement(this.domElement)) {
      this.domElement.setAttribute('tabindex', '-1');
    }

    this.addMouseEventHandlers();
    this.addTouchEventHandlers();
    this.handleResize();
  }

  handleResize() {
    if (!isHTMLElement(this.domElement)) {
      this.viewHalfX = window.innerWidth / 2;
      this.viewHalfY = window.innerHeight / 2;
    } else {
      this.viewHalfX = this.domElement.offsetWidth / 2;
      this.viewHalfY = this.domElement.offsetHeight / 2;
    }
  }

  update(delta) {
    if (this.enabled === false) return;

    if (this.mouseDragOn) {
      // Horizontal drag → orbit azimuth (theta) around the black hole
      this.observer.theta -= this.lookSpeed * this.offsetX

      // Vertical drag → elevation angle (clamp to avoid poles)
      this.observer.elevationAngle = Math.max(
        2 * Math.PI / 180,
        Math.min(
          80 * Math.PI / 180,
          this.observer.elevationAngle - this.lookSpeed * this.offsetY
        )
      )

      this.offsetX /= 2;
      this.offsetY /= 2;
    }

    // Touch horizontal drag → always active on mobile (no GUI toggle needed)
    if (this.touchDragOn && this.touchAxisLocked === 'horizontal') {
      this.observer.theta -= this.lookSpeed * this.offsetX
      this.offsetX /= 2;
    }

    // Recompute position + direction with latest theta + elevation
    this.observer.applyOrbitPosition()
  }


  // ─── Mouse handlers ──────────────────────────────────────────────────────

  addMouseEventHandlers() {
    this.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    }, { signal: this.eventSignal });

    this.domElement.addEventListener('mousemove', (event) => {
      if (this.mouseDragOn) {
        let newX, newY;
        if (!isHTMLElement(this.domElement)) {
          newX = event.pageX - this.viewHalfX;
          newY = event.pageY - this.viewHalfY;
        } else {
          newX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
          newY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
        }

        this.offsetX = newX - this.lastX;
        this.offsetY = newY - this.lastY;
        this.lastX = newX;
        this.lastY = newY;
      }
    }, { signal: this.eventSignal });

    this.domElement.addEventListener('mousedown', event => {
      if (isHTMLElement(this.domElement)) {
        this.domElement.focus();
      }
      event.preventDefault();
      event.stopPropagation();
      this.mouseDragOn = true;
      if (!isHTMLElement(this.domElement)) {
        this.lastX = event.pageX - this.viewHalfX;
        this.lastY = event.pageY - this.viewHalfY;
      } else {
        this.lastX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
        this.lastY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
      }
    }, { signal: this.eventSignal });

    this.domElement.addEventListener('mouseup', (event) => {
      event.preventDefault();
      event.stopPropagation();

      this.mouseDragOn = false;
      this.offsetX = 0;
      this.offsetY = 0;
    }, { signal: this.eventSignal });
  }


  // ─── Touch handlers ───────────────────────────────────────────────────────

  addTouchEventHandlers() {
    this.domElement.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        // Single finger — record start, axis not yet determined
        this.touchDragOn = true;
        this.touchAxisLocked = null;
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
        this.offsetX = 0;
      } else if (event.touches.length === 2) {
        // Two fingers — pinch start
        this.touchDragOn = false;
        this.pinchStartDist = this._pinchDist(event.touches);
      }
    }, { passive: true, signal: this.eventSignal });

    this.domElement.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2) {
        // ── Pinch → zoom via scrollBy ──────────────────────────────────────
        const dist = this._pinchDist(event.touches);
        const delta = this.pinchStartDist - dist; // positive = fingers closing = zoom in
        window.scrollBy(0, delta * this.pinchScrollSpeed);
        this.pinchStartDist = dist;
        return; // don't process as drag
      }

      if (!this.touchDragOn || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - this.lastTouchX;
      const dy = touch.clientY - this.lastTouchY;

      // Determine axis on first meaningful movement
      if (this.touchAxisLocked === null && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        this.touchAxisLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (this.touchAxisLocked === 'horizontal') {
        // Intercept horizontal swipe → orbit
        event.preventDefault();
        this.offsetX = dx;
      }
      // Vertical → do nothing, browser scrolls the page → zoom via scroll formula

      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
    }, { passive: false, signal: this.eventSignal }); // passive:false needed to allow preventDefault on horizontal

    this.domElement.addEventListener('touchend', () => {
      this.touchDragOn = false;
      this.touchAxisLocked = null;
      this.offsetX = 0;
    }, { passive: true, signal: this.eventSignal });
  }

  dispose() {
    this.eventController.abort();
  }

  /** Returns distance between two touch points */
  _pinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

}
