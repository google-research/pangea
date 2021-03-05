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
 * @fileoverview Dataset adapter utils.
 * @suppress {missingRequire}
 */

import {Environment, Navigator} from './environment.js';
import {getJSON} from './utils.js';

/**
 * Data adapter for the Matterport3D environment.
 */
export class Matterport3D {
  /**
   * Matterport3D constructor.
   * @param {string} path Directory or a url https://storage.googleapis.com/...
   * @param {boolean=} flatten Whether the directory tree has been flattened
   *     with `path` as the root and no intermediate directories. For example:
   * `${path}/connectivity/${scan}_connectivity.json` becomes
   * `${path}/${scan}_connectivity.json`.
   */
  constructor(path, flatten = false) {
    /** @type {string} */
    this.path = path;
    /** @type {boolean} */
    this.flatten = flatten;
  }

  /**
   * Returns the raw connectivity entries from the Matteport3D simulator.
   * https://github.com/peteanderson80/Matterport3DSimulator/tree/master/connectivity
   * @param {string} scan Scan id.
   * @return {!Promise<!Array<!Object>>}
   */
  async getEntries(scan) {
    const dir = this.flatten ? this.path : `${this.path}/connectivity`;
    return await getJSON(`${dir}/${scan}_connectivity.json`);
  }

  /**
   * Returns the image urls from the Matterport3D dataset.
   * https://niessner.github.io/Matterport/
   * @param {!Object} entry
   * @param {string} scan Scan id.
   * @return {!Array<string>}
   */
  getUrls(entry, scan) {
    const dir = this.flatten ?
        this.path :
        `${this.path}/data/v1/scans/${scan}/matterport_skybox_images`;
    const id = this.getId(entry);
    return [
      `${dir}/${id}_skybox2_sami.jpg`, `${dir}/${id}_skybox4_sami.jpg`,
      `${dir}/${id}_skybox0_sami.jpg`, `${dir}/${id}_skybox5_sami.jpg`,
      `${dir}/${id}_skybox1_sami.jpg`, `${dir}/${id}_skybox3_sami.jpg`
    ];
  }

  /**
   * Returns the panoramic viewpoint id.
   * @param {!Object} entry
   * @return {string}
   */
  getId(entry) {
    return entry['image_id'];
  }

  /**
   * Returns the extrinsic matrix of an entry.
   * @param {!Object} entry
   * @return {!THREE.Matrix4}
   */
  getExmat(entry) {
    const exmat = new THREE.Matrix4().fromArray(entry.pose);
    // Column to row major format.
    exmat.transpose();
    // Matterport3D to Three.js coordinates.
    exmat.premultiply(new THREE.Matrix4().makeRotationX(Math.PI / -2));
    exmat.scale(new THREE.Vector3(1, -1, -1));
    return exmat;
  }

  /**
   * Returns the cursor position slightly above floor-level.
   * @param {!Object} entry
   * @return {!THREE.Vector3}
   */
  getCurpos(entry) {
    const exmat = this.getExmat(entry);
    const curpos = new THREE.Vector3().setFromMatrixPosition(exmat);
    curpos.y -= (entry.height) ? entry.height - 0.5 : 0.3;
    return curpos;
  }

  /**
   * Returns the neighbors of an entry.
   * @param {!Object} entry
   * @param {!Array<!Object>} entries
   * @param {string} key Either 'unobstructed' or 'visible'.
   * @return {!Array<string>}
   */
  getNeighbors(entry, entries, key) {
    const neighbors = entry[key].flatMap((isNeighbor, i) => {
      const neighborEntry = entries[i];
      return (isNeighbor && neighborEntry.included) ?
          [this.getId(neighborEntry)] :
          [];
    });
    return (entry.included) ? neighbors : [];
  }

  /**
   * Returns an array of panoramas.
   * @param {string} scan Scan id.
   * @return {!Array<!Panorama>}
   */
  async getPanoramas(scan) {
    const entries = await this.getEntries(scan);
    return entries.flatMap((entry) => {
      const pano = {
        id: this.getId(entry),
        exmat: this.getExmat(entry),
        curpos: this.getCurpos(entry),
        urls: this.getUrls(entry, scan),
        navigable: this.getNeighbors(entry, entries, 'unobstructed'),
        visible: this.getNeighbors(entry, entries, 'visible')
      };
      return (entry.included) ? [pano] : [];
    });
  }

  /**
   * Returns a THREE.BoxGeometry for Matterport3D cubemap panoramas.
   * @return {!THREE.BoxGeometry}
   */
  getGeometry() {
    return new THREE.BoxGeometry(100, 100, 100);
  }

  /**
   * Returns a Matterport3D environment.
   * @param {string} scan Scan id.
   * @return {!Environment}
   */
  async getEnvironment(scan) {
    const panos = await this.getPanoramas(scan);
    const geometry = this.getGeometry();
    return new Environment(panos, geometry);
  }

  /**
   * Returns a Matterport3D navigator.
   * @param {string} scan Scan id.
   * @param {?HTMLCanvasElement} canvas
   * @return {!Navigator}
   */
  async getNavigator(scan, canvas) {
    const panos = await this.getPanoramas(scan);
    const geometry = this.getGeometry();
    return new Navigator(panos, geometry, canvas);
  }

  /**
   * Converts Matterport3D camera angles into Three.js rotations.
   * @param {number} heading Heading angle (y-rotation in Three.js).
   * @param {number} elevation Elevation angle (x-rotation in Three.js).
   * @return {!THREE.Euler}
   */
  convertRotation(heading, elevation) {
    return new THREE.Euler(elevation, -heading, 0, 'YXZ');
  }

  /**
   * Converts Three.js rotations into Matterport3D camera angles .
   * @param {!THREE.Euler} rotation Three.js camera rotation.
   * @return {!Array<number>} 2-tuple of [heading, pitch].
   */
  revertRotation(rotation) {
    const reordered = rotation.clone().reorder('YXZ');
    return [-reordered.y, reordered.x];
  }
}
