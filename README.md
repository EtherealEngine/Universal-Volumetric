# UVOL 2

Currently, it's a very crude source which is not in working condition. But it can:

- Encode DRACO meshes into a single file and map frames to a manifest file.
- WebWorker can decode draco mesh to Three.JS BufferGeometry

It can't:

- render the geometry with the video yet

## Dev Setup

Clone this repository and run the following commands to run the `example`.

Place draco geometry files in `assets` directory and run `Encoder30.js` script.

```
node Encoder30.js filename.drcs
```

```bash
yarn install
npm run build # builds files into "dist" directory
cd example/
npm install
npm run dev
```
