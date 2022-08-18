import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneBufferGeometry,
  Renderer,
  sRGBEncoding,
  Texture,
  VideoTexture,
  WebGLRenderer,
  Uint16BufferAttribute
} from 'three';

enum PlayModeEnum {
  Single = 1,
  Random,
  Loop,
  SingleLoop,
}

enum VideoStatusEnum {
  Set = "set",
  Loaded = "loaded",
  Ready = "ready"
}

enum PlayerEventEnum {
  PlayerReady = "playerready",
  WorkerReady = "workerReady",
  WorkerFrameData = "workerframedata",
  WorkerPostRequest = "workerpostrequest",
  Buffering = "buffering",
  SetWorker = "setWorker",
  NextLoop = "nextloop",
  Loop = "loop",
  SetTrack = "settrack",
  VideoStatus = "videostatus",
  FrameUpdate = "frameupdate",
  Play = "play",
  Pause = "pause",
  Seek = "seek"
}

type AdvancedHTMLVideoElement = HTMLVideoElement & { requestVideoFrameCallback: (callback: (number, { }) => void) => void };
type onMeshBufferingCallback = (progress: number) => void;
type onFrameShowCallback = (frame: number) => void;
type onHandleEventCallback = (type: PlayerEventEnum, data?: any) => void;
type onRenderingCallback = () => void

export default class Player {
  static defaultWorkerURL = new URL('./worker.build.es.js', import.meta.url).href
  //TODO: testing worker
  // static defaultWorkerURL = new URL('../../../XREngine/node_modules/volumetric/dist/worker.build.es.js', import.meta.url).href
  // static defaultWorkerURL = new URL('../../../node_modules/volumetric/dist/worker.build.es.js', import.meta.url).href

  // Public Fields
  public speed: number = 1.0; // Multiplied by framerate for final playback output rate
  public loop: boolean = true;
  public encoderWindowSize = 8; // length of the databox
  public encoderByteLength = 16;
  public videoSize = 1024;
  public playMode: PlayModeEnum;
  public waitForVideoLoad = 3 //3 seconds
  public autoPreview = true
  public isLoadingEffect = false
  public isVideoTexture = false
  public hasPlayed: boolean = false;

  // Three objects
  public scene: Object3D;
  public renderer: Renderer;
  public mesh: Mesh;
  public paths: Array<String>;
  public material: MeshBasicMaterial;
  public failMaterial: MeshBasicMaterial;
  public bufferGeometry: BufferGeometry;

  // Private Fields
  private readonly _scale: number = 1;
  private _video: HTMLVideoElement | AdvancedHTMLVideoElement = null;
  private _videoTexture = null;
  private meshBuffer: Map<number, BufferGeometry> = new Map();
  private _worker: Worker;
  private onMeshBuffering: onMeshBufferingCallback | null = null;
  private onFrameShow: onFrameShowCallback | null = null;
  private onHandleEvent: onHandleEventCallback | null = null;
  private rendererCallback: onRenderingCallback | null = null;
  fileHeader: any;
  tempBufferObject: BufferGeometry;

  private meshFilePath: String;

  private currentTrack: number = 0;
  private frameData: Array<any>;
  private nextTrack: number = 0;
  private manifestFilePath: any;
  private videoFilePath: any;
  private counterCtx: CanvasRenderingContext2D;
  private actorCtx: CanvasRenderingContext2D;

  private numberOfFrames: number = 0;
  private numberOfNextFrames: number = 0;
  private isFirstLoad: boolean = true;
  private isWorkerWaitNextLoop: boolean = false;
  private isWorkerReady: boolean = false;
  private isWorkerBusy: boolean = false;
  private stopOnNextTrack: boolean = false;
  private stopOnNextFrame: boolean = false;
  private videoStatus: VideoStatusEnum;
  private maxNumberOfFrames: number;
  private actorCanvas: HTMLCanvasElement;
  private useVideoRequest: boolean = false;
  private defaultFrameRate: number = 30
  private pastTextureUpdateTime: number = 0
  currentFrame: number = 0;
  lastFrameRequested: number = 0;
  targetFramesToRequest: number = 30;

  set paused(value){
    if(!value && this._video.paused) this.play();
    else {
      if (!this._video.paused) {
        this._video.pause();
      }
      this.stopOnNextFrame = false;
    }
  }

