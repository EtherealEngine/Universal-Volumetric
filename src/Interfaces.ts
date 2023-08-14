import {
  RGBA_ASTC_4x4_Format,
  RGBA_ASTC_5x4_Format,
  RGBA_ASTC_5x5_Format,
  RGBA_ASTC_6x5_Format,
  RGBA_ASTC_6x6_Format,
  RGBA_ASTC_8x5_Format,
  RGBA_ASTC_8x6_Format,
  RGBA_ASTC_8x8_Format,
  RGBA_ASTC_10x5_Format,
  RGBA_ASTC_10x6_Format,
  RGBA_ASTC_10x8_Format,
  RGBA_ASTC_10x10_Format,
  RGBA_ASTC_12x10_Format,
  RGBA_ASTC_12x12_Format
} from 'three'

export interface V1FrameData {
  frameNumber: number
  keyframeNumber: number
  startBytePosition: number
  vertices: number
  faces: number
  meshLength: number
}

export interface V1Schema {
  maxVertices: number
  maxTriangles: number
  frameData: V1FrameData[]
  frameRate: number
}

export interface AudioInput {
  /**
   * Path to audio an audio file.
   */
  path: string
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
   */
  path: string
  /**
   * Frame rate of the geometry data. This is only required for OBJ files.
   */
  frameRate: number
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
  path: string
  /**
   * Frame rate of the texture data. When using indexed files, each file is assumed to be a single frame.
   */
  frameRate: number
  /**
   * A tag to identify this texture input.
   *
   * Default: "default"
   */
  tag?: string
}

export type AudioFileFormat = 'mp3' | 'wav' | 'ogg'
export type GeometryFormat = 'draco'
export type TextureFormat = 'ktx2' | 'astc/ktx'
export type OptionalTextureType = 'normal' | 'metallicRoughness' | 'emissive' | 'occlusion'
export type TextureType = 'baseColor' | OptionalTextureType

export interface DracoEncodeOptions {
  /**
   * Draco compression level. [0-10], most=10, least=0, default=0.
   */
  compressionLevel?: number
  /**
   * The number of bits to quantize the position attribute. Default=11.
   */
  positionQuantizationBits?: number
  /**
   * The number of bits to quantize the texture coordinate attribute. Default=10.
   */
  textureQuantizationBits?: number
  /**
   * The number of bits to quantize the normal vector attribute. Default=8.
   */
  normalQuantizationBits?: number
  /**
   * The number of bits to quantize any generic attribute. Default=8.
   */
  genericQuantizationBits?: number
}
export interface GeometryTarget {
  /**
   * Geometry encoding format.
   */
  format: GeometryFormat
  /**
   * The frame rate to encode the geometry data at.
   */
  frameRate: number
  /**
   * Total frame count. This information is supplied by the encoder.
   */
  frameCount?: number
  /**
   * Draco encoding options for the geometry data.
   */
  settings: DracoEncodeOptions
}

export interface TextureTarget {
  /**
   * Texture encoding format.
   */
  format: TextureFormat
  /**
   * The frame rate to encode the geometry data at.
   */
  frameRate: number
  /**
   * Total frame count. This information is supplied by the encoder.
   */
  frameCount?: number
}

export interface KTX2EncodeOptions {
  /**
   * The compression_level parameter controls the encoder perf vs. file size tradeoff for ETC1S files
   * It does not directly control file size vs. quality - see qualityLevel
   * Range is [0, 5]
   * @default 1
   */
  compressionLevel?: number
  /**
   * Sets the ETC1S encoder's quality level, which controls the file size vs. quality tradeoff
   * Range is [1, 255]
   * @default 128
   */
  qualityLevel?: number
  /**
   * Resize images to @e width X @e height.
   * If not specified, uses the image as is.
   */
  resolution: {
    width: number
    height: number
  }

  /**
   * Vertically flip images
   */
  lower_left_maps_to_s0t0?: boolean
}
export interface KTX2TextureTarget extends TextureTarget {
  format: 'ktx2'
  settings: KTX2EncodeOptions
}

