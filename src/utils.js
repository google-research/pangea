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
 * @fileoverview Utility functions.
 */

/**
 * Returns the argmin of an array.
 * @param {!Array<number>} array
 * @return {number}
 */
export function argmin(array) {
  return array.map((x, i) => [x, i]).reduce((x, y) => x[0] < y[0] ? x : y)[1];
}

/**
 * Keyed min function.
 * @param {!Array<!Object>} array
 * @param {!Function} fn Maps array elements to scalars.
 * @return {!Object}
 */
export function keymin(array, fn) {
  return array[argmin(array.map(fn))];
}

/**
 * Implements np.arange.
 * @param {number} start
 * @param {number} stop
 * @param {number=} step
 * @return {!Array<number>}
 */
export function arange(start, stop, step = 1) {
  if (!stop) {
    stop = start;
    start = 0;
  }
  const array = [];
  while (start < stop) {
    array.push(start);
    start += step;
  }
  return array;
}

/**
 * Implements np.linspace.
 * @param {number} start
 * @param {number} stop
 * @param {number} size
 * @return {!Array<number>}
 */
export function linspace(start, stop, size) {
  const increment = (stop - start) / (size - 1);
  return arange(size).map((i) => start + (increment * i));
}

/**
 * Reads a JSON file.
 * @param {string} url
 * @return {!Promise<?>}
 */
export function getJSON(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.onload = () => {
      resolve(xhr.response);
    };
    xhr.open("GET", url, true);
    xhr.send();
  });
}

/**
 * Creates a JSONLines (https://jsonlines.org/) blob.
 * @param {!Array<!Object>} objs Objects for each line.
 * @return {!Blob}
 */
export function getJSONLines(objs) {
  const lines = objs.map((obj) => {
    return JSON.stringify(obj) + '\n';
  });
  return new Blob(lines, {type: 'text/plain'});
}
