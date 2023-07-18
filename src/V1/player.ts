import {
  BufferGeometry,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  sRGBEncoding,
  Texture,
  Uint16BufferAttribute,
  WebGLRenderer
} from 'three'

import { onFrameShowCallback, onMeshBufferingCallback, onTrackEndCallback, V1FileHeader } from '../Interfaces'

export type PlayerConstructorArgs = {
  renderer: WebGLRenderer
  mesh: Mesh
  encoderWindowSize?: number
  encoderByteLength?: number
  videoSize?: number
  video?: HTMLVideoElement
  onMeshBuffering?: onMeshBufferingCallback
  onFrameShow?: onFrameShowCallback
  worker?: Worker
  onTrackEnd: onTrackEndCallback
  targetFramesToRequest?: number
}

export default class Player {
  static defaultWorkerURL = new URL('./worker.build.js', import.meta.url).href

  // Public Fields
  public renderer: WebGLRenderer
  public mesh: Mesh
  public speed: number = 1.0 // Multiplied by framerate for final playback output rate
  public loop: boolean = true
  public encoderWindowSize = 8 // length of the databox
  public encoderByteLength = 16
  public videoSize = 1024
  public waitForVideoLoad = 3 //3 seconds
  public autoPreview = true
  public targetFramesToRequest

  public useVideoRequestCallback: boolean

  public pauseOnNextTrack: boolean = false
  public pauseOnNextFrame: boolean = false

  // Three objects
  public material: MeshBasicMaterial
  public bufferGeometry: BufferGeometry
  public failMaterial?: MeshBasicMaterial

  // Private Fields
  private manifestFilePath: string
  private _video: HTMLVideoElement = null
  private _videoTexture: Texture = null
  private meshBuffer: Map<number, BufferGeometry> = new Map()
  private _worker: Worker
  private onMeshBuffering: onMeshBufferingCallback | null = null
  private onFrameShow: onFrameShowCallback | null = null
  private onTrackEnd: onTrackEndCallback | null = null
  fileHeader: V1FileHeader
  tempBufferObject: BufferGeometry

  private videoCtx: CanvasRenderingContext2D
  private counterCtx: CanvasRenderingContext2D

  private isWorkerReady: boolean = false
  private workerPendingRequests: number = 0

  private maxNumberOfFrames: number
  currentMeshFrame: number = 0
  currentVideoFrame: number = 0
  nextFrameToRequest: number = 0

  get video() {
    return this._video
  }

  get numberOfFrames() {
    return this.fileHeader?.frameData.length || 0
  }

  constructor({
    renderer,
    mesh,
    encoderWindowSize = 8,
    encoderByteLength = 16,
    videoSize = 1024,
    video = null,
    onMeshBuffering = null,
    onFrameShow = null,
    worker = null,
    onTrackEnd,
    targetFramesToRequest
  }: PlayerConstructorArgs) {
    this.renderer = renderer
    this.mesh = mesh

    this.onMeshBuffering = onMeshBuffering
    this.onFrameShow = onFrameShow

    this.encoderWindowSize = encoderWindowSize
    this.encoderByteLength = encoderByteLength
    this.maxNumberOfFrames = Math.pow(2, this.encoderByteLength) - 2
    this.videoSize = videoSize

    this._worker = worker ? worker : new Worker(Player.defaultWorkerURL, { type: 'module', name: 'UVOL' }) // spawn new worker;
    this._worker.onerror = console.error

    this.material = new MeshBasicMaterial({ color: 0xffffff })
    this.onTrackEnd = onTrackEnd
    this.targetFramesToRequest = targetFramesToRequest

    //create video element
    this._video = video ? video : document.createElement('video')
    this._video.crossOrigin = 'anonymous'
    this._video.playbackRate = 0
    this._video.playsInline = true
    this._video.preload = 'auto'
    this._video.muted = false
    this._video.autoplay = true

    const handleVideoFrame = (now, metadata) => {
      this._video.requestVideoFrameCallback(handleVideoFrame)
      if (!this.useVideoRequestCallback || !this.fileHeader) return
      const frameToPlay = Math.round(metadata.mediaTime * this.fileHeader.frameRate)
      this.processFrame(frameToPlay)
    }

    if ('requestVideoFrameCallback' in this._video) {
      this._video.requestVideoFrameCallback(handleVideoFrame)
      this.useVideoRequestCallback = true
    } else {
      this.useVideoRequestCallback = false
    }

    //set video texture
    if (this.useVideoRequestCallback) {
      // new VideoTexture(this._video) gives us less control over when the texture is updated
      this._videoTexture = new Texture(this._video)
      this._videoTexture.generateMipmaps = false
      this._videoTexture.minFilter = LinearFilter
      this._videoTexture.magFilter = LinearFilter
      ;(this._videoTexture as any).isVideoTexture = true
      ;(this._videoTexture as any).update = () => {}
    } else {
      //create canvases for video and counter textures
      const counterCanvas = document.createElement('canvas')
      this.counterCtx = counterCanvas.getContext('2d')
      this.counterCtx.canvas.width = this.encoderByteLength
      this.counterCtx.canvas.height = 1
      this.counterCtx.canvas.setAttribute('crossOrigin', 'Anonymous')

      const videoCanvas = document.createElement('canvas')
      this.videoCtx = videoCanvas.getContext('2d')
      this.videoCtx.canvas.width = this.videoCtx.canvas.height = this.videoSize
      this.videoCtx.canvas.setAttribute('crossOrigin', 'Anonymous')
      this.videoCtx.fillStyle = '#ACC'
      this.videoCtx.fillRect(0, 0, this.videoCtx.canvas.width, this.videoCtx.canvas.height)

      this._videoTexture = new Texture(this.videoCtx.canvas)
    }

    this._videoTexture.encoding = sRGBEncoding

    this.material.map = this._videoTexture

    this._worker.onmessage = (e) => {
      switch (e.data.type) {
        case 'initialized':
          this.isWorkerReady = true
          break
        case 'framedata':
          this.workerPendingRequests--
          this.handleFrameData(e.data.payload)
          break
      }
    }
  }

