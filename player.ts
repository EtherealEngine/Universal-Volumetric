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
  WebGLRenderer,
} from 'three';

export enum PlayMode {
  single = 'single',
  random = 'random',
  loop = 'loop',
  singleloop = 'singleloop',
}

type onMeshBufferingCallback = (progress: number) => void;
type onFrameShowCallback = (frame: number) => void;

export type PlayerConstructorArgs = {
  renderer: WebGLRenderer;
  playMode?: PlayMode;
  paths: Array<string>;
  encoderWindowSize?: number;
  encoderByteLength?: number;
  videoSize?: number;
  video?: HTMLVideoElement;
  onMeshBuffering?: onMeshBufferingCallback;
  onFrameShow?: onFrameShowCallback;
  worker?: Worker;
  material?: MeshBasicMaterial | MeshBasicMaterial;
};

export default class Player {
  static defaultWorkerURL = new URL('./worker.build.es.js', import.meta.url)
    .href;

  // Public Fields
  public renderer: WebGLRenderer;
  public speed: number = 1.0; // Multiplied by framerate for final playback output rate
  public loop: boolean = true;
  public encoderWindowSize = 8; // length of the databox
  public encoderByteLength = 16;
  public videoSize = 1024;
  public playMode: PlayMode;
  public waitForVideoLoad = 3; //3 seconds
  public autoPreview = true;
  public targetFramesToRequest = 20; // larger value causes buffering with smaller UVOL files.

  public useVideoRequestCallback: boolean;

  public pauseOnNextTrack: boolean = false;
  public pauseOnNextFrame: boolean = false;

  // Three objects
  public mesh: Mesh;
  public paths: Array<string>;
  public material: MeshBasicMaterial;
  public bufferGeometry: BufferGeometry;
  public failMaterial?: MeshBasicMaterial;

  // Private Fields
  private _video: HTMLVideoElement = null;
  private _videoTexture: Texture = null;
  private meshBuffer: Map<number, BufferGeometry> = new Map();
  private _worker: Worker;
  private onMeshBuffering: onMeshBufferingCallback | null = null;
  private onFrameShow: onFrameShowCallback | null = null;
  fileHeader;
  tempBufferObject: BufferGeometry;

  private currentTrack: number = 0;
  private nextTrack: number = 0;
  private manifestFilePath: string;
  private meshFilePath: string;

  private videoCtx: CanvasRenderingContext2D;
  private counterCtx: CanvasRenderingContext2D;

  private isWorkerReady: boolean = false;
  private workerPendingRequests: number = 0;

  private maxNumberOfFrames: number;
  currentMeshFrame: number = 0;
  currentVideoFrame: number = 0;
  nextFrameToRequest: number = 0;

  get isV2() {
    if (!this.fileHeader.version || this.fileHeader.version !== '2.0.0') return false;
    return true;
  }

  get video() {
    return this._video;
  }

  get numberOfFrames() {
    if (this.isV2) {
      return this.fileHeader.geometry.frameData.length;
    } else 
      return this.fileHeader?.frameData.length || 0;
  }

