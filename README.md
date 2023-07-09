# Universal Volumetric

## The open source Universal Volumetric (".uvol") compressed interchange format for streaming mesh sequences

### This tech was built in partnership with Wild Capture and others

You can see an example on Wild Capture's site, here: <http://wildcapture.co/volumetric.html>

This project  includes a cross-platform player implementation using h.264 video for texture encoding and Draco and Corto compression for GLTF 3D model.

The initial version focuses on performance. Currently, single material mesh sequences of any length are supported. The next version will focus on higher compression ratio, streamability and integration into USD and glTF.

The current implementation uses the MIT-licensed Corto codec from CNR-ISTI Visual Computing Group, which has fast compression and especially fast decompression characteristics.

## File Structure

Current uvol files consist of a `.uvol` binary, `.manifest` file (which is a json file) and a `.mp4` file (video texture). Future versions will embed everything into the uvol binary or in a single MP4 container.

Currently playback works in WebGL with three.js and Unity. Android and iOS are in development, Unreal support is on the roadmap (intrepid C++ developers should be able to port this in a day by reading the source from other examples, since the core codec is C++ based).

## Encoding data

### Requirements

- Make sure you have `corto` binary installed.
  - You can build it from source from [here](https://github.com/cnr-isti-vclab/corto#building), with `cmake` and `make`.
- Node.js 12+
- Python3 for encoding frame number into images to support Firefox. If your users are using only Chromium based browsers, You can skip encoding frame numbers and hence don't need python3.
- `ffmpeg` for to create video texture from images.

### Geometry data (Mesh)

- Place your `obj` files in [`encoder/assets/`](encoder/assets/) directory.
- Convert them to `ply` files using `meshlab`. (This step is optional, Some `obj` files caused issues with singularities on certain vertices and `ply` files mitigated that)
- Compress geometry `obj`/`ply` files with `corto`. (Windows & Linux executables are present in this directory).
  - It can also be built from source: <https://github.com/cnr-isti-vclab/corto#building>
- Pass output file name to the Encoder, and run the script.

```bash
cd encoder # You must be in this directory, before running encoder script
node src/Encoder30.js output.drcs
```

It generates a `.drcs` file and `.manifest` file.


### Texture data (mp4)

Texture is stored as an H264 video.

Due to inadequacies in iOS frame sync (as well as multithreaded framesync issues in Unity) we are baking the frame number directly into the texture. This frame sync is 8px high, 128px wide. After some experimentation, we found that this is resistant to aliasing and macroblocking in video. However, it might cause issues with your textures unless you pre-process your textures be offset by 8 px from the bottom of your image. The next version will autoscale your UVs to have 8px available at the bottom.

- Place all the images in a directory, and run [`encoder_legacy/texture_encoder.py`](encoder_legacy/texture_encoder.py) script. Pass the images directory as argument. This step can be omitted if you don't want to target Firefox users.
- Place all the images in a directory, and run this `ffmpeg` command, to create a video.
- Frame rate of the UVOL video depends on the frame rate set here.

```bash
ffmpeg -framerate 30 -s 1024x1024 -pattern_type glob -i '*.png' -vcodec libx264 -pix_fmt yuv420p output.mp4
```

- Audio can be added to the output video like this.

```bash
ffmpeg -i output.mp4 -i input.mp3 -c copy -map 0:v:0 -map 1:a:0 output-with-audio.mp4
```

## Miscellaneous

- All files (`drcs`, `manifest`, `mp4`) must have same name.
- Frame rate of the video is controlled by video texture.
- For decoding (playing), currently WebGL is supported (especially three.js), Unreal and Unity will come in the next release.
- Encoded .uvol files are cross platform, but currently the decoder is written for the web only. Want Unity, Unreal, examples in PlayCanvas and Babylon, etc? Submit and issue and sponsor our project:
<https://opencollective.com/etherealengine>

Or find us on Discord!
<https://discord.gg/xrf>


### Collaborators Wanted!

If you are proficient in C++, python, JS, Unity/C#, or you want to support this project creatively or financially, please get in touch!