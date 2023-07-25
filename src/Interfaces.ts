export interface V1FrameData {
  frameNumber: number
  keyframeNumber: number
  startBytePosition: number
  vertices: number
  faces: number
  meshLength: number
}

export interface V1FileHeader {
  maxVertices: number
  maxTriangles: number
  frameData: V1FrameData[]
  frameRate: number
}


interface KTX2EncodeOptions {
  /**
   * The compression_level parameter controls the encoder perf vs. file size tradeoff for ETC1S files
   * It does not directly control file size vs. quality - see qualityLevel
   * Range is [0,6]
   * @default 2
   */
  compressionLevel?: number;
  /**
   * Sets the ETC1S encoder's quality level, which controls the file size vs. quality tradeoff
   * Range is [1,256]
   * @default 128
   */
  qualityLevel?: number;
}

export interface DracoEncodeOptions {
  /**
   * Draco compression level. [0-10], most=10, least=0, default=7.
   */
  "compressionLevel"?: number;
  /**
   * The number of bits to quantize the position attribute. Default=11.
   */
  "positionQuantizationBits"?: number;
  /**
   * The number of bits to quantize the texture coordinate attribute. Default=10.
   */
  "textureQuantizationBits"?: number;
  /**
   * The number of bits to quantize the normal vector attribute. Default=8.
   */
  "normalQuantizationBits"?: number;
  /**
   * The number of bits to quantize any generic attribute. Default=8.
   */
  "genericQuantizationBits"?: number;
}

export interface AudioInput {
  /**
   * Path to audio an audio file. 
   */
  "path": string;
}

export interface GeometryInput {
  /**
   * Path to geometry data. This can be a plain file path, or a file path with an index substitution pattern.
   *
   * Supported formats:
   * Alembic - should be specified as a plain file path, eg: input/geometry.abc
   * OBJ - should be specified with an index pattern, eg: input/frame_[0001-1000].obj
   * 
   * When referencing indexed files, the index should be specified as a range, eg: frame_[00001-10000].obj
   * If the first frame is 0, the index should be specified with all zeros, eg: frame_[00000-10000].obj
   * Indexed file names should be 0-padded to the same number of digits, eg: frame_00001.obj, frame_00002.obj, etc.
   * 
   */
  "path": string;
  /**
   * Frame rate of the geometry data. This is only required for OBJ files.
   */
  "frameRate": number;
}


export interface TextureInput {
  /**
   * Path to texture data. This can be a plain file path, or a file path with an index substitution pattern.
   *
   * Supported formats:
   * PNG - should be specified as with an index pattern, eg: input/baseColor/frame_[00001-10000].png
   * JPEG - should be specified as with an index pattern, eg: input/baseColor/frame_[00001-10000].jpg
   * MP4 - should be specified as a single file, eg: input/baseColor.mp4
   * 
   * When referencing indexed files, the index should be specified as a range, eg: frame_[00001-10000].png
   * If the first frame is 0, the index should be specified with all zeros, eg: frame_[00000-10000].png
   * Indexed file names should be 0-padded to the same number of digits, eg: frame_00001.png, frame_00002.png, etc.
   * 
   * If the path is a single file, the frame number should be omitted, eg: baseColor.mp4
   */
  "path": string;
  /**
   * Frame rate of the texture data. When using indexed files, each file is assumed to be a single frame.
   */
  "frameRate": number;
  /**
   * A tag to identify this texture input. 
   * 
   * Default: "default"
   */
  "tag"?: string;
}

export type AudioFileFormat = 'mp3'
export type GeometryFileFormat = 'obj' | 'draco'
export type TextureFileFormat = 'mp4' | 'ktx2' // | 'astc.ktx' | 'etc1.ktx'

export interface GeometryTarget {
  /**
   * The frame rate to encode the geometry data at.
   */
  "frameRate": number,

  /**
   * Total Geometry frames
   */
  "frameCount": number,

  /**
   * Geometry encoding format.
   * 
   */
  "format": GeometryFileFormat
}

export interface TextureTarget {
  /**
   * Texture encoding format.
   */
  "format": TextureFileFormat
  /**
   * Resolution to encode the texture data at.
   */
  "resolution": [number, number],
}

export interface KTX2TextureTarget extends TextureTarget {
  "format": "ktx2",
  /**
   * The number of frames to encode in each KTX2 file
   */
  "sequenceSize": number,
  /**
   * Total number of sequences
   */
  "sequenceCount": number,
  /**
   * The frame rate to encode the texture data at.
   */
  "frameRate": number,
}

export interface V2FileHeader {
  "version": "v2",
  "input": {
    "audio"?: AudioInput,
    "geometry": GeometryInput,
    "texture": {
      "baseColor": TextureInput | TextureInput[],
      "normal"?: TextureInput | TextureInput[],
      "metallicRoughness"?: TextureInput | TextureInput[],
      "emissive"?: TextureInput | TextureInput[],
      "occlusion"?: TextureInput | TextureInput[]
    }
  },
  "output": {
    "audio": {
      /**
       * Path template to the output audio data.
       * 
       * The following template substitutions are supported:
       * 
       * [ext] - the file extension of the texture, (e.g., ".mp3", ".wav", etc.)
       * 
       * E.g. "output/audio[ext]"
       */
      "path": string,
      /**
       * The audio encoding format.
       * 
       * The following options are supported:
       * "mp3" - MP3 audio
       */
      "formats": AudioFileFormat[]
    },
    "geometry": {
      /**
       * Draco encoding options for the geometry data.
       */
      "draco": DracoEncodeOptions,
      /**
       * Encoding targets for the geometry data.
       */
      "targets": Record<string, GeometryTarget>
      /**
       * Path template to the output geometry data.
       * 
       * The following template substitutions are supported:
       * [target] - one of the geometry targets, defined in the "targets" section
       * [index] - the index of the frame
       * [ext] - the file extension of the data
       * 
       * E.g. "output/geometry_[target]/[index][ext]"
       */
      "path": string,
    },
    "texture": {
      /**
       * KTX2 encoding options for the texture data.
       */
      "ktx2": KTX2EncodeOptions,
      /**
       * Encoding targets for the texture data.
       */
      "targets": Record<string, KTX2TextureTarget>,
      /**
       * Path template to the output texture data.
       * 
       * The following template substitutions are supported:
       * [target] - one of the texture targets, defined in the "targets" section
       * [type] - the type of texture, eg: "baseColor", "metallicRoughness", "normal"
       * [tag] - a custom tag for describing texture variants, eg: "default", "red_dress", "blue_dress", etc.
       * [index] - 0-padded index for each file with the same extension, e.g., ("000001", "000002", etc.)
       * [ext] - the file extension of the texture, (e.g., ".mp4", ".ktx2", ".astc.ktx", etc.)
       * 
       * E.g. "output/texture_[target]_[type]_[tag]/[index][ext]""
       */
      "path": string,
    }
  }
}

export type FileHeader = V1FileHeader | V2FileHeader

export interface onMeshBufferingCallback {
  (progress: number): void
}

export interface onFrameShowCallback {
  (frame: number): void
}

export interface onTrackEndCallback {
  (): void
}

export enum PlayMode {
  single = 'single',
  random = 'random',
  loop = 'loop',
  singleloop = 'singleloop',
  unmanaged = 'unmanaged'
}

export const FORMATS_TO_EXT = {
  'mp3': '.mp3',
  'draco': '.drc',
  'ktx2': '.ktx2'
}