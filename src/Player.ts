import { Mesh, MeshBasicMaterial, PlaneGeometry, WebGLRenderer } from 'three'

import {
  FileHeader,
  onFrameShowCallback,
  onMeshBufferingCallback,
  onTrackEndCallback,
  PlayMode,
  V1FileHeader,
  V2FileHeader
} from './Interfaces'
import V1Player from './V1/player'
import V2Player from './V2/player'

export type PlayerConstructorArgs = {
  renderer: WebGLRenderer
  playMode?: PlayMode
  paths: Array<string>
  onMeshBuffering?: onMeshBufferingCallback
  onFrameShow?: onFrameShowCallback
  onTrackEnd?: onTrackEndCallback
  video?: HTMLVideoElement
  V1Args?: {
    encoderWindowSize?: number
    encoderByteLength?: number
    videoSize?: number
    targetFramesToRequest?: number
    worker?: Worker
  }
  V2Args?: {
    bufferDuration?: number
    intervalDuration?: number
  }
}

export default class Player {
  static defaultWorkerURL = new URL('./V1/worker.build.js', import.meta.url).href

  // Public Fields
  public renderer: WebGLRenderer
  public v1Instance: V1Player | null = null
  public v2Instance: V2Player | null = null
  public playMode: PlayMode

  // Three objects
  public paths: Array<string>
  public mesh: Mesh

  // Private Fields
  private onMeshBuffering: onMeshBufferingCallback | null = null
  private onFrameShow: onFrameShowCallback | null = null
  private onTrackEnd: onTrackEndCallback | null = null
  private video: HTMLVideoElement = null
  public encoderWindowSize = 8
  public encoderByteLength = 16
  public videoSize = 1024
  public targetFramesToRequest = 90
  private worker: Worker

  public bufferDuration = 4 // V2 player buffer length in seconds
  public intervalDuration = 2 // V2 player fetchBuffer period in seconds

  private currentTrack: number
  private fileHeader: FileHeader
  private currentManifestPath: string

  constructor(props: PlayerConstructorArgs) {
    this.renderer = props.renderer
    this.playMode = props.playMode
    this.paths = props.paths

    this.onMeshBuffering = props.onMeshBuffering
    this.onFrameShow = props.onFrameShow
    this.onTrackEnd = props.onTrackEnd ? props.onTrackEnd : this.setTrackPath
    this.video = props.video

    if (props.V1Args) {
      /** Not including worker here. Create worker on demand i.e., if UVOL1 is requested. */
      const optionalArgs = ['encoderWindowSize', 'encoderByteLength', 'videoSize', 'targetFramesToRequest', 'worker']
      optionalArgs.forEach((arg, _) => {
        if (typeof props.V1Args[arg] !== 'undefined') {
          this[arg] = props.V1Args[arg]
        }
      })
    }

    if (props.V2Args) {
      const optionalArgs = ['bufferDuration', 'intervalDuration']
      optionalArgs.forEach((arg, _) => {
        if (typeof props.V2Args[arg] !== 'undefined') {
          this[arg] = props.V2Args[arg]
        }
      })
    }

    this.currentTrack = undefined
    this.v1Instance = null
    this.v2Instance = null
    this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), new MeshBasicMaterial({ color: 0xffffff }))
  }

  get isV2() {
    if ('Version' in this.fileHeader && this.fileHeader.Version == 'v2') {
      return true
    }
    return false
  }

  public setTrackPath = (_nextPath?: string) => {
    this.fileHeader = null
    if (typeof _nextPath === 'undefined') {
      let nextTrack = null
      if (typeof this.currentTrack === 'undefined') {
        this.currentTrack = -1 // So that, currentTrack + 1 would be 0.
      }
      if (this.playMode == PlayMode.random) {
        nextTrack = Math.floor(Math.random() * this.paths.length)
      } else if (this.playMode == PlayMode.single) {
        nextTrack = (this.currentTrack + 1) % this.paths.length
        if (this.currentTrack + 1 == this.paths.length) {
          nextTrack = 0
        }
      } else if (this.playMode == PlayMode.singleloop) {
        nextTrack = this.currentTrack
      } else {
        nextTrack = (this.currentTrack + 1) % this.paths.length
      }

      this.currentTrack = nextTrack
      _nextPath = this.paths[this.currentTrack]
      this.currentManifestPath = _nextPath
    }

    fetch(_nextPath)
      .then((response) => response.json())
      .then((json) => {
        this.fileHeader = json
        this.currentManifestPath = _nextPath
        if (this.isV2) {
          if (!this.v2Instance) {
            this.v2Instance = new V2Player({
              renderer: this.renderer,
              onMeshBuffering: this.onMeshBuffering,
              onFrameShow: this.onFrameShow,
              mesh: this.mesh,
              onTrackEnd: this.onTrackEnd,
              audio: this.video as HTMLAudioElement
            })
            console.info('Created UVOL2 Player Instance')
          } else {
            console.info('Reusing existing UVOL2 Instance')
          }
        } else {
          if (!this.v1Instance) {
            this.worker = this.worker
              ? this.worker
              : new Worker(Player.defaultWorkerURL, { type: 'module', name: 'UVOL' })

            this.v1Instance = new V1Player({
              renderer: this.renderer,
              mesh: this.mesh,
              encoderWindowSize: this.encoderWindowSize,
              encoderByteLength: this.encoderByteLength,
              videoSize: this.videoSize,
              video: this.video,
              onMeshBuffering: this.onMeshBuffering,
              onFrameShow: this.onFrameShow,
              worker: this.worker,
              onTrackEnd: this.onTrackEnd,
              targetFramesToRequest: this.targetFramesToRequest
            })
            console.info('Created UVOL1 Player Instance')
          } else {
            console.info('Reusing existing UVOL1 Instance')
          }
        }
        this.play()
      })
  }

  pause() {
    if (this.isV2) {
      this.v2Instance.pause()
    } else {
      this.v1Instance.pause()
    }
  }

  play() {
    console.log(this.fileHeader)
    if (this.isV2) {
      this.v2Instance.playTrack(this.fileHeader as V2FileHeader, this.bufferDuration, this.intervalDuration)
    } else {
      this.v1Instance.playTrack(this.fileHeader as V1FileHeader, this.targetFramesToRequest, this.currentManifestPath)
    }
  }

  update() {
    if (!this.fileHeader) {
      return
    }
    if (this.isV2) {
      this.v2Instance.update()
    } else {
      this.v1Instance.update()
    }
  }

  dispose() {
    if (this.v1Instance) {
      this.v1Instance.dispose()
    }
    if (this.v2Instance) {
      this.v2Instance.dispose()
    }
  }
}
