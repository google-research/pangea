/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Environment utils.
 * @suppress {missingRequire}
 */

import {argmin, keymin} from './utils.js';

/**
 * @typedef {!Object} Panorama A panoramic viewpoint.
 * @property {!string} id Panorama id.
 * @property {!THREE.Matrix4} exmat Extrinsic matrix.
 * @property {!Array<string>} urls Images that make up this panorama. The number
 *     of images must match the `geometry` of the panorama. Cubemap projections
 *     contain 6 images (the sides of a cube) while equirectangular projections
 *     only contain 1 (the flattened cylinder).
 * @property {?Array<!THREE.MeshBasicMaterial>} materials The mesh materials
 *     that make up this panorama. Optional, used as an internal cache.
 * @property {!Array<string>} navigable Navigable neighbor panoramas.
 * @property {?Array<string>} visible Visible neighbor panoramas. Optional,
 *     defaults to the navigable neighbors.
 * @property {?THREE.Vector3} curpos The position to render the cursor when the
 *     mouse is targetting this panorama. Optional, defaults to the position of
 *     of the camera (eye-level). The floor-level position is a good
 *     alternative if the height of the camera is known. This property is only
 *     used by Navigators, since an Environments do not have cursors.
 */

/**
 * @typedef {!Object} Snapshot An environment snapshot.
 * @property {!string} id Panorama id.
 * @property {!THREE.Matrix4} exmat Extrinsic matrix.
 * @property {!THREE.Matrix4} inmat Intrinsic matrix.
 */

/**
 * An environment is a class for manipulating a graph of panoramic viewpoints.
 * It maintains a Three.js camera and scene and buffers panoramic textures.
 */
export class Environment {
  /**
   * Environment constructor.
   * @param {!Array<!Panorama>} panos Panoramas in the environment.
   * @param {!THREE.Geometry} geometry The geometry of the panoramas in `panos`.
   *     Cubemap projections use THREE.BoxGeometry while equirectangular
   *     projections use THREE.SphereGeometry. Make sure the radius of this
   *     geometry is sufficiently big as not to clip any visible objects.
   */
  constructor(panos, geometry) {
    /** @type {!Array<!Panorama>} */
    this.panos = panos;
    /** @type {!THREE.Scene} */
    this.scene = new THREE.Scene();
    /** @type {!THREE.PerspectiveCamera} */
    this.camera = new THREE.PerspectiveCamera();
    this.scene.add(this.camera);
    /** @type {!THREE.Mesh} */
    this.bubble = new THREE.Mesh(geometry);
    this.bubble.matrixAutoUpdate = false;
    this.scene.add(this.bubble);
    /** @type {string | null} */
    this.sourceId;
  }

  /**
   * Gets an environment snapshot.
   * @return {!Snapshot}
   */
  getSnapshot() {
    return {
      id: this.sourceId,
      exmat: this.camera.matrix.toArray(),
      inmat: this.camera.projectionMatrix.toArray(),
    };
  }

  /**
   * Sets an environment snapshot.
   * @param {!Snapshot} snapshot
   */
  async setSnapshot(snapshot) {
    await this.setPanorama(snapshot.id);
    new THREE.Matrix4()
        .fromArray(snapshot.exmat)
        .decompose(
            this.camera.position, this.camera.quaternion, this.camera.scale);
    this.camera.projectionMatrix.fromArray(snapshot.inmat);
    this.camera.projectionMatrixInverse.getInverse(
        this.camera.projectionMatrix);
  }

  /**
   * Gets the pano info.
   * @param {string} id Panorama id.
   * @return {!Panorama}
   */
  getPanorama(id) {
    const pano = this.panos.find((pano) => {
      return pano.id === id;
    });
    if (!pano) {
      throw new Error(`Panorama ${id} not found`);
    } else {
      return pano;
    }
  }

  /**
   * Gets the pano extrinsic matrix.
   * @param {string} id Panorama id.
   * @return {!THREE.Matrix4}
   */
  getExmat(id) {
    const mutable = this.getPanorama(id).exmat;
    return mutable.clone();
  }

  /**
   * Gets the pano position.
   * @param {string} id Panorama id.
   * @return {!THREE.Vector3}
   */
  getPosition(id) {
    const exmat = this.getExmat(id);
    return new THREE.Vector3().setFromMatrixPosition(exmat);
  }

  /**
   * Gets the pano closest to a position.
   * @param {!THREE.Vector3} pos
   * @return {string} Panorama id.
   */
  getClosest(pos) {
    const pano = keymin(this.panos, (pano) => {
      return this.getPosition(pano.id).distanceTo(pos);
    });
    return pano.id;
  }

