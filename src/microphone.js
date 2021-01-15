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
 * @fileoverview Microphone utils.
 */

import {Animation} from './animation.js';

/**
 * A high-level wrapper for the Web Audio API.
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 */
export class Microphone {
  /**
   * Microphone constructor.
   * @param {?Visualizer} visualizer
   */
  constructor(visualizer) {
    /** @type {?Visualizer} */
    this.visualizer = visualizer;
    /** @type {boolean} */
    this.isRunning = false;
    /** @type {!Array<!Float32Array>} */
    this.data = [];
    const constraints = {
      noiseSuppression: false,
      autoGainControl: false,
      echoCancellation: false
    };
    navigator.mediaDevices.getUserMedia({audio: constraints}).then((stream) => {
      if (!stream.getAudioTracks().length) {
        throw new Error('No audio track found');
      }
      if (stream.getAudioTracks()[0].muted) {
        alert('Warning: Your microphone is muted!');
      }
      // AudioContext retuires user gesture.
      // https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
      document.addEventListener('mousemove', () => {
        /** @type {!AudioContext} */
        this.audioContext = new AudioContext();
        // Always use the max buffer size.
        // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor
        const processor = this.audioContext.createScriptProcessor(16384, 1, 1);
        processor.connect(this.audioContext.destination);
        processor.onaudioprocess = (e) => {
          if (this.isRunning) {
            const data = new Float32Array(e.inputBuffer.getChannelData(0));
            this.data.push(data);
          }
        };
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(processor);
        if (this.visualizer) {
          this.visualizer.connect(source, this.audioContext);
        }
      }, {once: true});
    });
  }

  /**
   * Starts or resumes recording audio.
   */
  start() {
    if (this.audioContext.state !== 'running') {
      throw Error(`AudioContext is ${this.audioContext.state}`);
    }
    this.isRunning = true;
  }

  /**
   * Pauses or stops recording audio.
   */
  stop() {
    if (this.audioContext.state !== 'running') {
      throw Error(`AudioContext is ${this.audioContext.state}`);
    }
    this.isRunning = false;
  }

  /**
   * Concatenates all the audio snippets into a WAV blob.
   * @return {!Blob}
   */
  async dump() {
    this.stop();
    const data = new Float32Array(await new Blob(this.data).arrayBuffer());
    const audioBuffer = new AudioContext().createBuffer(
        1, data.length, this.audioContext.sampleRate);
    audioBuffer.getChannelData(0).set(data);
    return wavify(audioBuffer);
  }

  /**
   * Empties recorded audio.
   */
  reset() {
    this.data = [];
  }
}

/**
 * Abstract class for visualizing a microphone audio steam.
 * Reference implementation: https://github.com/mdn/voice-change-o-matic/
 */
class Visualizer {
  /**
   * Visualizer constructor.
   * @param {!HTMLCanvasElement} canvas
   * @param {string=} bgColor Background color.
   * @param {string=} fgColor Foreground color.
   */
  constructor(canvas, bgColor = '#000000', fgColor = '#ffff00') {
    if (new.target === Visualizer) {
      throw new Error('Visualizer is an abstract class');
    }
    /** @type {!HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {!CanvasRenderingContext2D} */
    this.canvasCtx = canvas.getContext('2d');
    /** @type {string} */
    this.bgColor = bgColor;
    /** @type {string} */
    this.fgColor = fgColor;
    /** @type {!Animation} */
    this.animation;

  }

  /**
   * Connects to an audio stream and starts the visualization.
   * @param {!MediaStreamAudioSourceNode} source
   * @param {!AudioContext} audioContext
   */
  connect(source, audioContext) {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -1;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.animation = new Animation(() => {
      // Reads the frequency data into the dataArray array.
      analyser.getByteFrequencyData(dataArray);
      this.redraw(dataArray, bufferLength);
    });
    // Autostart.
    this.animation.start();
  }

