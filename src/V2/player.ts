import {
    BufferGeometry,
    Mesh,
    MeshBasicMaterial,
    ShaderMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    CompressedArrayTexture,
    WebGLRenderer,
    GLSL3,
} from 'three'

import { DRACOLoader } from '../lib/DRACOLoader';
import { KTX2Loader } from '../lib/KTX2Loader';


export enum PlayMode {
    single = 'single',
    random = 'random',
    loop = 'loop',
    singleloop = 'singleloop'
}

type onMeshBufferingCallback = (progress: number) => void
type onFrameShowCallback = (frame: number) => void

export type PlayerConstructorArgs = {
    renderer: WebGLRenderer
    playMode?: PlayMode
    paths: Array<string>
    onMeshBuffering?: onMeshBufferingCallback
    onFrameShow?: onFrameShowCallback
}

export type FileHeader = {
    DRCURLPattern: string
    KTX2URLPattern: string
    AudioURL: string
    BatchSize: number
    TotalFrames: number
    FrameRate: number
}

export default class Player {
    // Public Fields
    public renderer: WebGLRenderer
    public playMode: PlayMode
    public geometryBufferSize: number = 75
    public textureBufferSize: number = 15
    public minFramesRequired: number = 50 // If atleast these many frames aren't loaded, the video buffers.
    public minSegmentsRequired: number = 10 // If atleast these many segments aren't loaded, the video buffers.

    // Three objects
    public paths: Array<string>
    public mesh: Mesh
    private ktx2Loader: KTX2Loader
    private dracoLoader: DRACOLoader
    private material: ShaderMaterial | null = null

    // Private Fields
    private audioTime: number = 0
    private currentTrack: number = 0
    private meshMap: Map<number, BufferGeometry> = new Map()
    private textureMap: Map<number, CompressedArrayTexture> = new Map()
    private onMeshBuffering: onMeshBufferingCallback | null = null
    private onFrameShow: onFrameShowCallback | null = null
    private lastRequestedGeometryFrame: number
    private lastRequestedTextureSegment: number
    private audio: HTMLAudioElement
    private fileHeader: FileHeader
    private vertexShader: string
    private fragmentShader: string

    get totalFrameCount(): number {
        return this.fileHeader.TotalFrames
    }

    get batchSize(): number {
        return this.fileHeader.BatchSize
    }

    get totalSegmentCount(): number {
        return Math.ceil(this.totalFrameCount / this.batchSize)
    }

    get currentFrame(): number {
        return Math.round(this.audioTime * this.fileHeader.FrameRate)
    }

    get currentSegment(): number {
        return Math.floor(this.currentFrame / this.batchSize)
    }

    get currentTrackData() {
        return this.paths[this.currentTrack]
    }


