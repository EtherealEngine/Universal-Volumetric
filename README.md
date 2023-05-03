# Universal Volumetric

### The open source Universal Volumetric (".uvol") compressed interchange format for streaming mesh sequences. 

#### This tech was built in partnership with Wild Capture and others. 

You can see an example on Wild Capture's site, here: http://wildcapture.co/volumetric.html

This project  includes a cross-platform player implementation using h.264 video for texture encoding and Draco and Corto compression for GLTF 3D model.

The initial version focuses on performance. Currently, single material mesh sequences of any length are supported. The next version will focus on higher compression ratio, streamability and integration into USD and glTF.

The current implementation uses the MIT-licensed Corto codec from CNR-ISTI Visual Computing Group, which has fast compression and especially fast decompression characteristics.

### Collaborators Wanted!
If you are proficient in C++, python, JS, Unity/C#, or you want to support this project creatively or financially, please get in touch!

### Example

Current uvol files consist of a .uvol binary, manifest file and video texture. Future versions will embed everything into the uvol binary or in a single MP4 container.

Currently playback works in WebGL with three.js and Unity. Android and iOS are in development, Unreal support is on the roadmap (intrepid C++ developers should be able to port this in a day by reading the source from other examples, since the core codec is C++ based).

## Requirements
For encoding, you will need Node.js 12+ and Python 3 installed.

For decoding, currently WebGL is supported (especially three.js), Unreal and Unity will come in the next release.

You will need a mesh and texture sequence in OBJ/PNG or OBJ/PLY.

Encoded .uvol files are cross platform, but currently the decoder is written for the web only. Want Unity, Unreal, examples in PlayCanvas and Babylon, etc? Submit and issue and sponsor our project:
https://opencollective.com/etherealengine

Or find us on Discord!
https://discord.gg/xrf

## Dev Setup

Clone this repository and run the following commands to run the `example`.

Place draco geometry files in `assets` directory and run `Encoder.js` script.

### See help for more details

```
❯ node Encoder.js --help
Usage: universal-volumetric [options] <output-file-name>

CLI to encoder geometry files into UVOL format

Arguments:
  output-file-name                    Output filename

Options:
  -V, --version                       output the version number
  -gc, --geometry-compression <type>  Compression type of 3D geometries
  -tc, --texture-compression <type>   Compression type of 3D textures. Default value: mp4
  -f, --framerate <value>             Frame rate of the output volumetric video. Default value: 30 fps
  -v, --verbose
  -i, --input-path <path>             Directory that contains 3d models (drc or crt files)
  --start-frame <value>               Default value: 0
  --end-frame <value>                 Default value: Total number of frames - 1
  -h, --help                          display help for command
```

#### Sample command

```
node Encoder.js -v -gc draco -i assets -f 30 liam.uvol
```

```bash
yarn install
npm run build # builds files into "dist" directory
cd example/
npm install
npm run dev
```