  /**
   * Gets the navigable neighbors.
   * @param {string} id Panorama id.
   * @return {!Array<string>}
   */
  getNavigable(id) {
    const mutable = this.getPanorama(id).navigable;
    return [...mutable];
  }

  /**
   * Gets the visible neighbors.
   * @param {string} id Panorama id.
   * @return {!Array<string>}
   */
  getVisible(id) {
    const mutable = this.getPanorama(id).visible;
    return (mutable) ? [...mutable] : this.getNavigable(id);
  }

  /**
   * Whether a position is visible from a panorama.
   * @param {string} id Panorama id.
   * @param {!THREE.Vector3} pos
   * @return {boolean}
   */
  isVisible(id, pos) {
    const closest = this.getClosest(pos);
    return id === closest || this.getVisible(id).includes(closest);
  }

  /**
   * Gets the pano materials.
   * @param {string} id Panorama id.
   * @return {!Array<!THREE.MeshBasicMaterial>}
   */
  async getMaterials(id) {
    const pano = this.getPanorama(id);
    if (!pano.materials) {
      const textures = [];
      // Wait until all textures are loaded.
      await new Promise((resolve, reject) => {
        let i = 0;
        pano.urls.forEach((url) => {
          const texture = new THREE.TextureLoader().load(url, () => {
            if (++i === pano.urls.length) {
              resolve();
            }
          });
          texture.minFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          textures.push(texture);
        });
      });
      // Cache the materials.
      pano.materials = [];
      textures.forEach((texture) => {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          reflectivity: 0,
        });
        pano.materials.push(material);
      });
    }
    return pano.materials;
  }

  /**
   * Prunes the given panos from the environment.
   * @param {!Array<!Panorama>} ids Panoramas to prune.
   */
  prunePanoramas(ids) {
    if (ids.includes(this.sourceId)) {
      throw new Error('Cannot prune the current pano');
    }
    this.panos = this.panos.flatMap((pano) => {
      if (ids.includes(pano.id)) {
        return [];
      } else {
        if (pano.navigable) {
          pano.navigable = pano.navigable.flatMap((id) => {
            return (ids.includes(id)) ? [] : [id];
          });
        }
        if (pano.visible) {
          pano.visible = pano.visible.flatMap((id) => {
            return (ids.includes(id)) ? [] : [id];
          });
        }
        return [pano];
      }
    });
  }

  /**
   * Prunes all but the given panos from the environment.
   * @param {!Array<!Panorama>} ids Panoramas to keep.
   */
  keepPanoramas(ids) {
    const complement = this.panos.flatMap((pano) => {
      return (ids.includes(pano.id)) ? [] : [pano.id];
    });
    this.prunePanoramas(complement);
  }

  /**
   * Sets the environment pano.
   * @param {string} id Panorama id.
   */
  async setPanorama(id) {
    // Skip if already set to this pano.
    if (this.sourceId !== id) {
      this.sourceId = id;
      this.camera.position.copy(this.getPosition(id));
      this.camera.updateMatrixWorld();
      // Invert the bubble's scale to render its interior.
      this.bubble.matrix.copy(
          this.getExmat(id).scale(new THREE.Vector3(-1, 1, 1)));
      this.bubble.material = await this.getMaterials(id);
      // Prefetch neighbor materials.
      this.getNavigable(id).forEach(this.getMaterials.bind(this));
    }
  }
}

/**
 * An enriched environment that enables navigation between panoramic viewpoints.
 * It maintains a WebGL renderer, cursor, and a first-person controls.
 * Navigators are a strict superclass of environments.
 */
export class Navigator extends Environment {
  /**
   * Navigator constructor.
   * @param {!Array<!Panorama>} panos Panoramas in the environment.
   * @param {!THREE.Geometry} geometry See environment class.
   * @param {?HTMLCanvasElement} canvas
   */
  constructor(panos, geometry, canvas) {
    super(panos, geometry);
    /** @type {!THREE.WebGLRenderer} */
    this.renderer = new THREE.WebGLRenderer((canvas) ? {canvas} : {});
    /** @type {!HTMLCanvasElement} */
    this.canvas = this.renderer.domElement;
    /** @type {!THREE.OrbitControls} */
    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    this.canvas.addEventListener('dblclick', this.ondblclick.bind(this));
    /** @type {!THREE.Raycaster} */
    this.raycaster = new THREE.Raycaster();
    /** @type {!THREE.Vector2} */
    this.mouse = new THREE.Vector2();
    this.canvas.addEventListener('mousemove', this.onmousemove.bind(this));
    /** @type {!THREE.Object3D} */
    this.cursor;
    // Default yellow point.
    this.setCursor(new THREE.Points(
        new THREE.Geometry().setFromPoints([new THREE.Vector3()]),
        new THREE.PointsMaterial({color: 0xffff00, size: 1e-1})));
    /** @type {string | null} */
    this.targetId;
  }