  playTrack = (_fileHeader: V1FileHeader, _targetFramesToRequest, _manifestFilePath) => {
    this.fileHeader = _fileHeader
    this.manifestFilePath = _manifestFilePath

    for (const buffer of this.meshBuffer.values()) buffer?.dispose()
    this.meshBuffer.clear()
    this.nextFrameToRequest = 0

    this.resetWorker()
    this.video.playbackRate = 0
    if (_targetFramesToRequest) {
      this.targetFramesToRequest = _targetFramesToRequest
    }

    this.video.src = this.manifestFilePath.replace('.manifest', '.mp4')
    this.video.load()
    this.bufferLoop()
  }

  pause = () => {
    if (this._video.paused) {
      this._video.play()
    } else {
      this._video.pause()
    }
  }

  bufferLoop = () => {
    if (!this.video) return // has been disposed

    const minimumBufferLength = this.targetFramesToRequest * 2
    const meshBufferHasEnoughToPlay = this.meshBuffer.size >= minimumBufferLength * 3
    const meshBufferHasEnough = this.meshBuffer.size >= minimumBufferLength * 5

    if (this.workerPendingRequests < 3 && this.isWorkerReady && !meshBufferHasEnough) {
      const newLastFrame = Math.min(this.nextFrameToRequest + this.targetFramesToRequest, this.numberOfFrames - 1)

      const payload = {
        frameStart: this.nextFrameToRequest,
        frameEnd: newLastFrame
      }

      this._worker.postMessage({ type: 'request', payload }) // Send data to our worker.
      this.workerPendingRequests++

      if (newLastFrame >= this.numberOfFrames - 1) {
        this.nextFrameToRequest = 0
      } else {
        this.nextFrameToRequest = newLastFrame
      }

      if (!meshBufferHasEnoughToPlay && typeof this.onMeshBuffering === 'function') {
        this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength)
      }
    }

    //play only when buffer goes to fill to enough
    if (meshBufferHasEnoughToPlay) {
      this.video.playbackRate = this.speed
      if (this.video.autoplay && this.video.paused) this.video.play()
    }

