import V1Player from "./V1/player";
import V2Player from "./V2/player";

import {
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    WebGLRenderer
} from 'three'

import { onMeshBufferingCallback, onFrameShowCallback, PlayMode } from "./Interfaces"

export type PlayerConstructorArgs = {
    renderer: WebGLRenderer,
    playMode?: PlayMode,
    paths: Array<string>,
    onMeshBuffering?: onMeshBufferingCallback,
    onFrameShow?: onFrameShowCallback
    V1Args: {
        encoderWindowSize?: number,
        encoderByteLength?: number,
        videoSize?: number,
        worker?: Worker,
        material?: MeshBasicMaterial | MeshBasicMaterial,
        video?: HTMLVideoElement
    },
    V2Args: {
        audio?: HTMLAudioElement
    }
}

export default class Player {
    static defaultWorkerURL = new URL('./V1/worker.build.js', import.meta.url).href

    // Public Fields
    public renderer: WebGLRenderer
    public playMode: PlayMode
    public v1Instance: V1Player | null = null
    public v2Instance: V2Player | null = null
    public targetFramesToRequest: number
    public encoderWindowSize = 8 // length of the databox
    public encoderByteLength = 16
    public videoSize = 1024
    public bufferDuration = 6 // V2 player buffer length in seconds
    public intervalDuration = 3 // V2 player fetchBuffer period in seconds

    // Three objects
    public paths: Array<string>
    public mesh: Mesh

    // Private Fields
    private onMeshBuffering: onMeshBufferingCallback | null = null
    private onFrameShow: onFrameShowCallback | null = null
    private _worker: Worker
    private _video: HTMLVideoElement = null
    private _audio: HTMLAudioElement = null
    private material: MeshBasicMaterial
    private currentTrack: number
    private fileHeader: any

    constructor(props: PlayerConstructorArgs) {
        this.renderer = props.renderer
        this.playMode = props.playMode
        this.paths = props.paths

        this.onMeshBuffering = props.onMeshBuffering
        this.onFrameShow = props.onFrameShow

        if (props.V1Args) {
            this.encoderWindowSize = props.V1Args.encoderWindowSize ? props.V1Args.encoderWindowSize : 8
            this.encoderByteLength = props.V1Args.encoderByteLength ? props.V1Args.encoderByteLength : 16
            this.videoSize = props.V1Args.videoSize ? props.V1Args.videoSize : 1024
            this._worker = props.V1Args.worker ? props.V1Args.worker : new Worker(Player.defaultWorkerURL, { type: 'module', name: 'UVOL' }) // spawn new worker;
            this.material = props.V1Args.material
            this._video = props.V1Args.video
        }

        if (props.V2Args) {
            this._audio = props.V2Args.audio
        }

        this.currentTrack = 0
        this.v1Instance = null
        this.v2Instance = null
        this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), this.material)
    }



    public setTrackPath = (_nextPath?: string) => {
        this.fileHeader = null
        if (typeof _nextPath === 'undefined') {
            let nextTrack = null
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
                //PlayModeEnum.Loop
                nextTrack = (this.currentTrack + 1) % this.paths.length
            }

            this.currentTrack = nextTrack
            _nextPath = this.paths[this.currentTrack]
        }

        fetch(_nextPath).then(response => response.json()).then(json => {
            this.fileHeader = json
            if (this.fileHeader.Version && this.fileHeader.Version == 'v2') {
                if (!this.v2Instance) {
                    this.v2Instance = new V2Player({
                        renderer: this.renderer,
                        onMeshBuffering: this.onMeshBuffering,
                        onFrameShow: this.onFrameShow,
                        mesh: this.mesh,
                        onTrackEnd: this.setTrackPath,
                        audio: this._audio
                    })
                    console.info('Created UVOL2 Player Instance')
                } else {
                    console.info('Reusing existing UVOL2 Instance')
                }
            } else {
                if (!this.v1Instance) {
                    this.v1Instance = new V1Player({
                        renderer: this.renderer,
                        mesh: this.mesh,
                        encoderWindowSize: this.encoderWindowSize,
                        encoderByteLength: this.encoderByteLength,
                        videoSize: this.videoSize,
                        video: this._video,
                        onMeshBuffering: this.onMeshBuffering,
                        onFrameShow: this.onFrameShow,
                        worker: this._worker,
                        material: this.material,
                        onTrackEnd: this.setTrackPath
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
        if (this.fileHeader.Version && this.fileHeader.Version == 'v2') {
            this.v2Instance.pause()
        } else {
            this.v1Instance.pause()
        }
    }

    play() {
        console.log(this.fileHeader)
        if (this.fileHeader.Version && this.fileHeader.Version == 'v2') {
            this.v2Instance.playTrack(this.fileHeader, this.bufferDuration, this.intervalDuration)
        } else {
            this.v1Instance.playTrack(this.fileHeader, this.targetFramesToRequest, this.paths[this.currentTrack])
        }
    }

    update() {
        if (!this.fileHeader) {
            return
        }
        if (this.fileHeader.Version && this.fileHeader.Version == 'v2') {
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