// import { CortoDecoder } from './corto'
import * as THREE from 'three';
import { DRACOLoader } from './lib/DRACOLoader.js';
import { CortoDecoder } from './lib/corto.js';

let _meshFilePath;
let _fileHeader;
let timer;

function isV2(version) {
  if (!version || version !== '2.0.0') return false;
  return true;
}

async function extractGeometryAttrs(
  compressedBuffer: ArrayBuffer,
  geometryCompression: string
) {
  let geometryAttrs;
  if (geometryCompression === 'draco') {
    const taskConfig = {
      attributeIDs: {
        position: 'POSITION',
        normal: 'NORMAL',
        color: 'COLOR',
        uv: 'TEX_COORD',
      },
      attributeTypes: {
        position: 'Float32Array',
        normal: 'Float32Array',
        color: 'Float32Array',
        uv: 'Float32Array',
      },
      useUniqueIDs: false,
      vertexColorSpace: THREE.SRGBColorSpace,
    };
    const bufferGeometry = await loader.decodeGeometry(
      compressedBuffer,
      taskConfig
    );
    geometryAttrs = {
      index: bufferGeometry.index.array,
      position: bufferGeometry.getAttribute('position').array,
      uv: bufferGeometry.getAttribute('uv').array,
    };
  } else {
    // defaulting to corto
    const decoder = new CortoDecoder(compressedBuffer);
    const bufferGeometry = decoder.decode();
    geometryAttrs = {
      index: bufferGeometry.index,
      position: bufferGeometry.position,
      uv: bufferGeometry.uv,
    };
  }
  return geometryAttrs;
}

function getRequestHeaders(fileHeader, frameStart: number, frameEnd: number) {
  if (isV2(fileHeader.version)) {
    const startFrameData = fileHeader.frameData[frameStart];
    const requestStartBytePosition = startFrameData[1];
    const requestEndBytePosition =
      frameEnd < fileHeader.length ? fileHeader.frameData[frameEnd][1] : '';
    return {
      range: `bytes=${requestStartBytePosition}-${requestEndBytePosition}`,
    };
  } else {
    const startFrameData = fileHeader.frameData[frameStart];
    const requestStartBytePosition = startFrameData.startBytePosition;
    const requestEndBytePosition =
      frameEnd < fileHeader.length
        ? fileHeader.frameData[frameEnd].startBytePosition
        : '';
    return {
      range: `bytes=${requestStartBytePosition}-${requestEndBytePosition}`,
    };
  }
}

function getSlice(
  buffer,
  fileHeader,
  frameStart: number,
  currentFrame: number
) {
  const startFrameData = fileHeader.frameData[frameStart];
  const currentFrameData = fileHeader.frameData[currentFrame];
  if (isV2(fileHeader.version)) {
    const fileReadStartPosition = currentFrameData[1] - startFrameData[1];

    if (currentFrame < fileHeader.frameData.length - 1) {
      const fileReadEndPosition =
        fileReadStartPosition +
        (fileHeader.frameData[currentFrame + 1][1] -
          fileHeader.frameData[currentFrame][1]);
      const slice = buffer.buffer.slice(
        fileReadStartPosition,
        fileReadEndPosition
      );
      return slice;
    } else if (currentFrame == fileHeader.frameData.length - 1) {
      const slice = buffer.buffer.slice(fileReadStartPosition);
      return slice;
    }
  } else {
    const fileReadStartPosition =
      currentFrameData.startBytePosition - startFrameData.startBytePosition;
    const fileReadEndPosition =
      fileReadStartPosition + currentFrameData.meshLength;
    const slice = buffer.buffer.slice(
      fileReadStartPosition,
      fileReadEndPosition
    );
    return slice;
  }
}

type requestPayload = {
  frameStart: number;
  frameEnd: number;
};

const loader = new DRACOLoader();
loader.setDecoderPath('./lib');

const messageQueue: requestPayload[] = [];

function startHandlerLoop({ meshFilePath, fileHeader }) {
  _meshFilePath = meshFilePath;
  _fileHeader = fileHeader;
  (globalThis as any).postMessage({ type: 'initialized' });

  timer = setInterval(async () => {
    if (messageQueue.length < 1) return;

    let { frameStart, frameEnd } = messageQueue.shift();

    try {
      const header = getRequestHeaders(_fileHeader, frameStart, frameEnd);

      const outgoingMessages = [];
      const transferables = [];

      const response = await fetch(_meshFilePath, {
        headers: header,
      }).catch((err) => {
        console.error('WORKERERROR: ', err);
      });

      const oldBuffer = await (response as Response).arrayBuffer();
      let newBuffer = new Uint8Array(
        oldBuffer
      ); /* need to create new buffer, due to detached ArrayBuffer error */

      for (let i = frameStart; i < frameEnd; i++) {
        const slice = getSlice(newBuffer, _fileHeader, frameStart, i);
        let keyframeNumber, geometryCompression;
        if (_fileHeader.version && _fileHeader.version == '2.0.0') {
          keyframeNumber = _fileHeader.frameData[i][0];
          geometryCompression = _fileHeader.geometryCompression;
        } else {
          keyframeNumber = _fileHeader.frameData[i].keyframeNumber;
          geometryCompression = 'corto'; // old compression format
        }
        const geometryAttrs = await extractGeometryAttrs(
          slice,
          geometryCompression
        );
        outgoingMessages.push({
          // frameNumber: currentFrameData.frameNumber,
          keyframeNumber: keyframeNumber,
          geometryAttrs,
        });

        transferables.push(geometryAttrs.index.buffer);
        transferables.push(geometryAttrs.position.buffer);
        transferables.push(geometryAttrs.uv.buffer);
      }
      newBuffer = null;
      (globalThis as any).postMessage(
        { type: 'framedata', payload: outgoingMessages },
        transferables
      );
    } catch (error) {
      (globalThis as any).postMessage({ type: 'framedata', payload: [] });
      console.error('WORKERERROR: ', error, frameStart, frameEnd);
    }
  }, 100);
}

(globalThis as any).onmessage = function (e) {
  if (e.data.type === 'initialize') {
    messageQueue.length = 0;
    if (timer) clearInterval(timer);
    startHandlerLoop(e.data.payload);
  }
  if (e.data.type === 'request') {
    messageQueue.push(e.data.payload);
  }
};
