export interface IFrameData {
    frameNumber: number;
    keyframeNumber: number;
    startBytePosition: number;
    vertices: number;
    faces: number;
    meshLength: number;
}

export interface V1FileHeader {
    maxVertices: number;
    maxTriangles: number;
    frameData: IFrameData[];
    frameRate: number;
}

export interface V2FileHeader {
    Version: string;
    DRCURLPattern: string;
    KTX2URLPattern: string;
    AudioURL: string;
    BatchSize: number;
    GeometryFrameCount: number;
    TextureSegmentCount: number;
    GeometryFrameRate: number;
    TextureFrameRate: number;
}

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
    singleloop = 'singleloop'
}