import { BufferGeometry } from 'three';
export interface IFrameData {
    frameNumber: number;
    keyframeNumber: number;
    startBytePosition: number;
    vertices: number;
    faces: number;
    meshLength: number;
}

export interface IFileHeader {
    maxVertices: number;
    maxTriangles: number;
    frameData: IFrameData[];
    frameRate: number;
}

export interface KeyframeBuffer {
    keyframeNumber: number;
    frameNumber: number;
    bufferGeometry: BufferGeometry | null;
}

export interface IFrameBuffer {
    keyframeNumber: number;
    frameNumber: number;
    vertexBuffer: any;
}