  get video() {
    return this._video;
  }

  constructor({
    scene,
    renderer,
    playMode,
    paths,
    targetFramesToRequest = 90,
    scale = 1,
    encoderWindowSize = 8,
    encoderByteLength = 16,
    videoSize = 1024,
    video = null,
    isLoadingEffect = false,
    isVideoTexture = false,
    onMeshBuffering = null,
    onFrameShow = null,
    onHandleEvent = null,
    rendererCallback = null,
    worker = null
  }: {
    scene: Object3D,
    renderer: WebGLRenderer,
    playMode?: PlayModeEnum,
    paths: Array<String>,
    targetFramesToRequest?: number,
    scale?: number,
    encoderWindowSize?: number,
    encoderByteLength?: number,
    videoSize?: number,
    video?: any,
    isLoadingEffect?: boolean,
    isVideoTexture?: boolean,
    onMeshBuffering?: onMeshBufferingCallback
    onFrameShow?: onFrameShowCallback,
    onHandleEvent?: onHandleEventCallback,
    rendererCallback?: onRenderingCallback,
    worker?: Worker
  }) {

    this.onMeshBuffering = onMeshBuffering;
    this.onFrameShow = onFrameShow;
    this.onHandleEvent = onHandleEvent;
    this.rendererCallback = rendererCallback;

    this.encoderWindowSize = encoderWindowSize;
    this.encoderByteLength = encoderByteLength;
    this.maxNumberOfFrames = Math.pow(2, this.encoderByteLength)-2;
    this.videoSize = videoSize;

    this.targetFramesToRequest = targetFramesToRequest;

    this._worker = worker ? worker : (new Worker(Player.defaultWorkerURL)); // spawn new worker;

    this.scene = scene;
    this.renderer = renderer;
    this._scale = scale;
    this.frameData = []

    this.paths = paths
    this.playMode = playMode || PlayModeEnum.Loop
    
    //create video element
    this._video = video ? video : document.createElement('video')
    this._video.crossOrigin = 'anonymous'
    this._video.playbackRate = this.speed
    this._video.playsInline = true
    this._video.preload = 'auto'
    this._video.muted = true
    this.isLoadingEffect = isLoadingEffect
    this.isVideoTexture = isVideoTexture

    //handle video event
    this._video.addEventListener('loadeddata', (event) => {
      if (this.isLoadingEffect) {
        this.videoStatus = VideoStatusEnum.Loaded
        this.sendHandleEvent(PlayerEventEnum.VideoStatus, { status: this.videoStatus, video: this._video })
      } else {
        this.videoStatus = VideoStatusEnum.Ready
      }
      if (!this.isFirstLoad) this.play()
    });

    this._video.addEventListener('ended', () => {
      this.handleLoop()
    });

    this._video.addEventListener('play', () => {
      this.isFirstLoad = false
    });

    const handleVideoFrame = (now, metadata) => {
      if (this.videoStatus === VideoStatusEnum.Ready && !this.video.paused && this.hasPlayed) {
        this._video.playbackRate = this.speed
        const frameData = this.frameData.filter((rate) => rate.track == this.currentTrack)
        let frameRate = this.defaultFrameRate
        if (frameData && frameData[0]) {
          frameRate = frameData[0].frameRate
        }
        const frameToPlay = Math.round(metadata.mediaTime * frameRate)
        const delay = metadata.expectedDisplayTime - now
        if (this.currentFrame !== frameToPlay) {
          if (!this.isVideoTexture) {
            this.actorCtx.drawImage(this._video, 0, 0);
          }
          this._videoTexture.needsUpdate = true;

          // Should read this: 
          // https://web.dev/requestvideoframecallback-rvfc/
          // Current issue
          // https://github.com/WICG/video-rvfc/issues/59
          // https://github.com/WICG/video-rvfc/issues/77#issuecomment-879317525
          // https://github.com/WICG/video-rvfc/issues/65#issuecomment-997811461
          // https://github.com/WICG/video-rvfc/issues/63#issuecomment-700140698
          
          // The mediaTime corresponds to the presentation timestamp of latest frame sent to
          // the browser compositor, and we get the timestamp from the media itself.
          // The rvfc callback can be 1 v-sync late, so there can be a small window where the
          // last mediaTime you received does not correspond exactly to what is on screen.
          // However, drift issues of more than 1 (maybe 2?) frames might come from the
          // media's encoding itself.
          // You can check whether the frame is already on screen, or is about to be on screen,
          // using the expectedDisplayTime and seeing if it's approximately now (within 10 microseconds),
          // or roughly 1 v-sync in the future (~16ms for a 60 hz monitor).

          if (delay < 16) { // in the case of 1 vsync late
            // https://github.com/WICG/video-rvfc/issues/59#issuecomment-729280461
            // speed down for internal state stabilized (strategy)
            // this._video.playbackRate = 0.5
            // setTimeout(() => {
            //   // this._video.playbackRate = this.speed
            // }, 10)
            // give browser enough time to stabilize
            this.processFrame(frameToPlay)
          } else {
            this.processFrame(frameToPlay)
          }
          this.pastTextureUpdateTime = now
        }
      }
      //@ts-ignore
      this._video.requestVideoFrameCallback(handleVideoFrame)
    }
    
    if ('requestVideoFrameCallback' in this._video) {
      this._video.requestVideoFrameCallback(handleVideoFrame)
      this.useVideoRequest = true
    } else {
      this.useVideoRequest = false
    }

    //set video texture
    if (this.useVideoRequest) {
      if (this.isVideoTexture) {
        this._videoTexture = new VideoTexture(this._video);
      } else {
        this.actorCanvas = document.createElement('canvas')
        this.actorCtx = this.actorCanvas.getContext('2d');

        this.actorCtx.canvas.width = this.actorCtx.canvas.height = this.videoSize;
        this.actorCtx.canvas.setAttribute('crossOrigin', 'Anonymous');

        this.actorCtx.fillStyle = '#ACC';
        this.actorCtx.fillRect(0, 0, this.actorCtx.canvas.width, this.actorCtx.canvas.height);

        this._videoTexture = new Texture(this.actorCtx.canvas);
      }
    } else {
      //create canvas
      const counterCanvas = document.createElement('canvas') as HTMLCanvasElement;
      counterCanvas.width = this.encoderByteLength;
      counterCanvas.height = 1;

      this.counterCtx = counterCanvas.getContext('2d');
      this.actorCanvas = document.createElement('canvas')
      this.actorCtx = this.actorCanvas.getContext('2d');

      this.actorCtx.canvas.width = this.actorCtx.canvas.height = this.videoSize;
      this.counterCtx.canvas.setAttribute('crossOrigin', 'Anonymous');
      this.actorCtx.canvas.setAttribute('crossOrigin', 'Anonymous');

      this.actorCtx.fillStyle = '#ACC';
      this.actorCtx.fillRect(0, 0, this.actorCtx.canvas.width, this.actorCtx.canvas.height);

      this._videoTexture = new Texture(this.actorCtx.canvas);
    }
    
    this._videoTexture.encoding = sRGBEncoding;
    this.material = new MeshBasicMaterial({ map: this._videoTexture });
    this.failMaterial = new MeshBasicMaterial({ color: '#555555' });
    this.mesh = new Mesh(new PlaneBufferGeometry(0.00001, 0.00001), this.material);
    this.mesh.scale.set(this._scale, this._scale, this._scale);
    this.scene.add(this.mesh);

    this.isFirstLoad = true

    this._worker.onmessage = (e) => {
      switch (e.data.type) {
        case 'initialized':
          console.log("Worker initialized");
          this.isWorkerReady = true
          this.sendHandleEvent(PlayerEventEnum.WorkerReady)
          Promise.resolve().then(() => {
            this.bufferLoop();
          });
          break;
        case 'framedata':
          Promise.resolve().then(() => {
            this.isWorkerBusy = false;
            this.handleFrameData(e.data.payload);
            this.sendHandleEvent(PlayerEventEnum.WorkerFrameData, e.data.payload)
          });
          break;
      }
    };

    this.setTrackPath(this.currentTrack)
    this.setVideo(this.videoFilePath)
    this.setWorker(this.manifestFilePath, this.meshFilePath)
    this.sendHandleEvent(PlayerEventEnum.PlayerReady, this)
  }

