// import Blob from 'cross-blob';
import {
  BufferGeometry,
  Float32BufferAttribute, Mesh,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  Renderer,
  Scene,
  sRGBEncoding,
  Uint32BufferAttribute
} from 'three';
import {
  IFrameBuffer,
  KeyframeBuffer
} from './Interfaces';
import RingBuffer from './RingBuffer';
import { Engine, VideoTexture } from '@xr3ngine/engine/src/ecs/classes/Engine';
import { EngineEvents } from '@xr3ngine/engine/src/ecs/classes/EngineEvents';

export default class DracosisPlayer {
  // Public Fields
  public frameRate = 30;
  public speed = 1.0; // Multiplied by framerate for final playback output rate

  // Three objects
  public scene: Scene;
  public renderer: Renderer;
  public mesh: Mesh;
  public meshFilePath: String;
  public material: any;
  public bufferGeometry: BufferGeometry;

  // Private Fields
  private _scale = 1;
  private _prevFrame = 0;
  private currentKeyframe = 0;
  private _video = null;
  private _videoTexture = null;
  private _loop = true;
  private _isinitialized = false;
  private meshBuffer: RingBuffer<KeyframeBuffer>;
  private iframeVertexBuffer: RingBuffer<IFrameBuffer>;
  private _worker: Worker;
  private _bufferingTimer: any;

  fileHeader: any;
  tempBufferObject: KeyframeBuffer = {
    frameNumber: 0,
    keyframeNumber: 0,
    bufferGeometry: null
  }

  manifestFilePath: any;
  fetchLoop: any;
  keyframesToBufferBeforeStart: number;
  numberOfKeyframes = 0;
  numberOfIframes = 0;

  // public getters and settings
  get currentFrame(): number {
    return this.currentKeyframe;
  }

  get loop(): boolean {
    return this._loop;
  }
  set loop(value: boolean) {
    this._loop = value;
  }

  constructor({
    scene,
    renderer,
    meshFilePath,
    videoFilePath,
    frameRate = 25,
    loop = true,
    autoplay = true,
    scale = 1,
    keyframesToBufferBeforeStart = 200
  }) {

    const worker = new Worker(new URL('./workerFunction.ts', import.meta.url)); // spawn new worker
    this._worker = worker;

    const handleFrameData = (frameData) => {
      let geometry = new BufferGeometry();
      geometry.setIndex(
        new Uint32BufferAttribute(frameData.keyframeBufferObject.bufferGeometry.index, 1)
      );
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(frameData.keyframeBufferObject.bufferGeometry.position, 3)
      );
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(frameData.keyframeBufferObject.bufferGeometry.uv, 2)
      );

