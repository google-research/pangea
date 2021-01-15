# Pangea

The Panoramic Graph Environment Annotation toolkit, abbreviated as Pangea, is a
lightweight and customizable codebase for collecting audio and text
annotations in panoramic graph environments, such as
[Matterport3D](https://niessner.github.io/Matterport/) and
[StreetLearn](https://sites.google.com/corp/view/streetlearn). Pangea has been
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
*   `drawing.js` contains the `Line` class which renders a line in an
    environment. This is useful for rendering paths to be annotated.
*   `firebase.js` contains Firebase upload related utilities.
*   `utils.js` contains common utility functions.
*   `examples.js` contains misc utility functions use by the examples below. The
    `Matterport3D` class is a data adapter for the Matterport3D environment.

The `examples` directory contains examples of Pangea in action.

*   `environment_demo.html` demonstrates loading a navigator, recording a pose
    trace, and replaying the recorded pose trace.
*   `microphone_demo.html` demonstrates recording audio from the microphone.
*   `guide_plugin.html` is the Guide plugin for an RxR annotation task.
*   `follower_plugin.html` is the Follower plugin for an RxR annotation task.

The `environment_demo.html` and `microphone_demo.html` examples are
self-contained and don't require downloading any additional data. Just launch a
local server to see them.

```bash
python3 -m http.server 8000
```

We'll provide recipes for `guide_plugin.html` and `follower_plugin.html` which
require the Matterport3D environment.

## Guide and Follower plugins

The Guide and Follower plugins are used to collect the
[RxR dataset](https://github.com/google-research-datasets/RxR) of multilingual
navigation instructions in the Matterport3D environment.

During the Guide phase, annotators are given a path in the environment. Their
voice is recorded as they freely move along the path and attempt to generate
spoken navigation instructions others can follow. After they're satisfied with
their instructions, they'll be asked to manually transcribe their own voice
recording into text, similar to
[Localized Narratives](https://google.github.io/localized-narratives/).

During the Follower phase, annotators begins at the start of an unknown path and
try to follow the Guide’s instruction. They observe the environment and navigate
in the simulator as the Guide’s audio plays. Once they believe they have reached
the the end of the path, or give up, they indicate they are done.

### Running locally

In order to simulate an environment, Pangea needs to access the raw panoramic
data. You can download the Matterport3D panoramas
[here](https://niessner.github.io/Matterport/) and the navigation graphs
[here](https://github.com/peteanderson80/Matterport3DSimulator/tree/master/connectivity).
Please note that the Matterport3D data are governed by the following
[Terms of Use](http://kaldir.vc.in.tum.de/matterport/MP_TOS.pdf).

```bash
<data_dir>/data/v1/scans/<scan_id>/matterport_skybox_images/<pano_id>_skybox<face_id>_sami.jpg
<data_dir>/connectivity/<scan_id>_connectivity.json
```

Create a symlink to the data and kick off a local server.

```bash
ln -s <data_dir> symdata
python3 -m http.server 8000
```

Check out an example!

```bash
http://localhost:8000/examples/guide_plugin.html
http://localhost:8000/examples/follower_plugin.html
```

### Deploying remotely

To deploy a plugin remotely you'll need to host your data on a
[Google Cloud Storage bucket](https://cloud.google.com/storage/).

```bash
gs://<bucket_id>/data/v1/scans/<scan_id>/matterport_skybox_images/<pano_id>_skybox<face_id>_sami.jpg
gs://<bucket_id>/connectivity/<scan_id>_connectivity.json
```

Swap out the `Matterport3D` function's `root` argument from `../symdata` to
`https://storage.googleapis.com/<bucket_id>`.

Don't forget to grant your plugin
[read access](https://cloud.google.com/storage/docs/access-control) and
[enable CORS](https://cloud.google.com/storage/docs/configuring-cors).

### Firebase integration

Generally speaking, when you deploy a plugin, you'll want to set up (1) a
storage bucket to upload raw annotations (e.g., speech recordings) to and (2) a
database to store and organize the metadata (e.g., info about the annotator).
Here's a recipe for how to create both using
[Firebase](https://firebase.google.com/).

*   First you'll want to create an app from the
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
  appId: "1:27992087142:web:ce....",      // General Use
  projectId: "my-firebase-project",               // General Use
  authDomain: "YOUR_APP.firebaseapp.com",         // Auth with popup/redirect
  databaseURL: "https://YOUR_APP.firebaseio.com", // Realtime Database
  storageBucket: "YOUR_APP.appspot.com",          // Storage
  messagingSenderId: "123456789",                  // Cloud Messaging
  measurementId: "G-12345"                        // Analytics
}
```

### Crowdsourcing platform

Integration with crowdsourcing platforms (e.g., Amazon Mechanical Turk) is left
to the user. Currently, both `examples/guide_plugin.html` and
`examples/follower_plugin.html` load the required metadata (e.g., the path to be
annotated) from `testdata/args.json`. To deploy a plugin, args.json should be
replaced with data from a crowdsourcing platform.
