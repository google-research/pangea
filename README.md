# PanGEA

The Panoramic Graph Environment Annotation toolkit, abbreviated as PanGEA, is a
lightweight and customizable codebase for collecting audio and text
annotations in panoramic graph environments, such as
[Matterport3D](https://niessner.github.io/Matterport/) and
[StreetLearn](https://sites.google.com/corp/view/streetlearn). PanGEA has been
used to collect the
[RxR dataset](https://github.com/google-research-datasets/RxR) of multilingual
navigation instructions, and to perform human wayfinding evaluations of
machine-generated navigation instructions.

## Organization

The `src` directory contains the core components used to create a plugin.

*   `environment.js` contains the `Environment` class for manipulating a graph
    of panoramic viewpoints. Environments maintain a
    [Three.js](https://threejs.org/) camera and scene. Also contains the
    `Navigator` class, which is a strict superclass of an environment.
    Navigators maintain a WebGL renderer, cursor, and first-person controls.
*   `animation.js` contains the `Animation` class, which is a high-level wrapper
    around the
    [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).
*   `microphone.js` contains the `Microphone` class, which is a high-level
    wrapper around the
    [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
    as well as an `RmsMeter` and `Histogram` class to visualize the audio
    stream.
*   `drawing.js` contains the `LineDrawing` class which renders a line in an
    environment. This is useful for rendering paths to be annotated.
*   `firebase.js` contains Firebase upload related utilities.
*   `utils.js` contains common utility functions.
*   `data_adapter.js` contains code for loading Matterport3D environments.

The `examples` directory contains examples of PanGEA in action.

*   `environment_demo.html` demonstrates loading a navigator, recording a pose
    trace, and replaying the recorded pose trace. A pose trace is a timestamped
    sequence of camera poses that captures everything the annotator sees.
*   `microphone_demo.html` demonstrates recording audio from the microphone.
*   `guide_plugin.html` is the Guide plugin for an RxR annotation task.
*   `follower_plugin.html` is the Follower plugin for an RxR annotation task.

The `environment_demo.html` and `microphone_demo.html` pages are minimal
self-contained examples that don't require downloading any additional data. Just
launch a local server to see them, e.g.

```bash
python3 -m http.server 8000
```

and browse to

```bash
http://localhost:8000/examples/environment_demo.html
http://localhost:8000/examples/microphone_demo.html
```

The `guide_plugin.html` and `follower_plugin.html` pages require a dataset to
work, as described below.

## Guide and Follower plugins

The Guide and Follower plugins were used to collect the
[RxR dataset](https://github.com/google-research-datasets/RxR) of multilingual
navigation instructions in the Matterport3D environment. Both plugins can be
configured to save annotation outputs to [Firebase](https://firebase.google.com/).

### Guide Task

In the Guide task, annotators are given a path in the environment. Their
voice is recorded as they freely move along the path and attempt to generate
spoken navigation instructions others can follow. After they're satisfied with
their instructions, they'll be asked to manually transcribe their own voice
recording into text.

Input Args (currently loaded from `testdata/args.json`):

- language: currently supports English, Hindi or Telugu. Used to configure
[Google Input Tools](https://www.google.com/inputtools/) in the transcription
step
- scan: environment identifer
- path: sequence of viewpoint ids indicating the path to be annotated
- heading: starting heading
- path_id: your path identifier

Outputs:

- a pose trace (timestamped virtual camera poses, capturing the annotator's
movements and everything they see along the path)
- the audio file of the annotator's voice recording, and
- the annotator's manual transcript of their voice recording.

### Follower Task

In the Follower task, annotators begins at the start of an unknown path and
try to follow a Guide’s instruction. They observe the environment and navigate
in the simulator as the Guide’s audio plays. Once they believe they have reached
the the end of the path, or give up, they indicate they are done.

Input Args (currently loaded from `testdata/args.json`):

- audio: path to a Guide's audio recording
- scan: environment identifer
- path: a sequence of viewpoint ids (annotator starts at the first viewpoint)
- heading: starting heading
- path_id: your path identifier

Outputs:

- a pose trace (timestamped virtual camera poses, capturing the annotator's
movements and everything they see along the path)

### Post-Processing

In the RxR dataset, all words in the manually-transcribed navigation
instructions are timestamped and aligned with both the Guide and Follower pose
traces. In a future release we will provide tooling to perform this alignment
automatically following the same approach as
[Localized Narratives](https://google.github.io/localized-narratives/).

### Running locally

In order to simulate an environment, PanGEA requires a dataset of 360-degree
panoramic images, plus navigation graphs encoding the position of these
viewpoints and the navigable connections between them. To use the Matterport3D
dataset, download the Matterport3D skybox images from
[here](https://niessner.github.io/Matterport/) and the navigation graphs from
[here](https://github.com/peteanderson80/Matterport3DSimulator/tree/master/connectivity).
Please note that the Matterport3D data is governed by the following
[Terms of Use](http://kaldir.vc.in.tum.de/matterport/MP_TOS.pdf). Alternatively,
a different dataset such as StreetLearn could be used by writing a new
dataloader class in `data_adapter.js`.

Assuming the data is saved in a directory as follows:

```bash
<data_dir>/data/v1/scans/<scan_id>/matterport_skybox_images/<pano_id>_skybox<face_id>_sami.jpg
<data_dir>/connectivity/<scan_id>_connectivity.json
```

create a symlink to the data and start a local server

```bash
ln -s <data_dir> symdata
python3 -m http.server 8000
```

then browse to

```bash
http://localhost:8000/examples/guide_plugin.html
http://localhost:8000/examples/follower_plugin.html
```

### Deploying remotely


#### Environment data hosting

To deploy a plugin remotely (i.e., for a genuine data collection effort), you'll
need to host your environment data and javascript on a
[Google Cloud Storage bucket](https://cloud.google.com/storage/). The
environment data file paths should be as follows:

```bash
gs://<bucket_id>/data/v1/scans/<scan_id>/matterport_skybox_images/<pano_id>_skybox<face_id>_sami.jpg
gs://<bucket_id>/connectivity/<scan_id>_connectivity.json
```

In `guide_plugin.html` and `follower_plugin.html`, swap the argument to the
`Matterport3D` function from `../symdata` to
`https://storage.googleapis.com/<bucket_id>`, and update the javascript urls
beginning with `../src/` to point to the new location in your bucket.

Don't forget to grant your plugin
[read access](https://cloud.google.com/storage/docs/access-control) and
[enable CORS](https://cloud.google.com/storage/docs/configuring-cors).

#### Firebase integration

The Guide and Follower plugins are setup to use (1) a storage bucket to upload
raw annotations (e.g., speech recordings and pose traces), and (2) a database to
store and organize additional metadata (e.g., audio transcriptions). Both are
setup using
[Firebase](https://firebase.google.com/).

*   First, create an app from the
    [console](https://console.firebase.google.com/).
*   Go to the Storage tab and add a bucket. This can either be the same bucket
    used to host your data or a brand new one. We recommend the latter. Don't
    forget to grant your plugin
    [write access](https://cloud.google.com/storage/docs/access-control).
*   Go to the Cloud Firestore tab and create your
    [database](https://firebase.google.com/docs/firestore). Don't forget to
    grant your plugin
    [write access](https://firebase.google.com/docs/firestore/security/rules-structure).
*   Firebase integration is built into `examples/guide_plugin.html` and
    `examples/follower_plugin.html`, but you'll need to make some modifications.
    *   Set `USE_FIREBASE` to true.
    *   Set `FIREBASE_APP_CONFIG` to the app config under the Project Settings
        tab.
    *   Set `FIREBASE_COLLECTION` to the name of the database collection you
        want the plugin to write documents to.
    *   And optionally set `USE_GOOGLE_LOGIN` to true if you want to
        authenticate the user via their Google account. This is useful if your
        [rules](https://firebase.google.com/docs/firestore/security/rules-structure)
        only allow specific users to write to the database. Make sure to enable
        popups and redirects.

Your app config should look something like this:

```javascript
 {
  apiKey: "AIza....",                             // Auth / General Use
  appId: "1:27992087142:web:ce....",              // General Use
  projectId: "my-firebase-project",               // General Use
  authDomain: "YOUR_APP.firebaseapp.com",         // Auth with popup/redirect
  databaseURL: "https://YOUR_APP.firebaseio.com", // Realtime Database
  storageBucket: "YOUR_APP.appspot.com",          // Storage
  messagingSenderId: "123456789",                 // Cloud Messaging
  measurementId: "G-12345"                        // Analytics
}
```

#### Crowdsourcing platform

Integration with crowdsourcing platforms (e.g., Amazon Mechanical Turk) is left
to the user. Currently, both `examples/guide_plugin.html` and
`examples/follower_plugin.html` load the required metadata (e.g., the path to be
annotated) from `testdata/args.json`. To deploy a plugin, args.json should be
replaced with data from a crowdsourcing platform.