export interface ASTCEncodeOptions {
  blocksize:
    | '4x4'
    | '5x4'
    | '5x5'
    | '6x5'
    | '6x6'
    | '8x5'
    | '8x6'
    | '10x5'
    | '10x6'
    | '8x8'
    | '10x8'
    | '10x10'
    | '12x10'
    | '12x12'
  quality: '-fastest' | '-fast' | '-medium' | '-thorough' | '-verythorough' | '-exhaustive' | number
  yflip?: boolean
  /**
   * Resize images to @e width X @e height.
   * If not specified, uses the image as is.
   */
  resolution: {
    width: number
    height: number
  }
}

export interface ASTCTextureTarget extends TextureTarget {
  format: 'astc/ktx'
  settings: ASTCEncodeOptions
}

export interface V2Schema {
  version: string // "2.0"
  input: {
    audio?: AudioInput
    geometry: GeometryInput | GeometryInput[]
    texture: {
      baseColor: TextureInput | TextureInput[]
      normal?: TextureInput | TextureInput[]
      metallicRoughness?: TextureInput | TextureInput[]
      emissive?: TextureInput | TextureInput[]
      occlusion?: TextureInput | TextureInput[]
    }
  }
  output: {
    audio?: {
      /**
       * Path template to the output audio data.
       *
       * The following template substitutions are supported:
       *
       * [ext] - the file extension of the texture, (e.g., ".mp3", ".wav", etc.)
       *
       * E.g. "output/audio[ext]"
       */
      path: string
      /**
       * The audio encoding format.
       *
       * The following options are supported:
       * "mp3" - MP3 audio
       */
      formats: AudioFileFormat[]
    }
    geometry: {
      /**
       * Encoding targets for the geometry data.
       */
      targets: Record<string, GeometryTarget>
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
      path: string
    }
    texture: {
      baseColor: {
        targets: Record<string, KTX2TextureTarget | ASTCTextureTarget>
      }
      /**
       * Path template to the output texture data.
       *
       * The following template substitutions are supported:
       * [target] - one of the texture targets, defined in the "targets" section
       * [tag] - a custom tag for describing texture variants, eg: "default", "red_dress", "blue_dress", etc.
       * [index] - 0-padded index for each file with the same extension, e.g., ("000001", "000002", etc.)
       * [ext] - the file extension of the texture, (e.g., ".mp4", ".ktx2", ".astc.ktx", etc.)
       *
       * E.g. "output/texture_[target]_[type]_[tag]/[index][ext]""
       */
      path: string
    } & Partial<{
      [key in OptionalTextureType]: {
        targets: Record<string, KTX2TextureTarget | ASTCTextureTarget>
      }
    }>
  }
}

export type UVOLManifestSchema = V1Schema | V2Schema

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
  mp3: '.mp3',
  wav: '.wav',
  draco: '.drc',
  ktx2: '.ktx2',
  'astc/ktx': '.ktx'
}

// more value => more priority
export const TEXTURE_FORMAT_PRIORITY = {
  ktx2: 0,
  'astc/ktx': 1 // if astc is supported
}

export const ASTC_BLOCK_SIZE_TO_FORMAT = {
  '4x4': RGBA_ASTC_4x4_Format,
  '5x4': RGBA_ASTC_5x4_Format,
  '5x5': RGBA_ASTC_5x5_Format,
  '6x5': RGBA_ASTC_6x5_Format,
  '6x6': RGBA_ASTC_6x6_Format,
  '8x5': RGBA_ASTC_8x5_Format,
  '8x6': RGBA_ASTC_8x6_Format,
  '10x5': RGBA_ASTC_10x5_Format,
  '10x6': RGBA_ASTC_10x6_Format,
  '8x8': RGBA_ASTC_8x8_Format,
  '10x8': RGBA_ASTC_10x8_Format,
  '10x10': RGBA_ASTC_10x10_Format,
  '12x10': RGBA_ASTC_12x10_Format,
  '12x12': RGBA_ASTC_12x12_Format
}
