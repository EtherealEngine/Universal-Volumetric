import V1Player from "./V1/player";
import V2Player from "./V2/player";

import {
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    WebGLRenderer
} from 'three'

import {onMeshBufferingCallback, onFrameShowCallback, PlayMode} from "./Interfaces"

export type PlayerConstructorArgs = {
    renderer: WebGLRenderer
    playMode?: PlayMode
    paths: Array<string>
    encoderWindowSize?: number
    encoderByteLength?: number
    videoSize?: number
    video?: HTMLVideoElement
    onMeshBuffering?: onMeshBufferingCallback
    onFrameShow?: onFrameShowCallback
    worker?: Worker
    material?: MeshBasicMaterial | MeshBasicMaterial
    targetFramesToRequest: number
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
    private material: MeshBasicMaterial
    private currentTrack: number
    private fileHeader: any

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
        targetFramesToRequest = 90
    }: PlayerConstructorArgs) {
        this.renderer = renderer
        this.playMode = playMode
        this.paths = paths

        this.onMeshBuffering = onMeshBuffering
        this.onFrameShow = onFrameShow

        this.encoderWindowSize = encoderWindowSize
        this.encoderByteLength = encoderByteLength
        this.videoSize = videoSize
        this._worker = worker ? worker : new Worker(Player.defaultWorkerURL, { type: 'module', name: 'UVOL' }) // spawn new worker;
        this.material = material
        this.targetFramesToRequest = targetFramesToRequest
        this._video = video
        this.currentTrack = 0
        this.v1Instance = null
        this.v2Instance = null
        this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), this.material)
    }

    

    setCurrentTrack = (_nextTrack?: number) => {
        this.fileHeader = null
        if (typeof _nextTrack !== 'undefined') {
            this.currentTrack = _nextTrack
        } else {
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
        }
        
        fetch(this.paths[this.currentTrack]).then(response => response.json()).then(json => {
            this.fileHeader = json
            if (this.fileHeader.Version && this.fileHeader.Version == 'v2') {
                if (!this.v2Instance) {
                    this.v2Instance = new V2Player({
                        renderer: this.renderer,
                        onMeshBuffering: this.onMeshBuffering,
                        onFrameShow: this.onFrameShow,
                        mesh: this.mesh,
                        onTrackEnd: this.setCurrentTrack,
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
                        onTrackEnd: this.setCurrentTrack
                    })
                    console.info('Created UVOL1 Player Instance')
                } else {
                    console.info('Reusing existing UVOL1 Instance')
                }
            }
            this.play()
        })
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