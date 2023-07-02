# Universal Volumetric

The open source Universal Volumetric (".uvol") compressed interchange format for streaming mesh sequences.

## UVOL 2

UVOL2 introduces usage of Compressed Array Textures, in the form of KTX2 containerized files. These support wide variety of devices due to on the fly transcoding and due to KTX2's small file size, it comes with bandwidth advantages.

In this version, we also changed the geometry compression method from Corto to DRACO. Current version of UVOL2 needs directories of files which represent individual frames, and a manifest file which points to these directories. The Encoder helps you to convert the data you have to the data player needs. The encoder script is located at: [`scripts/Encoder.py`](scripts/Encoder.py).

User have to input a `config.json` file to the Encoder script. This config file is processed in a certain order that is explained below.

```ts
{
    name: string,
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
    FRAME_RATE: number,
    AudioURL: string,
    OutputDirectory: string
}
```

Above is the type spec for the config file. It is not required to specify all the fields in the config file.

Let's start with mandatory fields.

- **`name`**: This represents the name of the manifest file (or) basically to denote a particular Volumetric video.
- **`FRAME_RATE`**: As the name suggests, this represents the frame rate of the volumetric video.
- **`KTX2_BATCH_SIZE`**: This represents number of frames are packed (or to be packed) in a single KTX2 video texture.
- **`OutputDirectory`**: The processed files are stored in this directory (labelled with their formats).

Now, we discuss about how geometry data is processed: ![](https://i.imgur.com/HC0xuOO.png)

Followed by texture data processing: ![](https://i.imgur.com/xQs4uQR.png)

### Demo

Here's a short sped up version of encoder on duty! [![asciicast](https://asciinema.org/a/593720.png)](https://asciinema.org/a/593720)

### Collaborators Wanted!

If you are proficient in C++, python, JS, Unity/C#, or you want to support this project creatively or financially, please get in touch!

### Example

Current uvol files consist of a .uvol binary, manifest file and video texture. Future versions will embed everything into the uvol binary or in a single MP4 container.

Currently playback works in WebGL with three.js and Unity. Android and iOS are in development, Unreal support is on the roadmap (intrepid C++ developers should be able to port this in a day by reading the source from other examples, since the core codec is C++ based).

### Requirements

For encoding, you will Python 3 and blender python package installed.

For decoding, currently WebGL is supported (especially three.js), Unreal and Unity will come in the next release.

You will need a mesh and texture sequence in ABC/OBJ and PNG/JPG formats respectively.

Find us on Discord! https://discord.gg/xrf