  /**
   * Abstract method that updates the visualization.
   * @param {!Uint8Array} dataArray Full recorded data.
   * @param {number} bufferLength Size of the buffer to visualize.
   */
  redraw(dataArray, bufferLength) {
    throw new Error('Abstract method not implemented');
  }
}

/**
 * Visualizes the frequency histogram of an audio stream.
 */
export class Histogram extends Visualizer {
  /**
   * Updates the visualization.
   * @param {!Uint8Array} dataArray
   * @param {number} bufferLength
   */
  redraw(dataArray, bufferLength) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.canvasCtx.fillStyle = this.bgColor;
    this.canvasCtx.fillRect(0, 0, width, height);
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i];
      this.canvasCtx.fillStyle = this.fgColor;
      this.canvasCtx.fillRect(
          x, height - barHeight / 2, barWidth, barHeight / 2);
      x += barWidth + 1;
    }
  }
}

/**
 * Visualizes the RMS meter of an audio stream.
 */
export class RmsMeter extends Visualizer {

  /**
   * Updates the visualization.
   * @param {!Uint8Array} dataArray
   * @param {number} bufferLength
   */
  redraw(dataArray, bufferLength) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.canvasCtx.fillStyle = this.bgColor;
    this.canvasCtx.fillRect(0, 0, width, height);
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
      rms += dataArray[i];
    }
    rms = Math.sqrt(rms / bufferLength);
    this.canvasCtx.fillStyle = this.fgColor;
    this.canvasCtx.fillRect(0, 0, rms / 10 * width, height);
  }
}

/**
 * Converts an audio buffer into a WAV blob.
 * Reference implementation: https://www.npmjs.com/package/audiobuffer-to-wav
 * @param {!AudioBuffer} audioBuffer
 * @param {boolean=} isFloat32 Whether to encode as float32 instead of float16.
 * @return {!Blob}
 */
function wavify(audioBuffer, isFloat32 = false) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = isFloat32 ? 32 : 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const fmt = isFloat32 ? 3 : 1;
  if (numChannels !== 1 && numChannels !== 2) {
    throw new Error('AudioBuffer.numberOfChannels must be 1 or 2.');
  }
  let samples = audioBuffer.getChannelData(0);
  if (numChannels == 2) {
    // Interleave left and right audio channels.
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const length = Math.min(left.length, right.length);
    samples = new Float32Array(left.length + right.length);
    for (let i = 0; i < length; i++) {
      samples[2 * i] = left[i];
      samples[2 * i + 1] = right[i];
    }
  }
  const arrayBuffer = new ArrayBuffer(44 + samples.length * bitDepth);
  const dataView = new DataView(arrayBuffer);
  function setString(i, value) {
    for (let j = 0; j < value.length; j++) {
      dataView.setUint8(i + j, value.charCodeAt(j));
    }
  }
  setString(0, 'RIFF');
  dataView.setUint32(4, 36 + samples.length * bytesPerSample, true);
  setString(8, 'WAVE');
  setString(12, 'fmt ');
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, fmt, true);
  dataView.setUint16(22, numChannels, true);
  dataView.setUint32(24, sampleRate, true);
  dataView.setUint32(28, sampleRate * blockAlign, true);
  dataView.setUint16(32, blockAlign, true);
  dataView.setUint16(34, bitDepth, true);
  setString(36, 'data');
  dataView.setUint32(40, samples.length * bytesPerSample, true);
  let i = 44;
  for (let j = 0; j < samples.length; j++) {
    if (isFloat32) {
      dataView.setFloat32(i, samples[j], true);
      i += 4;
    } else {
      const clipped = Math.max(-1, Math.min(1, samples[j]));
      dataView.setInt16(
          i, clipped < 0 ? clipped * 0x8000 : clipped * 0x7FFF, true);
      i += 2;
    }
  }
  return new Blob([arrayBuffer], {type: 'audio/wav'});
}