  bufferLoop = () => {
    const minimumBufferLength = this.targetFramesToRequest * 2;
    const meshBufferHasEnoughToPlay = this.meshBuffer.size >= minimumBufferLength;
    const meshBufferHasEnoughForSnap = this.meshBuffer.size >= minimumBufferLength * 2;

    if (!this.isWorkerBusy && this.isWorkerReady && !meshBufferHasEnoughForSnap) {
      if (!this.isWorkerWaitNextLoop) {
        let newLastFrame = Math.max(this.lastFrameRequested + minimumBufferLength, this.lastFrameRequested + this.targetFramesToRequest);
        
        if (newLastFrame >= this.numberOfFrames - 1) {
          newLastFrame = this.numberOfFrames - 1
        }
        newLastFrame = newLastFrame % this.numberOfFrames

        const payload = {
          frameStart: this.lastFrameRequested,
          frameEnd: newLastFrame
        }
        
        console.log("Posting request", payload);
        this.sendHandleEvent(PlayerEventEnum.WorkerPostRequest, payload)
        this._worker.postMessage({ type: "request", payload }); // Send data to our worker.
        this.isWorkerBusy = true;

        if (newLastFrame >= this.numberOfFrames - 1) {
          this.lastFrameRequested = 0
          this.isWorkerWaitNextLoop = true
        } else {
          this.lastFrameRequested = newLastFrame;
        }

        if (!meshBufferHasEnoughToPlay && typeof this.onMeshBuffering === "function") {
          // console.log('buffering ', this.meshBuffer.size / minimumBufferLength,',  have: ', this.meshBuffer.size, ', need: ', minimumBufferLength )
          this.sendHandleEvent(PlayerEventEnum.Buffering, this.meshBuffer.size / minimumBufferLength)
          this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength);
        }
      } else {
        this.isWorkerWaitNextLoop = false
        this.prepareNextLoop()
      }
    }

