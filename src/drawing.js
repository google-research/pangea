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
 * @fileoverview Drawing utils.
 * @suppress {missingRequire}
 */

import {arange, linspace} from './utils.js';

/**
 * A color gradient whose visible segments are determined by an environment.
 */
export class LineDrawing {
  /**
   * Line constructor.
   * @param {!Environment} env
   * @param {!Array<!THREE.Color>} points
   * @param {!Array<!THREE.Color>} colors
   * @param {number=} resolution Subpoints per unit distance.
   * @param {number=} size Size of the subpoints.
   */
  constructor(env, points, colors, resolution = 0.01, size = 0.05) {
    /** @type {!Environment} */
    this.env = env;
    /** @type {!Array<!THREE.Vector3>} */
    this.subpoints = getIntermediatePoints(points, resolution);
    /** @type {!Array<!THREE.Color>} */
    this.subcolors = getColorGradient(colors, this.subpoints.length);
    /** @type {!Array<!THREE.Mesh>} */
    this.children = this.subpoints.map((point, i) => {
      const child = new THREE.Points(
        new THREE.Geometry().setFromPoints([new THREE.Vector3()]),
        new THREE.PointsMaterial({color: this.subcolors[i], size}));
      child.position.copy(point);
      env.scene.add(child);
      return child;
    });
    /** @type {!Array<string>} */
    this.anchors = this.subpoints.map((point) => {
      return env.getClosest(point);
    });

  }

  /**
   * Updates the visibility of the line's subpoints.
   */
  update() {
    this.children.forEach((child, i) => {
      const anchor = this.anchors[i];
      child.visible = anchor === this.env.sourceId ||
          this.env.getVisible(this.env.sourceId).includes(anchor);
    });
  }
}

/**
 * Interpolates sample points and returns an array of equidistant subpoints.
 * The distance between subsequent subpoints is determined by the resolution.
 * @param {!Array<!THREE.Vector3>} points
 * @param {number} resolution Subpoints per unit distance.
 * @return {!Array<!THREE.Vector3>}
 */
function getIntermediatePoints(points, resolution) {
  if (points.length === 1) {
    return points;
  } else {
      return points.slice(1).flatMap((end, i) => {
      const start = points[i];
      const distance = start.distanceTo(end);
      return linspace(0, 1, Math.trunc(distance / resolution)).map((a) => {
        return start.clone().lerp(end, a);
      });
    });
  }
}

/**
 * Interpolates sample colors and returns a color gradient.
 * The number of subcolors between each sample color is (size / colors.length).
 * @param {!Array<!THREE.Color>} colors
 * @param {number} size Number of intermediate colors.
 * @return {!Array<!THREE.Color>}
 */
function getColorGradient(colors, size) {
  if (colors.length === 1) {
    arange(size).map(() => color);
  } else {
    return linspace(0, colors.length - 1, size).map((b) => {
      const i = Math.trunc(b);
      const a = b % 1;
      return new THREE.Color(colors[i]).lerp(new THREE.Color(colors[i + 1]), a);
    });
  }
}
