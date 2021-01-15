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
 * @fileoverview Firebase utils.
 */

/**
 * Google login via popups/redirects.
 * @return {!Object} User metadata.
 */
export async function doGoogleLogin() {
  if (firebase.apps.length === 0) {
    throw new Error('Firebase app not initialized');
  }
  try {
    const auth = firebase.auth();
    await auth.getRedirectResult();
    if (!auth.currentUser) {
      const provider = new firebase.auth.GoogleAuthProvider();
      // https://developers.google.com/identity/protocols/googlescopes
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');
      await auth.signInWithPopup(provider);
      await auth.getRedirectResult();
    }
    return auth.currentUser;
  } catch (error) {
    console.error(
        'Google login failed. Are popups/redirects blocked in site settings?',
        error);
  }
}

/**
 * Background blob upload.
 * @param {string} path Storage object path.
 * @param {!Blob} blob
 * @param {boolean=} verbose Whether to console.log progress.
 * @return {!Promise} Resolves when the upload is complete.
 */
export function uploadBlob(path, blob, verbose = false) {
  if (firebase.apps.length === 0) {
    throw new Error('Firebase app not initialized');
  }
  const ref = firebase.storage().ref().child(path);
  return new Promise((resolve, reject) => {
    ref.put(blob).on(
        'state_changed',
        (snapshot) => {
          if (verbose) {
            const progress = Math.trunc(
                100 * snapshot.bytesTransferred / snapshot.totalBytes);
            console.log(`Uploading ${path} is ${progress}% done`);
          }
        },
        (error) => {
          reject(new Error(`Uploading ${path} failed`, error));
        },
        function() {
          if (verbose) {
            console.log(`Uploading ${path} succeeded`);
          }
          resolve();
        });
  });
}