  /**
   * Sets the cursor.
   * @param {!THREE.Object3D} obj Object to render as the cursor.
   */
  setCursor(obj) {
    // Remove existing cursor.
    if (this.cursor) {
      this.scene.remove(this.cursor);
    }
    this.cursor = obj;
    this.scene.add(obj);
  }

  /**
   * Gets the cursor position.
   * @param {string} id Panorama id.
   * @return {!THREE.Vector3} The cursor position.
   */
  getCurpos(id) {
    const mutable = this.getPanorama(id).curpos;
    return (mutable) ? mutable.clone() : this.getPosition(id);
  }

  /**
   * Updates the environment.
   */
  update() {
    if (!this.sourceId) {
      throw new Error('Panorama not set, please call setPanorama');
    }
    // Next two lines adjust the camera's aspect ratio w.r.t. the canvas.
    // Sadly, this does not play well with snapshots. In particular, when the
    // canvas size differs between recording and replay.
    // this.camera.aspect = this.canvas.width / this.canvas.height;
    // this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    TWEEN.update();
    // Set the orbital target in front of the camera for first-person controls.
    this.camera.getWorldDirection(this.controls.target)
        .multiplyScalar(1e-3)
        .add(this.camera.position);
    // Find the navigable pano closest to the mouse.
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const neighbors = this.getNavigable(this.sourceId);
    if (neighbors.length) {
      // Cursor positions of the navigable panos.
      const curposs = neighbors.map(this.getCurpos.bind(this));
      const distances = curposs.map((pos) => {
        const direction = pos.clone().sub(this.raycaster.ray.origin);
        // Ignore panos behind viewing plane.
        return (direction.dot(this.raycaster.ray.direction) < 0) ?
            Infinity :
            this.raycaster.ray.distanceToPoint(pos);
      });
      const i = argmin(distances);
      if (distances[i] === Infinity) {
        this.cursor.visible = false;
        this.targetId = null;
      } else {
        this.cursor.visible = true;
        this.targetId = neighbors[i];
        const curpos = curposs[i];
        // Project onto viewing frustum.
        this.camera.updateMatrixWorld();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        const frustum = new THREE.Frustum();
        if (frustum.setFromProjectionMatrix) {
          // For newer versions of Three.js.
          frustum.setFromProjectionMatrix(matrix);
        } else {
          frustum.setFromMatrix(matrix);
        }
        frustum.planes.reverse().forEach((plane) => {
          if (plane.distanceToPoint(curpos) < 0) {
            curpos.copy(plane.projectPoint(curpos, new THREE.Vector3()));
            // Slight offset to prevent flickering.
            curpos.add(plane.normal.multiplyScalar(1e-3));
          }
        });
        this.cursor.position.copy(curpos);
      }
    }
  }

  /**
   * Updates the mouse coordinates.
   * @param {!MouseEvent} e
   */
  onmousemove(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / this.canvas.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / this.canvas.height) * 2 + 1;
  }

  /**
   * Starts a panorama transition animation.
   */
  async ondblclick() {
    // Skip if controls are disabled or no pano is targeted.
    if (this.controls.enabled && this.targetId) {
      this.controls.enabled = false;
      // Copy because targeted pano may change during animation.
      const targetId = this.targetId;
      // Start and end positions.
      const p0 = this.getPosition(this.sourceId);
      const p1 = this.getPosition(targetId);
      const distance = p1.clone().sub(p0).length();
      // Start and end quaternions.
      const q0 = this.camera.quaternion.clone();
      this.camera.lookAt(p1);
      const q1 = this.camera.quaternion.clone();
      this.camera.quaternion.copy(q0);
      // Start and end fields-of-view.
      const fov0 = this.camera.fov;
      const fov1 = fov0 * Math.min(distance, 1 / distance);
      const duration = 600;
      const data = {time: 0};
      // Wait until the animation is over.
      await new Promise((resolve, reject) => {
        new TWEEN.Tween(data)
            .to({time: 1}, duration)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate((() => {
                        // For backwards compatibility.
                        const time = this.time || data.time;
                        THREE.Quaternion.slerp(
                            q0, q1, this.camera.quaternion, time);
                        this.camera.fov = (1 - time) * fov0 + time * fov1;
                        this.camera.updateProjectionMatrix();
                      }).bind(this))
            .onComplete((async () => {
                          this.camera.fov = fov0;
                          this.camera.updateProjectionMatrix();
                          await this.setPanorama(targetId);
                          this.controls.enabled = true;
                          resolve();
                        }).bind(this))
            .start();
      });
    }
  }
}