    if (this.videoStatus == VideoStatusEnum.Ready) {
      //play only when buffer goes to fill to enough
      if(meshBufferHasEnoughToPlay && this._video.paused && this.hasPlayed) {
        this.play();
      }
    } else if (this.videoStatus == VideoStatusEnum.Loaded) {
      if (meshBufferHasEnoughToPlay && this.hasPlayed && this.mesh.material && this.currentFrame > 5) {
        this.handleInitPlay()
      }
    }
    requestAnimationFrame(() => this.bufferLoop());
  }

  /**
   * sync mesh frame to video texture frame
   */
  processFrame(frameToPlay, cb?: onRenderingCallback) {

    if (frameToPlay > this.numberOfFrames) {
      console.warn('video texture is not ready? frameToPlay:', frameToPlay);
      return;
    }

    if (this.currentFrame === frameToPlay) {
      return;
    }

    this.currentFrame = frameToPlay;

    const hasFrame = this.meshBuffer.has(frameToPlay);

    if (!hasFrame) {
      if (!this._video.paused) {
        this.pause(true)
      }
      if (!hasFrame && typeof this.onMeshBuffering === "function") {
        this.onMeshBuffering(0);
        this.mesh.material = this.failMaterial;
      }
    } else {
      this.mesh.material = this.material;
      this.material.needsUpdate = true;

      this.mesh.material.needsUpdate = true;
      this.mesh.geometry = this.meshBuffer.get(frameToPlay) as BufferGeometry;
      //test code
      // this.mesh.geometry = new PlaneBufferGeometry(1, 1)
      this.mesh.geometry.attributes.position.needsUpdate = true;
      (this.mesh.geometry as any).needsUpdate = true;

      if (typeof this.onFrameShow === "function") {
        this.onFrameShow(frameToPlay);
      }
      this.sendHandleEvent(PlayerEventEnum.FrameUpdate, frameToPlay)
      if(this.rendererCallback) this.rendererCallback();
      if(cb) cb();

      if (this.stopOnNextFrame) this.pause()
    }
    this.removePlayedBuffer()
  }

  prepareNextLoop() {
    if (this.playMode == PlayModeEnum.Random) {
      this.nextTrack = Math.floor(Math.random() * this.paths.length)
    } else if (this.playMode == PlayModeEnum.Single) {
      this.nextTrack = (this.currentTrack + 1) % this.paths.length
      if ((this.currentTrack + 1) == this.paths.length) {
        this.nextTrack = 0
        this.isWorkerReady = false
        this.stopOnNextTrack = true
      }
    } else if (this.playMode == PlayModeEnum.SingleLoop) {
      this.nextTrack = this.currentTrack
    } else { //PlayModeEnum.Loop
      this.nextTrack = (this.currentTrack + 1) % this.paths.length
    }
    this.setTrackPath(this.nextTrack)
    this.setWorker(this.manifestFilePath, this.meshFilePath)
    this.sendHandleEvent(PlayerEventEnum.NextLoop, {
      currentTrack: this.currentTrack,
      nextTrack: this.nextTrack
    })
  }

  handleFrameData(messages) {
    // console.log(`received frames ${messages[0].keyframeNumber} - ${messages[messages.length-1].keyframeNumber}`)
    for (const frameData of messages) {
      let geometry = new BufferGeometry();
      geometry.setIndex(
        new Uint16BufferAttribute(frameData.bufferGeometry.index.buffer, 1)
      );
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(frameData.bufferGeometry.position.buffer, 3)
      );
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(frameData.bufferGeometry.uv.buffer, 2)
      );

      this.meshBuffer.set(frameData.keyframeNumber, geometry );
    }

    if (typeof this.onMeshBuffering === "function") {
      const minimumBufferLength = this.targetFramesToRequest * 2;
      // console.log('buffering ', this.meshBuffer.size / minimumBufferLength,',  have: ', this.meshBuffer.size, ', need: ', minimumBufferLength )
      this.onMeshBuffering(this.meshBuffer.size / minimumBufferLength);
    }
  }

  handleLoop() {
    this.mesh.visible = false
    if (this.nextTrack == -1) {
      this.nextTrack = 0
      return
    }
    if (this.stopOnNextTrack) {
      this.stopOnNextTrack = false
      this.hasPlayed = false
    }
    if (this.numberOfNextFrames != 0) this.numberOfFrames = this.numberOfNextFrames
    this.currentTrack = this.nextTrack
    const meshFilePath = this.paths[this.currentTrack  % this.paths.length]
    this.videoFilePath = `${meshFilePath.substring(0, meshFilePath.lastIndexOf("."))}.mp4`
    this.setVideo(this.videoFilePath)
    this.sendHandleEvent(PlayerEventEnum.Loop, { currentTrack: this.currentTrack })
  }

  setTrackPath(track) {
    const meshFilePath = this.paths[track % this.paths.length]
    this.meshFilePath = meshFilePath
    this.manifestFilePath = `${meshFilePath.substring(0, meshFilePath.lastIndexOf("."))}.manifest`
    this.videoFilePath = `${meshFilePath.substring(0, meshFilePath.lastIndexOf("."))}.mp4`
    this.sendHandleEvent(PlayerEventEnum.SetTrack, {
      meshFilePath: this.meshFilePath,
      manifestFilePath: this.manifestFilePath,
      videoFilePath: this.videoFilePath,
    })
  }

  setVideo(videoFilePath) {
    this.pause(true)
    //test code
    // videoFilePath = 'https://daiz.github.io/frame-accurate-ish/time.mp4'
    this._video.setAttribute('src', videoFilePath);
    this._video.load()
    this.videoStatus = VideoStatusEnum.Set
    this.sendHandleEvent(PlayerEventEnum.VideoStatus, { status: this.videoStatus, videoFilePath })
  }

  getCurrentFrameNumber():number {
    const encoderWindowWidth = this.encoderWindowSize * this.encoderByteLength;
    const encoderWindowHeight = this.encoderWindowSize / 2;
    // this.actorCtx.clearRect(0, 0, this.videoSize, this.videoSize);
    this.actorCtx.drawImage(this._video, 0, 0);

    // this.counterCtx.clearRect(0, 0, this.encoderByteLength, 1);
    this.counterCtx.drawImage(
      this.actorCtx.canvas,
      0,
      this.videoSize - encoderWindowHeight,
      encoderWindowWidth,
      encoderWindowHeight,
      0,
      0,
      this.encoderByteLength, 1);

    const imgData = this.counterCtx.getImageData(0, 0, this.encoderByteLength, 1);

    let frameToPlay = 0;
    for (let i = 0; i < this.encoderByteLength; i++) {
      frameToPlay += Math.round(imgData.data[i * 4] / 255) * Math.pow(2, i);
    }

    frameToPlay = Math.max(frameToPlay - 1, 0);

    return frameToPlay;
  }

  setWorker(manifestFilePath, meshFilePath) {
    this.isWorkerReady = false;
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      this.fileHeader = JSON.parse(xhr.responseText);
      
      const frameRate = this.fileHeader.frameRate
      const index = this.frameData.indexOf((rate) => rate.track == this.nextTrack)
      if (index == -1) {
        this.frameData.push({
          track: this.nextTrack,
          frameRate 
        })
      } else {
        this.frameData[index].frameRate = frameRate
      }

      // Get count of frames associated with keyframe
      this.numberOfNextFrames = this.fileHeader.frameData.length;
      if (this.numberOfFrames == 0) this.numberOfFrames = this.numberOfNextFrames

      if (this.numberOfNextFrames > this.maxNumberOfFrames) {
        console.error('There are more frames (%d) in file then our decoder can handle(%d) with provided encoderByteLength(%d)', this.numberOfNextFrames, this.maxNumberOfFrames, this.encoderByteLength);
      }

      this._worker.postMessage({ type: "initialize", payload: { targetFramesToRequest: this.targetFramesToRequest, meshFilePath, numberOfFrames: this.numberOfNextFrames, fileHeader: this.fileHeader } }); // Send data to our worker.
    };

    xhr.open('GET', manifestFilePath, true); // true for asynchronous
    xhr.send();
    this.sendHandleEvent(PlayerEventEnum.SetWorker, this._worker)
  }

  removePlayedBuffer() {
    const isOnLoop = this.lastFrameRequested < this.currentFrame;
    
    //remove played buffer
    for (const [key, buffer] of this.meshBuffer.entries()) {
      // If key is between current keyframe and last requested, don't delete
      if ((isOnLoop && (key > this.lastFrameRequested && key < this.currentFrame)) ||
        (!isOnLoop && key < this.currentFrame)) {
        // console.log("Destroying", key);
        if (buffer && buffer instanceof BufferGeometry) {
          buffer.dispose();
        }
        this.meshBuffer.delete(key);
      }
    }
  }

  // Start loop to check if we're ready to play
  play(mute?: boolean) {
    this.hasPlayed = true
    // TODO this is all not very data-oriented; we should only be running logic in the bufferLoop.
    if (this.videoStatus != VideoStatusEnum.Loaded
        && this.videoStatus != VideoStatusEnum.Ready) return
    this._video.muted = mute
    if (this.videoStatus == VideoStatusEnum.Ready) {
      this.mesh.visible = true
    } else {
      this.mesh.visible = false
    }
    this._video.play()
    this.sendHandleEvent(PlayerEventEnum.Play)
  }

  pause(isWait?: boolean) {
    this.paused = true
    if (!isWait) {this.hasPlayed = false}
    this.sendHandleEvent(PlayerEventEnum.Pause)
  }
  
  playOneFrame() {
    this.play();
    this.stopOnNextFrame = true;
    this.sendHandleEvent(PlayerEventEnum.Seek)
  }

  handleInitPlay() {
    this.mesh.visible = true
    this.videoStatus = VideoStatusEnum.Ready
    this.sendHandleEvent(PlayerEventEnum.VideoStatus, { status: this.videoStatus, video: this._video })
  }

  updateStatus (status) {
    this.videoStatus = status
  }

  sendHandleEvent(type: PlayerEventEnum, data?: any) {
    if (typeof this.onHandleEvent == 'function') {
      this.onHandleEvent(type, data)
    }
  }

  handleRender(cb?: onRenderingCallback) {
    if (!this.fileHeader || this.useVideoRequest) // || (this._video.currentTime === 0 || this._video.paused))
      return;
    const frameToPlay = this.getCurrentFrameNumber();
    this._videoTexture.needsUpdate = this.currentFrame !== frameToPlay;
    this.processFrame(frameToPlay, cb);
  }

  dispose(): void {
    this._worker && this._worker.terminate();
    if (this._video) {
      this._video.pause();
      this._video = null;
      this._videoTexture.dispose();
      this._videoTexture = null;
    }
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