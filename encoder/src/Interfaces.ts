import { BufferGeometry } from 'three';
export interface IFrameData {
    frameNumber: number;
    startBytePosition: number;
    vertices: number;
    faces: number;
    meshLength: number;
}

export interface IFileHeader {
    maxVertices: number;
    maxTriangles: number;
    frameData: IFrameData[];
}

export interface KeyframeBuffer {
    keyframeNumber: number;
    frameNumber: number;
    bufferGeometry: Buffer | BufferGeometry | null;
}

export interface IFrameBuffer {
    keyframeNumber: number;
    frameNumber: number;
    vertexBuffer: any;
}