  constructor({
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
  }: PlayerConstructorArgs) {
    this.renderer = renderer;

    this.onMeshBuffering = onMeshBuffering;
    this.onFrameShow = onFrameShow;

    this.encoderWindowSize = encoderWindowSize;
    this.encoderByteLength = encoderByteLength;
    this.maxNumberOfFrames = Math.pow(2, this.encoderByteLength) - 2;
    this.videoSize = videoSize;

    this._worker = new Worker(Player.defaultWorkerURL, {
      type: 'module',
      name: 'UVOL',
    });
    this._worker.onerror = console.error;

    this.paths = paths;

    // backwards-compat
    if (typeof playMode === 'number') {
      switch (playMode) {
        case 1:
          playMode = PlayMode.single;
          break;
        case 2:
          playMode = PlayMode.random;
          break;
        case 3:
          playMode = PlayMode.loop;
          break;
        case 4:
          playMode = PlayMode.singleloop;
          break;
      }
    }

    this.playMode = playMode || PlayMode.loop;

    //create video element
    this._video = video ? video : document.createElement('video');
    this._video.crossOrigin = 'anonymous';
    this._video.playbackRate = 0;
    this._video.playsInline = true;
    this._video.preload = 'auto';
    this._video.muted = false;
    this._video.autoplay = true;

    this.video.addEventListener('loadstart', () => {
      for (const buffer of this.meshBuffer.values()) buffer?.dispose();
      this.meshBuffer.clear();
      this.nextFrameToRequest = 0;
      this.resetWorker();
      this.video.playbackRate = 0;
    });

    const handleVideoFrame = (now, metadata) => {
      this._video.requestVideoFrameCallback(handleVideoFrame);
      if (!this.useVideoRequestCallback || !this.fileHeader) return;
      let frameRate = null;
      if (this.isV2) {
        frameRate = this.fileHeader.texture.frameRate;
      } else {
        frameRate = this.fileHeader.frameRate;
      }
      const frameToPlay = Math.round(
        metadata.mediaTime * frameRate
      );
      this.processFrame(frameToPlay);
    };

    if ('requestVideoFrameCallback' in this._video) {
      this._video.requestVideoFrameCallback(handleVideoFrame);
      this.useVideoRequestCallback = true;
    } else {
      this.useVideoRequestCallback = false;
    }

    //set video texture
    if (this.useVideoRequestCallback) {
      // new VideoTexture(this._video) gives us less control over when the texture is updated
      this._videoTexture = new Texture(this._video);
      this._videoTexture.generateMipmaps = false;
      this._videoTexture.minFilter = LinearFilter;
      this._videoTexture.magFilter = LinearFilter;
      (this._videoTexture as any).isVideoTexture = true;
      (this._videoTexture as any).update = () => {};
    } else {
      //create canvases for video and counter textures
      const counterCanvas = document.createElement('canvas');
      this.counterCtx = counterCanvas.getContext('2d');
      this.counterCtx.canvas.width = this.encoderByteLength;
      this.counterCtx.canvas.height = 1;
      this.counterCtx.canvas.setAttribute('crossOrigin', 'Anonymous');

      const videoCanvas = document.createElement('canvas');
      this.videoCtx = videoCanvas.getContext('2d');
      this.videoCtx.canvas.width = this.videoCtx.canvas.height = this.videoSize;
      this.videoCtx.canvas.setAttribute('crossOrigin', 'Anonymous');
      this.videoCtx.fillStyle = '#ACC';
      this.videoCtx.fillRect(
        0,
        0,
        this.videoCtx.canvas.width,
        this.videoCtx.canvas.height
      );

      this._videoTexture = new Texture(this.videoCtx.canvas);
    }

    this._videoTexture.encoding = sRGBEncoding;
    this.material = material;
    this.material.map = this._videoTexture;
    this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), this.material);

    this._worker.onmessage = (e) => {
      switch (e.data.type) {
        case 'initialized':
          this.isWorkerReady = true;
          break;
        case 'framedata':
          this.workerPendingRequests--;
          this.handleFrameData(e.data.payload);
          break;
        default:
          console.log('workermessage: ', e.data.payload);
      }
    };

    this.setTrackPath(this.currentTrack);
    this.bufferLoop();
  }

  printBufferRepresentation() {
    let bufferRepresentation = '';
    for (let i = 0; i < this.numberOfFrames; i++) {
      if (this.currentVideoFrame === i) bufferRepresentation += 'O';
      else if (this.meshBuffer.has(i)) bufferRepresentation += '*';
      else if (this.nextFrameToRequest === i) bufferRepresentation += '+';
      else bufferRepresentation += '-';
    }
    // console.log(bufferRepresentation)
  }

  bufferLoop = () => {
    if (!this.video) return; // has been disposed

    const minimumBufferLength = this.targetFramesToRequest * 2;
    const meshBufferHasEnoughToPlay =
      this.meshBuffer.size >= minimumBufferLength * 3;
    const meshBufferHasEnough = this.meshBuffer.size >= minimumBufferLength * 5;

    if (
      this.workerPendingRequests < 3 &&
      this.isWorkerReady &&
      !meshBufferHasEnough
    ) {
      const newLastFrame = Math.min(
        this.nextFrameToRequest + this.targetFramesToRequest,
        this.numberOfFrames
      );

      const payload = {
        frameStart: this.nextFrameToRequest,
        frameEnd: newLastFrame,
      };

      this._worker.postMessage({ type: 'request', payload }); // Send data to our worker.
      this.workerPendingRequests++;

      if (newLastFrame >= this.numberOfFrames) {
        this.nextFrameToRequest = 0;
      } else {
        this.nextFrameToRequest = newLastFrame;
      }

      if (
        !meshBufferHasEnoughToPlay &&
        typeof this.onMeshBuffering === 'function'
      ) {
        // console.log('buffering ', this.meshBuffer.size / minimumBufferLength,',  have: ', this.meshBuffer.size, ', need: ', minimumBufferLength )
        this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength);
      }
    }

    //play only when buffer goes to fill to enough
    if (meshBufferHasEnoughToPlay) {
      this.video.playbackRate = this.speed;
      if (this.video.autoplay && this.video.paused) this.video.play();
    }

    if (this.video.ended) this.prepareNextLoop();
  };

  /**
   * sync mesh frame to video texture frame
   */
  processFrame(frameToPlay: number) {
    this.currentVideoFrame = frameToPlay;

    if (frameToPlay > this.numberOfFrames) {
      // console.warn('mesh buffer is not ready? frameToPlay:', frameToPlay)
      return;
    }

    const hasFrame = this.meshBuffer.has(frameToPlay);

    if (!hasFrame) {
      // console.warn('mesh buffer missing frame', frameToPlay)

      this.onMeshBuffering?.(0);
      if (this.failMaterial) this.mesh.material = this.failMaterial;
    } else {
      this.currentMeshFrame = frameToPlay;

      this.mesh.material = this.material;
      this.mesh.material.needsUpdate = true;
      this.mesh.geometry = this.meshBuffer.get(frameToPlay) as BufferGeometry;
      // test code
      // this.mesh.geometry = new PlaneBufferGeometry(1, 1)
      this.mesh.geometry.attributes.position.needsUpdate = true;

      // upload immediately
      this._videoTexture.needsUpdate = true;
      this.renderer.initTexture(this._videoTexture);

      this.onFrameShow?.(frameToPlay);
      if (this.pauseOnNextFrame) {
        this.pauseOnNextFrame = false;
        this.video.pause();
      }
    }
    this.removePlayedBuffer(frameToPlay);
  }

  prepareNextLoop() {
    if (this.playMode == PlayMode.random) {
      this.nextTrack = Math.floor(Math.random() * this.paths.length);
    } else if (this.playMode == PlayMode.single) {
      this.nextTrack = (this.currentTrack + 1) % this.paths.length;
      if (this.currentTrack + 1 == this.paths.length) {
        this.nextTrack = 0;
        this.isWorkerReady = false;
      }
    } else if (this.playMode == PlayMode.singleloop) {
      this.nextTrack = this.currentTrack;
    } else {
      //PlayModeEnum.Loop
      this.nextTrack = (this.currentTrack + 1) % this.paths.length;
    }

    if (this.pauseOnNextTrack) {
      this.pauseOnNextTrack = false;
      this.video.pause();
    }

    this.currentTrack = this.nextTrack;
    this.setTrackPath(this.currentTrack);
  }

  handleFrameData(messages) {
    // console.log(`received frames ${messages[0].keyframeNumber} - ${messages[messages.length-1].keyframeNumber}`)
    for (const frameData of messages) {
      let geometry = new BufferGeometry();
      geometry.setIndex(
        new Uint16BufferAttribute(frameData.geometryAttrs.index, 1)
      );
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(frameData.geometryAttrs.position, 3)
      );
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(frameData.geometryAttrs.uv, 2)
      );
      this.meshBuffer.set(frameData.keyframeNumber, geometry);
    }

    if (typeof this.onMeshBuffering === 'function') {
      const minimumBufferLength = this.targetFramesToRequest * 2;
      // console.log('buffering ', this.meshBuffer.size / minimumBufferLength,',  have: ', this.meshBuffer.size, ', need: ', minimumBufferLength )
      this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength);
    }
  }

  setTrackPath(track) {
    const path = this.paths[track % this.paths.length];
    if (!path) return;
    this.video.src = path.replace('.uvol', '.mp4');
    this.video.load();
  }

  drawVideoAndGetCurrentFrameNumber(): number {
    const encoderWindowWidth = this.encoderWindowSize * this.encoderByteLength;
    const encoderWindowHeight = this.encoderWindowSize / 2;
    // this.actorCtx.clearRect(0, 0, this.videoSize, this.videoSize);
    this.videoCtx.drawImage(this._video, 0, 0);

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
    );

    const imgData = this.counterCtx.getImageData(
      0,
      0,
      this.encoderByteLength,
      1
    );

    let frameToPlay = 0;
    for (let i = 0; i < this.encoderByteLength; i++) {
      frameToPlay += Math.round(imgData.data[i * 4] / 255) * Math.pow(2, i);
    }

    frameToPlay = Math.max(frameToPlay - 1, 0);

    return frameToPlay;
  }

  resetWorker() {
    const manifestFilePath = (this.manifestFilePath = this.video.src.replace(
      '.mp4',
      '.manifest'
    ));
    const meshFilePath = (this.meshFilePath = this.video.src.replace(
      '.mp4',
      '.uvol'
    ));
    this.isWorkerReady = false;
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      this.fileHeader = JSON.parse(xhr.responseText);

      if (this.numberOfFrames > this.maxNumberOfFrames) {
        console.error(
          'There are more frames (%d) in file then our decoder can handle(%d) with provided encoderByteLength(%d)',
          this.numberOfFrames,
          this.maxNumberOfFrames,
          this.encoderByteLength
        );
      }

      this._worker.postMessage({
        type: 'initialize',
        payload: {
          targetFramesToRequest: this.targetFramesToRequest,
          meshFilePath,
          numberOfFrames: this.numberOfFrames,
          fileHeader: this.fileHeader,
        },
      }); // Send data to our worker.
    };

    xhr.open('GET', manifestFilePath, true); // true for asynchronous
    xhr.send();
  }

  removePlayedBuffer(currentFrame: number) {
    //remove played buffer
    for (const [key, buffer] of this.meshBuffer.entries()) {
      if (key < currentFrame) {
        buffer.dispose();
        this.meshBuffer.delete(key);
      }
    }
  }

  update() {
    this.bufferLoop();
    if (!this.fileHeader || this.useVideoRequestCallback || this.video.paused)
      return;
    const frame = this.drawVideoAndGetCurrentFrameNumber();
    this.processFrame(frame);
  }

  dispose(): void {
    this._worker && this._worker.terminate();
    if (this._video) {
      this._video.pause();
      this._video = null;
    }

    if (this._videoTexture) {
      this._videoTexture.dispose();
      this._videoTexture = null;
    }

    this.videoCtx = null;
    this.counterCtx = null;

    if (this.meshBuffer) {
      for (let i = 0; i < this.meshBuffer.size; i++) {
        const buffer = this.meshBuffer.get(i);
        if (buffer && buffer instanceof BufferGeometry) {
          buffer.dispose();
        }
      }
      this.meshBuffer.clear();
    }
  }
}