    if (this.video.ended) {
      this.onTrackEnd()
    }
  }

  /**
   * sync mesh frame to video texture frame
   */
  processFrame(frameToPlay: number) {
    this.currentVideoFrame = frameToPlay

    if (frameToPlay > this.numberOfFrames) {
      // console.warn('mesh buffer is not ready? frameToPlay:', frameToPlay)
      return
    }

    const hasFrame = this.meshBuffer.has(frameToPlay)

    if (!hasFrame) {
      // console.warn('mesh buffer missing frame', frameToPlay)

      this.onMeshBuffering?.(0)
      if (this.failMaterial) this.mesh.material = this.failMaterial
    } else {
      this.currentMeshFrame = frameToPlay

      this.mesh.material = this.material
      this.mesh.material.needsUpdate = true
      this.mesh.geometry = this.meshBuffer.get(frameToPlay) as BufferGeometry
      // test code
      // this.mesh.geometry = new PlaneBufferGeometry(1, 1)
      this.mesh.geometry.attributes.position.needsUpdate = true

      // upload immediately
      this._videoTexture.needsUpdate = true
      this.renderer.initTexture(this._videoTexture)

      this.onFrameShow?.(frameToPlay)
      if (this.pauseOnNextFrame) {
        this.pauseOnNextFrame = false
        this.video.pause()
      }
    }
    this.removePlayedBuffer(frameToPlay)
  }

  handleFrameData(messages) {
    for (const frameData of messages) {
      let geometry = new BufferGeometry()
      geometry.setIndex(new Uint16BufferAttribute(frameData.bufferGeometry.index.buffer, 1))
      geometry.setAttribute('position', new Float32BufferAttribute(frameData.bufferGeometry.position.buffer, 3))
      geometry.setAttribute('uv', new Float32BufferAttribute(frameData.bufferGeometry.uv.buffer, 2))

      this.meshBuffer.set(frameData.keyframeNumber, geometry)
    }

    if (typeof this.onMeshBuffering === 'function') {
      const minimumBufferLength = this.targetFramesToRequest * 2
      this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength)
    }
  }

  drawVideoAndGetCurrentFrameNumber(): number {
    const encoderWindowWidth = this.encoderWindowSize * this.encoderByteLength
    const encoderWindowHeight = this.encoderWindowSize / 2
    // this.actorCtx.clearRect(0, 0, this.videoSize, this.videoSize);
    this.videoCtx.drawImage(this._video, 0, 0)

    // this.counterCtx.clearRect(0, 0, this.encoderByteLength, 1);
    this.counterCtx.drawImage(
      this.videoCtx.canvas,
      0,
      this.videoSize - encoderWindowHeight,
      encoderWindowWidth,
      encoderWindowHeight,
      0,
      0,
      this.encoderByteLength,
      1
    )

    const imgData = this.counterCtx.getImageData(0, 0, this.encoderByteLength, 1)

    let frameToPlay = 0
    for (let i = 0; i < this.encoderByteLength; i++) {
      frameToPlay += Math.round(imgData.data[i * 4] / 255) * Math.pow(2, i)
    }

    frameToPlay = Math.max(frameToPlay - 1, 0)

    return frameToPlay
  }

  resetWorker = () => {
    const meshFilePath = this.manifestFilePath.replace('.manifest', '.drcs')
    if (this.numberOfFrames > this.maxNumberOfFrames) {
      console.error(
        'There are more frames (%d) in file then our decoder can handle(%d) with provided encoderByteLength(%d)',
        this.numberOfFrames,
        this.maxNumberOfFrames,
        this.encoderByteLength
      )
    }

    this._worker.postMessage({
      type: 'initialize',
      payload: {
        targetFramesToRequest: this.targetFramesToRequest,
        meshFilePath,
        numberOfFrames: this.numberOfFrames,
        fileHeader: this.fileHeader
      }
    }) // Send data to our worker.
  }

  removePlayedBuffer(currentFrame: number) {
    //remove played buffer
    for (const [key, buffer] of this.meshBuffer.entries()) {
      if (key < currentFrame) {
        buffer.dispose()
        this.meshBuffer.delete(key)
      }
    }
  }

  update() {
    this.bufferLoop()
    if (!this.fileHeader || this.useVideoRequestCallback || this.video.paused) return
    const frame = this.drawVideoAndGetCurrentFrameNumber()
    this.processFrame(frame)
  }

  dispose(): void {
    this._worker && this._worker.terminate()
    if (this._video) {
      this._video.pause()
      this._video = null
    }

    if (this._videoTexture) {
      this._videoTexture.dispose()
      this._videoTexture = null
    }

    this.videoCtx = null
    this.counterCtx = null

    if (this.meshBuffer) {
      for (let i = 0; i < this.meshBuffer.size; i++) {
        const buffer = this.meshBuffer.get(i)
        if (buffer && buffer instanceof BufferGeometry) {
          buffer.dispose()
        }
      }
      this.meshBuffer.clear()
    }
  }
}
