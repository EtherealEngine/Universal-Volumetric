# UVOL 2

Currently, It can:

- Encode DRACO meshes into a single file and map frames to a manifest file.
- Player can play both old formats and new draco encoded meshes without any user intervention.

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
