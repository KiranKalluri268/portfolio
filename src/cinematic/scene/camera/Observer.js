
import * as THREE from 'three';

export class Observer extends THREE.PerspectiveCamera {
  constructor(fov, ratio, near, far) {
    super(fov, ratio, near, far)
    // for orbit
    this.time = 0
    this.theta = 0
    this.angularVelocity = 0
    this.maxAngularVelocity = 0
    this.velocity = new THREE.Vector3()

    this.position.set(0, 0, 1)
    this.direction = new THREE.Vector3();

    // options
    this.moving = false
    this.timeDilation = false

    // Spherical orbit angles — elevation is fixed above disk plane
    this.elevationAngle = 5 * Math.PI / 180  // 5° above disk, always positive
  }

  // sets r and rescales position to new radius
  set distance(r) {
    this.r = r
    this.maxAngularVelocity = 1 / Math.sqrt(2.0 * (r - 1.0)) / this.r
    this.position.normalize().multiplyScalar(r)
  }

  get distance() {
    return this.r
  }

  // Recomputes position, velocity, and direction from current theta + elevationAngle.
  // Called at end of update() and by CameraDragControls after drag input.
  applyOrbitPosition() {
    const sin = Math.sin(this.theta)
    const cos = Math.cos(this.theta)
    const cosElev = Math.cos(this.elevationAngle)
    const sinElev = Math.sin(this.elevationAngle)

    this.position.set(
      this.r * cosElev * sin,
      this.r * sinElev,          // constant positive Y — always above disk
      this.r * cosElev * cos
    )
    // Tangential velocity stays in XZ plane (negated because we reversed orbit direction)
    this.velocity.set(
      -cosElev * cos * this.angularVelocity,
      0,
      cosElev * sin * this.angularVelocity
    )
    // Look-at: always point toward origin — no Euler gimbal, no roll
    this.direction.copy(this.position).negate().normalize()
  }

  update(delta) {
    // apply time dilation to delta time
    if (this.timeDilation) {
      this.delta = Math.sqrt((delta * delta * (1.0 - this.angularVelocity * this.angularVelocity)) / (1 - 1.0 / this.r));
    } else {
      this.delta = delta
    }

    // advance orbit angle (reversed direction)
    this.theta -= this.angularVelocity * this.delta

    if (this.moving) {
      // accel
      if (this.angularVelocity < this.maxAngularVelocity)
        this.angularVelocity += this.delta / this.r
      else
        this.angularVelocity = this.maxAngularVelocity
    } else {
      // decel
      if (this.angularVelocity > 0.0)
        this.angularVelocity -= this.delta / this.r
      else {
        this.angularVelocity = 0
        this.velocity.set(0.0, 0.0, 0.0)
      }
    }

    this.applyOrbitPosition()
    this.time += this.delta
  }

}