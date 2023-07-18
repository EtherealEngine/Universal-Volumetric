import { CortoDecoder } from '../lib/corto'

let _meshFilePath
let _fileHeader
let timer

type requestPayload = {
  frameStart: number
  frameEnd: number
}

const messageQueue: requestPayload[] = []

function addMessageToQueue(payload: requestPayload) {
  messageQueue.push(payload)
  // console.log('Message added to queue', payload)
}

function startHandlerLoop({ meshFilePath, fileHeader }) {
  _meshFilePath = meshFilePath
  _fileHeader = fileHeader
  ;(globalThis as any).postMessage({ type: 'initialized' })

  timer = setInterval(async () => {
    if (messageQueue.length < 1) return

    let { frameStart, frameEnd } = messageQueue.shift()

    try {
      const startFrameData = _fileHeader.frameData[frameStart]
      const endFrameData = _fileHeader.frameData[frameEnd - 1]
      const requestStartBytePosition = startFrameData.startBytePosition
      const requestEndBytePosition = endFrameData.startBytePosition + endFrameData.meshLength

      const outgoingMessages = []

      const response = await fetch(_meshFilePath, {
        headers: {
          range: `bytes=${requestStartBytePosition}-${requestEndBytePosition}`
        }
      }).catch((err) => {
        console.error('WORKERERROR: ', err)
      })

      const buffer = await (response as Response).arrayBuffer()

      const transferables = []
      for (let i = frameStart; i < frameEnd; i++) {
        const currentFrameData = _fileHeader.frameData[i]

        const fileReadStartPosition = currentFrameData.startBytePosition - startFrameData.startBytePosition
        const fileReadEndPosition = fileReadStartPosition + currentFrameData.meshLength

        // Decode the geometry using Corto codec
        const slice = (buffer as ArrayBuffer).slice(fileReadStartPosition, fileReadEndPosition)
        const decoder = new CortoDecoder(slice)
        const bufferGeometry = decoder.decode()
        transferables.push(bufferGeometry.index.buffer)
        transferables.push(bufferGeometry.position.buffer)
        transferables.push(bufferGeometry.uv.buffer)

        // Add to the messageQueue
        outgoingMessages.push({
          frameNumber: currentFrameData.frameNumber,
          keyframeNumber: currentFrameData.keyframeNumber,
          bufferGeometry
        })
      }
      ;(globalThis as any).postMessage({ type: 'framedata', payload: outgoingMessages }, transferables)
    } catch (error) {
      ;(globalThis as any).postMessage({ type: 'framedata', payload: [] })
      console.error('WORKERERROR: ', error, frameStart, frameEnd)
    }
  }, 100)
}

;(globalThis as any).onmessage = function (e) {
  if (e.data.type === 'initialize') {
    messageQueue.length = 0
    if (timer) clearInterval(timer)
    startHandlerLoop(e.data.payload)
  }
  if (e.data.type === 'request') addMessageToQueue(e.data.payload)
}
