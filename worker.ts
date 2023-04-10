// import { CortoDecoder } from './corto'
import * as THREE from "three";
import { DRACOLoader } from "./DRACOLoader.js";

let _meshFilePath
let _fileHeader
let timer

function dracoToThree(dracoBuffer) {
  const taskConfig = {
    attributeIDs: {
      position: 'POSITION',
      normal: 'NORMAL',
      color: 'COLOR',
      uv: 'TEX_COORD'
    },
    attributeTypes: {
      position: 'Float32Array',
      normal: 'Float32Array',
      color: 'Float32Array',
      uv: 'Float32Array'
    },
    useUniqueIDs: false,
    vertexColorSpace: THREE.SRGBColorSpace,
  };
  const geometry = loader.decodeGeometry(dracoBuffer, taskConfig);
  return geometry;
}

type requestPayload = {
  frameStart: number
  frameEnd: number
}

const loader = new DRACOLoader();
loader.setDecoderPath("./");

const messageQueue: requestPayload[] = []

function addMessageToQueue(payload: requestPayload) {
  messageQueue.push(payload)
  // console.log('Message added to queue', payload)
}

function startHandlerLoop({ meshFilePath, fileHeader }) {
  _meshFilePath = meshFilePath
  _fileHeader = fileHeader
    ; (globalThis as any).postMessage({ type: 'initialized' })

  timer = setInterval(async () => {
    if (messageQueue.length < 1) return

    let { frameStart, frameEnd } = messageQueue.shift()

    try {
      const startFrameData = _fileHeader.frameData[frameStart]
      const endFrameData = _fileHeader.frameData[frameEnd - 1]
      const requestStartBytePosition = startFrameData.startBytePosition
      const requestEndBytePosition = endFrameData.startBytePosition + endFrameData.meshLength

      const outgoingMessages = []
      const transferables = [];

      const response = await fetch(_meshFilePath, {
        headers: {
          range: `bytes=${requestStartBytePosition}-${requestEndBytePosition}`
        }
      }).catch((err) => {
        console.error('WORKERERROR: ', err)
      })

      const oldBuffer = await (response as Response).arrayBuffer();
      let newBuffer = new Uint8Array(oldBuffer); /* need to create new buffer, due to detached ArrayBuffer error */
      

        for (let i = frameStart; i < frameEnd; i++) {
          const currentFrameData = _fileHeader.frameData[i]

          const fileReadStartPosition = currentFrameData.startBytePosition - startFrameData.startBytePosition
          const fileReadEndPosition = fileReadStartPosition + currentFrameData.meshLength

          // Decode the geometry using Corto codec
          const slice = newBuffer.buffer.slice(fileReadStartPosition, fileReadEndPosition)
          // const decoder = new CortoDecoder(slice)
          // const decoder: draco3d.Decoder = new decoderModule.Decoder();
          const bufferGeometry: THREE.BufferGeometry = await dracoToThree(slice);
          // const bufferGeometry = decoder.decode()
          // transferables.push(bufferGeometry.index)
          // transferables.push(bufferGeometry.position)
          // transferables.push(bufferGeometry.uv)

          // Add to the messageQueue

          const geometryAttrs = {
            index: bufferGeometry.index.array,
            position: bufferGeometry.getAttribute('position').array,
            uv: bufferGeometry.getAttribute('uv').array
          }

          outgoingMessages.push({
            frameNumber: currentFrameData.frameNumber,
            keyframeNumber: currentFrameData.keyframeNumber,
            geometryAttrs
          })

          transferables.push(geometryAttrs.index.buffer);
          transferables.push(geometryAttrs.position.buffer);
          transferables.push(geometryAttrs.uv.buffer);
        }
        newBuffer = null;
        ; (globalThis as any).postMessage({ type: 'framedata', payload: outgoingMessages }, transferables);
      } catch (error) {
        ; (globalThis as any).postMessage({ type: 'framedata', payload: [] })
        console.error('WORKERERROR: ', error, frameStart, frameEnd)
      }
    }, 100)
}

; (globalThis as any).onmessage = function (e) {
  if (e.data.type === 'initialize') {
    messageQueue.length = 0
    if (timer) clearInterval(timer)
    startHandlerLoop(e.data.payload)
  }
  if (e.data.type === 'request') addMessageToQueue(e.data.payload)
}