    constructor({
        renderer,
        playMode,
        paths,
        onMeshBuffering,
        onFrameShow,
    }: PlayerConstructorArgs) {
        this.renderer = renderer

        this.onMeshBuffering = onMeshBuffering
        this.onFrameShow = onFrameShow

        this.paths = paths

        if (typeof playMode === 'number') {
            /* Backward compatibility */
            switch (playMode) {
                case 1:
                    playMode = PlayMode.single
                    break
                case 2:
                    playMode = PlayMode.random
                    break
                case 3:
                    playMode = PlayMode.loop
                    break
                case 4:
                    playMode = PlayMode.singleloop
                    break
            }
        }

        this.playMode = playMode || PlayMode.loop
        console.log(this.playMode)

        /* This property is used by the parent components and rendered on the scene */
        this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), new MeshBasicMaterial({ color: 0xffffff }))

        this.ktx2Loader = new KTX2Loader();
        this.ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.153.0/examples/jsm/libs/basis/");
        this.ktx2Loader.detectSupport(this.renderer);

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.4.3/");
        this.dracoLoader.preload();

        this.audio = document.createElement('audio')
        this.prepareNextLoop()
        setInterval(() => {
            this.fetchBuffers();
        }, 500);

        this.vertexShader = `uniform vec2 size;
        out vec2 vUv;

        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            vUv = uv;
        }`
        this.fragmentShader = `
        
        
        precision highp sampler2DArray;
        uniform sampler2DArray diffuse;
        in vec2 vUv;
        uniform int depth;
        out vec4 outColor;
        
        void main() {
            vec4 color = texture2D( diffuse, vec3( vUv, depth ) );
            outColor = LinearTosRGB(color);
        }`
    }

    prepareNextLoop = () => {
        let nextTrack = -1;
        if (this.playMode == PlayMode.random) {
            nextTrack = Math.floor(Math.random() * this.paths.length)
        } else if (this.playMode == PlayMode.single) {
            nextTrack = (this.currentTrack + 1) % this.paths.length
        } else if (this.playMode == PlayMode.singleloop) {
            nextTrack = this.currentTrack
        } else {
            nextTrack = (this.currentTrack + 1) % this.paths.length
        }
        this.dispose();
        this.currentTrack = nextTrack
        this.audioTime = 0;
        this.lastRequestedGeometryFrame = this.lastRequestedTextureSegment = -1
        const manifestFilePath = this.paths[this.currentTrack].replace('uvol', 'manifest')

        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return
            this.fileHeader = JSON.parse(xhr.responseText)
        }
        xhr.open('GET', manifestFilePath, false) // false for synchronous
        xhr.send()
        this.audio.src = this.fileHeader.AudioURL
        this.audio.currentTime = 0
        console.info('Playing new track: ', this.currentTrack)
    }

    /**
     * Utility function to pad 'n' with 'width' number of '0' characters.
     * This is used when expanding URLs, which are filled with '#'
     * For example: frame_#### is expanded to frame_0000, frame_0010, frame_0100 etc...
     */
    pad(n: number, width: number) {
        const padChar = '0';
        let paddedN = n.toString()
        return paddedN.length >= width ? paddedN : new Array(width - paddedN.length + 1).join(padChar) + paddedN;
    }

    countHashChar(URL: string) {
        let count = 0
        for (let i = 0; i < URL.length; i++) {
            if (URL[i] === '#') {
                count++
            }
        }
        return count
    }

    /**
     * Fetches buffers according to Leaky Bucket algorithm.
     * If meshMap has less than required meshes, we keep fetching meshes. Otherwise, we keep fetching meshes.
     * Same goes for textures.
     */
    fetchBuffers = () => {
        if ((this.lastRequestedGeometryFrame - this.currentFrame) < this.geometryBufferSize && this.lastRequestedGeometryFrame != (this.totalFrameCount - 1)) {
            let currentRequestingFrame = this.lastRequestedGeometryFrame + 1;
            this.lastRequestedGeometryFrame = Math.min(this.currentFrame + this.geometryBufferSize, this.totalFrameCount - 1);
            for (; currentRequestingFrame <= this.lastRequestedGeometryFrame; currentRequestingFrame++) {
                const padWidth = this.countHashChar(this.fileHeader.DRCURLPattern);
                const dracoURL = this.fileHeader.DRCURLPattern.replace('#'.repeat(padWidth), this.pad(currentRequestingFrame, padWidth));
                this.decodeDraco(dracoURL, currentRequestingFrame);
            }
        }
        if ((this.lastRequestedTextureSegment - this.currentSegment) < this.textureBufferSize && this.lastRequestedTextureSegment != (this.totalSegmentCount - 1)) {
            let currentRequestingTextureSegment = this.lastRequestedTextureSegment + 1;
            this.lastRequestedTextureSegment = Math.min(this.currentSegment + this.textureBufferSize, this.totalSegmentCount - 1);
            for (; currentRequestingTextureSegment <= this.lastRequestedTextureSegment; currentRequestingTextureSegment++) {
                const padWidth = this.countHashChar(this.fileHeader.KTX2URLPattern);
                const textureURL = this.fileHeader.KTX2URLPattern.replace('#'.repeat(padWidth), this.pad(currentRequestingTextureSegment, padWidth));
                this.decodeKTX2(textureURL, currentRequestingTextureSegment);
            }
        }
        if (this.audio.ended || (this.currentFrame + 1) >= this.totalFrameCount) {
            this.prepareNextLoop();
        }        
    }

    decodeDraco = (dracoURL: string, frameNo: number) => {
        this.dracoLoader.load(dracoURL, (geometry: BufferGeometry) => {
            this.meshMap.set(frameNo, geometry)
        })
    }

    decodeKTX2 = (textureURL: string, segmentNo: number) => {
        this.ktx2Loader.load(textureURL, (texture: CompressedArrayTexture) => {
            this.textureMap.set(segmentNo, texture)
        })
    }

    processFrame = () => {
        this.audioTime = this.audio.currentTime;
        const nextThresholdFrame = Math.min(this.currentFrame + this.minFramesRequired, this.totalFrameCount - 1)
        const nextThresholdSegment = Math.min(this.currentSegment + this.minSegmentsRequired, this.totalSegmentCount - 1)


        const canPlay = (
            this.meshMap.has(this.currentFrame) &&
            this.meshMap.has(nextThresholdFrame) &&
            this.textureMap.has(this.currentSegment) &&
            this.textureMap.has(nextThresholdSegment)
        )

        if (!canPlay) {
            this.onMeshBuffering(this.meshMap.size / this.minFramesRequired)
            if (!this.audio.paused) {
                this.audio.pause()
            }
            return;
        }


        if (this.audio.paused) {
            this.audio.play()
        }
        if (this.currentFrame >= this.totalFrameCount) {
            this.prepareNextLoop()
            return;
        }
        this.onFrameShow(this.currentFrame)
        const offSet = this.currentFrame % this.batchSize;

        this.onFrameShow?.(this.currentFrame);
        if (offSet == 0) {
            /* this video texture is a new segment, updating mesh's material with new segment's material */

            const material = new ShaderMaterial({
                uniforms: {
                    diffuse: {
                        value: this.textureMap.get(this.currentSegment),
                    },
                    depth: {
                        value: 0,
                    },
                },
                vertexShader: this.vertexShader,
                fragmentShader: this.fragmentShader,
                glslVersion: GLSL3,
            });
            material.needsUpdate = true;
            //@ts-ignore
            this.mesh.material.dispose()
            this.mesh.material = material;

            this.mesh.geometry = this.meshMap.get(this.currentFrame)
            this.mesh.geometry.attributes.position.needsUpdate = true;

        } else {
            this.mesh.geometry = this.meshMap.get(this.currentFrame)
            this.mesh.geometry.attributes.position.needsUpdate = true;
            // updating texture within CompressedArrayTexture
            (this.mesh.material as ShaderMaterial).uniforms['depth'].value = offSet;
        }
    }

    removePlayedBuffer() {
        const previousFrame = this.currentFrame - 5
        const previousSegment = this.currentSegment - 1
        if (previousFrame >= 0) {
            for (const [key, buffer] of this.meshMap.entries()) {
                if (key < previousFrame) {
                    buffer.dispose()
                    this.meshMap.delete(key)
                }
            }
        }

        if (previousSegment >= 0) {
            for (const [key, buffer] of this.textureMap.entries()) {
                if (key < previousSegment) {
                    buffer.dispose()
                    this.textureMap.delete(key)
                }
            }
        }
    }

    update = () => {
        // this.fetchBuffers()
        this.processFrame()
        this.removePlayedBuffer()
    }

    dispose(): void {
        if (this.meshMap) {
            for (let i = 0; i < this.meshMap.size; i++) {
                const buffer = this.meshMap.get(i)
                if (buffer && buffer instanceof BufferGeometry) {
                    buffer.dispose()
                }
            }
            this.meshMap.clear()
        }

        if (this.textureMap) {
            for (let i = 0; i < this.textureMap.size; i++) {
                const buffer = this.textureMap.get(i)
                if (buffer && buffer instanceof CompressedArrayTexture) {
                    buffer.dispose()
                }
            }
            this.textureMap.clear()
        }
    }
}
