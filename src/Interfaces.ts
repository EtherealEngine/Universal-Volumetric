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

export type TextureType = "baseColor" | "normal" | "metallicRoughness" | "emissive" | "occlusion"

export interface TextureTarget {
  /**
   * Texture encoding format.
   */
  "format": TextureFileFormat
  /**
   * Resolution to encode the texture data at.
   */
  "resolution": [number, number],
  /**
   * Type
   */
  "type": TextureType|TextureType[]
  /**
   * 
   */
  "tag"?: string
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

export interface V2Schema {
  "version": "v2",
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
    "format": AudioFileFormat|AudioFileFormat[]
  },
  "geometry": {
    /**
     * Encoding targets for the geometry data.
     */
    "targets": Record<string, GeometryTarget>
    /**
     * Path template to the output geometry data.
     * 
     * The following template substitutions are supported:
     * [target] - one of the geometry targets, defined in the "targets" section
     * [######] - 0-padded index for each file with the same extension, e.g., ("000001.drc", "000002.drc", etc.)
     * [ext] - the file extension of the data
     * 
     * E.g. "output/geometry_[target]/[######][ext]"
     */
    "path": string,
  },
  "texture": {
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
     * [######] - 0-padded index for each file with the same extension, e.g., ("000001", "000002", etc.)
     * [ext] - the file extension of the texture, (e.g., ".mp4", ".ktx2", ".astc.ktx", etc.)
     * 
     * E.g. "output/texture_[target]_[type]_[tag]/[######][ext]""
     */
    "path": string,
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
  'mp3': '.mp3',
  'draco': '.drc',
  'ktx2': '.ktx2'
}