      this.meshBuffer.add({ ...frameData.keyframeBufferObject, bufferGeometry: geometry });
      // if(frameData.iframeBufferObjects) frameData.iframeBufferObjects.forEach(obj => {
      //   this.iframeVertexBuffer.add(obj);
      // })
    }

    worker.onmessage = (e) => {
      switch (e.data.type) {
        case 'initialized':
          console.log("Worker initialized");
          break;
        case 'framedata':
          // console.log("Frame data received");
          handleFrameData(e.data.payload);
          break;
        case 'completed':
          // console.log("Worker complete!");
          break;

      }
      // console.log('Worker said: ', e.data); // message received from worker
    };

    this.keyframesToBufferBeforeStart = keyframesToBufferBeforeStart;
    // Set class values from constructor
    this.scene = scene;
    this.renderer = renderer;
    this.meshFilePath = meshFilePath;
    this.manifestFilePath = meshFilePath.replace('drcs', 'manifest');
    this._loop = loop;
    this._scale = scale;
    this._video = Engine.createElement('video', {
      crossorigin: "anonymous",
      loop: true,
      src: videoFilePath,
      style: {
        position: 'fixed',
        zIndex: '-1',
        top: '0',
        left: '0',
        width: '1px'
      },
      playbackRate: 1
    });

    this._videoTexture = new VideoTexture(this._video);
    this._videoTexture.encoding = sRGBEncoding;
    this.frameRate = frameRate;

    this.videoUpdateHandler = this.videoUpdateHandler.bind(this)

    this._video.requestVideoFrameCallback(this.videoUpdateHandler);
    // Create a default mesh
    this.material = new MeshBasicMaterial({ map: this._videoTexture });
    this.mesh = new Mesh(new PlaneBufferGeometry(0.00001, 0.00001), this.material);
    this.mesh.scale.set(this._scale, this._scale, this._scale);
    this.scene.add(this.mesh);

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      this.fileHeader = JSON.parse(xhr.responseText);
      this.frameRate = this.fileHeader.frameRate;

      // Get count of frames associated with keyframe
      const numberOfIframes = this.fileHeader.frameData.filter(frame => frame.keyframeNumber !== frame.frameNumber).length;
      const numberOfKeyframes = this.fileHeader.frameData.filter(frame => frame.keyframeNumber === frame.frameNumber).length;

      this.numberOfIframes = numberOfIframes;
      this.numberOfKeyframes = numberOfKeyframes;

      this.meshBuffer = new RingBuffer(numberOfKeyframes);
      this.iframeVertexBuffer = new RingBuffer(numberOfIframes);

      if (autoplay) {
        if(Engine.hasUserEngaged) {
          this.play();
        } else {
          const onUserEngage = () => {
            this.play();
            EngineEvents.instance.removeEventListener(EngineEvents.EVENTS.USER_ENGAGE, onUserEngage);
          }
          EngineEvents.instance.addEventListener(EngineEvents.EVENTS.USER_ENGAGE, onUserEngage);
        }
      }

      worker.postMessage({ type: "initialize", payload: { meshFilePath, numberOfKeyframes: this.numberOfKeyframes, fileHeader: this.fileHeader } }); // Send data to our worker.
      this._isinitialized = true;
    };

    xhr.open('GET', this.manifestFilePath, true); // true for asynchronous
    xhr.send();
  }

  videoUpdateHandler(now, metadata) {
    if (!this._isinitialized) return console.warn("Not inited");
    let frameToPlay = Math.round(metadata.mediaTime * 25);
    const keyframeToPlay = this.fileHeader.frameData[frameToPlay].keyframeNumber;

    // if (Math.round(this._video.currentTime * 25) !== metadata.presentedFrames)
    //   console.log('==========DIFF', Math.round(this._video.currentTime * 25), Math.round(metadata.mediaTime * 25), metadata.presentedFrames, metadata);

    let hasKeyframe = true;

    if (hasKeyframe && frameToPlay !== this._prevFrame) {
      this._prevFrame = frameToPlay;


      const isNewKeyframe = keyframeToPlay !== this.currentKeyframe;
      // console.log("Looped frame to play is: ", frameToPlay, "| Current keyframe is: ", this.currentKeyframe, "| Requested Keyframe is: ", keyframeToPlay, "|Is new?", isNewKeyframe);

      // console.log("Looped frame to play is", loopedFrameToPlay, "| Keyframe to play is", keyframeToPlay, "|Is new keyframe?", newKeyframe);

      if (isNewKeyframe) {
        this.currentKeyframe = keyframeToPlay;
        // console.log("***** Keyframe to play")
        // console.log("Mesh buffer length is, ", this.meshBuffer.getBufferLength());

        // If keyframe changed, set mesh buffer to new keyframe
        const meshBufferPosition = this.getPositionInKeyframeBuffer(keyframeToPlay);

        // console.log("Mesh buffer position is: ", meshBufferPosition);

        this.mesh.geometry = this.meshBuffer.get(meshBufferPosition).bufferGeometry as BufferGeometry;

      }
      else {
        const vertexBufferPosition = this.getPositionInIFrameBuffer(frameToPlay);
        if (this.iframeVertexBuffer.get(vertexBufferPosition) !== undefined) {
          this.mesh.geometry = this.iframeVertexBuffer.get(vertexBufferPosition).vertexBuffer as any;
        } else {
          console.warn("Skipped iframe playback, not in buffer");
        }
      }
      (this.mesh.material as any).needsUpdate = true;
    }
    this._video.requestVideoFrameCallback(this.videoUpdateHandler);
  }

  // Start loop to check if we're ready to play
  play() {
    // console.log("Playing")
    const buffering = setInterval(() => {
      if (this.meshBuffer && this.meshBuffer.getBufferLength() >= this.keyframesToBufferBeforeStart) {
        // console.log("Keyframe buffer length is ", this.meshBuffer.getBufferLength(), ", playing video");
        clearInterval(buffering);
        this._video.play()
        this.mesh.visible = true
      }

    }, 1000 / 60);
    this._bufferingTimer = buffering;
  }

  getPositionInKeyframeBuffer(keyframeNumber: number): number {
    // Search backwards, which should make the for loop shorter on longer buffer
    for (let i = this.meshBuffer.getBufferLength(); i >= 0; i--) {
      if (
        this.meshBuffer.get(i) &&
        keyframeNumber == this.meshBuffer.get(i).frameNumber &&
        keyframeNumber == this.meshBuffer.get(i).keyframeNumber
      )
        return i;
    }
    return -1;
  }

  getPositionInIFrameBuffer(frameNumber: number): number {
    // Search backwards, which should make the for loop shorter on longer buffer
    for (let i = this.iframeVertexBuffer.getBufferLength(); i >= 0; i--) {
      if (
        this.iframeVertexBuffer.get(i) &&
        frameNumber == this.iframeVertexBuffer.get(i).frameNumber
      )
        return i;
    }
    return -1;
  }

  dispose(): void {
    // TODO: finish dispose method
    this._isinitialized = false;
    this._worker?.terminate();
    if (this._video) {
      // this._video.stop();
      // this._video.parentElement.removeChild(this._video);
      this._video = null;
      this._videoTexture.dispose();
      this._videoTexture = null;
    }
    if (this.meshBuffer) {
      for (let i = 0; i < this.meshBuffer.getBufferLength(); i++) {
        const buffer = this.meshBuffer.get(i);
        if (buffer && buffer.bufferGeometry instanceof BufferGeometry) {
          buffer.bufferGeometry?.dispose();
        }
      }
      this.meshBuffer.clear();
    }
    if (this._bufferingTimer) {
      clearInterval(this._bufferingTimer);
    }
  }
}
