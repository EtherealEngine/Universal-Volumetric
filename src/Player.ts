import V1Player from "./V1/player";
import V2Player from "./V2/player";

import {
    BufferGeometry,
    Float32BufferAttribute,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    sRGBEncoding,
    Texture,
    Uint16BufferAttribute,
    WebGLRenderer
} from 'three'

export enum PlayMode {
    single = 'single',
    random = 'random',
    loop = 'loop',
    singleloop = 'singleloop'
}

type onMeshBufferingCallback = (progress: number) => void
type onFrameShowCallback = (frame: number) => void


export type PlayerConstructorArgs = {
    renderer: WebGLRenderer
    playMode?: PlayMode
    paths: Array<string>
    encoderWindowSize?: number
    encoderByteLength?: number
    videoSize?: number
    video?: HTMLVideoElement
    onMeshBuffering?: onMeshBufferingCallback
    onFrameShow?: onFrameShowCallback
    worker?: Worker
    material?: MeshBasicMaterial | MeshBasicMaterial
    version?: string
}


export default function Player({
    renderer,
    playMode,
    paths,
    encoderWindowSize = 8,
    encoderByteLength = 16,
    videoSize = 1024,
    video = null,
    onMeshBuffering = null,
    onFrameShow = null,
    worker = null,
    material = new MeshBasicMaterial(),
    version = '1.0.0'
}: PlayerConstructorArgs) {
    if (!version || version !== '2.0.0') {
        return new V1Player({
            renderer,
            playMode,
            paths,
            encoderWindowSize,
            encoderByteLength,
            videoSize,
            video,
            onMeshBuffering,
            onFrameShow,
            worker,
            material
        });
    } else {
        return new V2Player({
            renderer,
            playMode,
            paths,
            onMeshBuffering,
            onFrameShow,
            material
        });
    }
}