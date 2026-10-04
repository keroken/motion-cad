import * as THREE from 'three'
import type { ViewGestureEvent } from '../gestures/viewGestureRecognizer'

export class ViewCommandController {
  private startPosition = new THREE.Vector3()
  private startSpherical = new THREE.Spherical()

  apply(event: ViewGestureEvent, camera: THREE.Camera, target: THREE.Vector3) {
    if (event.type === 'view-end') return
    const position = new THREE.Vector3(...event.position)
    if (event.type === 'view-start') {
      this.startPosition.copy(position)
      this.startSpherical.setFromVector3(camera.position.clone().sub(target))
      return
    }

    const horizontal = (position.x - this.startPosition.x) * 0.006
    const vertical = (position.y - this.startPosition.y) * 0.006
    const depth = (position.z - this.startPosition.z) * 0.006
    const spherical = this.startSpherical.clone()
    spherical.theta -= horizontal
    spherical.phi -= vertical
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.12, Math.PI - 0.12)
    spherical.radius = THREE.MathUtils.clamp(this.startSpherical.radius * Math.exp(depth), 3, 15)
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical))
    camera.lookAt(target)
  }
}
