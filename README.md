# Universal Volumetric

The open source Universal Volumetric compressed interchange format for streaming mesh sequences.

## UVOL 2.0

UVOL 2.0 introduces usage of Compressed Array Textures, via KTX2 supercompressed textures, allowing volumetric media to use much less texture memory than UVOL 1.0!

The geometry compression method has also been updated from Corto to Draco. UVOL 2.0 uses directories of files which represent individual frames or frame sequneces, and a manifest file which points to these files. The Encoder helps you to convert the data you have to the data the UVOL player needs. The encoder script is located at: [`scripts/Encoder.py`](scripts/Encoder.py).

The Encoder script requires a `json` configuration file. This config file is processed in a certain order that is explained below.

```ts
{
    name: string,
    draco_encoder: string,
    basisu: string,
    ABCFilePath: string,
    OBJFilesPath: string,
    DRACOFilesPath: string,
    Q_POSITION_ATTR: number,
    Q_TEXTURE_ATTR: number,
    Q_NORMAL_ATTR: number,
    Q_GENERIC_ATTR: number,
    DRACO_COMPRESSION_LEVEL: number,
    ImagesPath: string,
    KTX2_FIRST_FILE: number,
    KTX2_FILE_COUNT: number,
    KTX2_BATCH_SIZE: number,
    KTX2FilesPath: string,
    GEOMETRY_FRAME_RATE: number,
    TEXTURE_FRAME_RATE: number,
    AudioURL: string,
    OutputDirectory: string
}
```

Above is the type spec for the config file. It is not required to specify all the fields in the config file.

Let's start with mandatory fields.

- **`name`**: This represents the name of the manifest file (or) basically to denote a particular Volumetric video.
- **`GEOMETRY_FRAME_RATE`**: This represents how many geometry frames are rendered per second.
- **`TEXTURE_FRAME_RATE`**: This represents how many texture frames are rendered per second. _It is advisable to have both frame rates factors of one another. It helps the player to avoid ambiguities in calculating frame numbers._
- **`KTX2_BATCH_SIZE`**: This represents number of frames are packed (or to be packed) in a single KTX2 video texture.
- **`OutputDirectory`**: The processed files are stored in this directory (labelled with their formats).

Now, we discuss how geometry data is processed: ![](https://i.imgur.com/HC0xuOO.png)

Followed by texture data processing: ![](https://i.imgur.com/xQs4uQR.png)

Below paths must have the file pattern mentioned.

- OBJFilesPath: Eg: `/home/3D/export_#####.obj`
- DRACOFilesPath: Eg: `/home/3D/export_#####.drc`
- ImagesPath: Eg: `/home/3D/export_#####.jpg`
- KTX2FilesPath: Eg: `/home/3D/export_#####.ktx2`

Frame numbers are calculated from the file names itself, Hence file names should be indexed (with padding). The manifest file also uses this notation in specifying `DRCURLPattern` and `KTX2URLPattern`. The indexing can be either 0 based indexing or 1 based indexing, but make sure it is consistent between Geometry files and Texture files. These indices are vital for the player to calculate the correct frame and render it with the right geometry/texture.

### Usage

- Encoder uses `bpy` python package which only works with selected python versions: Python >=3.7, <3.8.
- Make sure you have `draco_encoder` and `basisu` binaries somewhere. The paths of those binaries can be either passed to the project-config, or they can be omitted if they're already in the path.
- A template `project-config.json` can be created with this command: `python3 scripts/Encoder.py create-template`.
- Fill the config file and pass it to the Encoder: `python3 scripts/Encoder.py project-config.json`. (Encoder raises errors if something isn't alright)

### Demo

Here's a short sped up version of encoder on duty! [![asciicast](https://asciinema.org/a/593720.png)](https://asciinema.org/a/593720)

### Collaborators Wanted!

If you are proficient in C++, python, JS, Unity/C#, or you want to support this project creatively or financially, please get in touch!

### Example

Currently playback works in WebGL with three.js. Unity & Unreal support is on the roadmap.

### Requirements

For encoding, you will Python 3 and blender python package installed.

For decoding, currently WebGL is supported (especially three.js), Unreal and Unity will come in a future release.

You will need a mesh and texture sequence in ABC/OBJ and PNG/JPG formats respectively.

Find us on Discord! https://discord.gg/xrf
