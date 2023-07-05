import {
    BufferGeometry,
    Mesh,
    MeshBasicMaterial,
    ShaderMaterial,
    PlaneGeometry,
    CompressedArrayTexture,
    WebGLRenderer,
    GLSL3,
    Clock,
    Material,
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
type fetchBuffersCallback = () => void

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
    GeometryFrameCount: number
    TextureSegmentCount: number
    GeometryFrameRate: number
    TextureFrameRate: number
}

export default class Player {
    // Public Fields
    public renderer: WebGLRenderer
    public playMode: PlayMode
    public geometryBufferSize: number = 100
    public textureBufferSize: number = 20
    public minFramesRequired: number = 50 // If atleast these many frames aren't loaded, the video buffers.
    public minSegmentsRequired: number = 10 // If atleast these many segments aren't loaded, the video buffers.
    public currentGeometryFrame: number
    public currentTextureFrame: number


    // Three objects
    public paths: Array<string>
    public mesh: Mesh
    private ktx2Loader: KTX2Loader
    private dracoLoader: DRACOLoader
    private failMaterial: Material | null = null
    private clock: Clock | null

    // Private Fields
    private currentTime: number = 0
    private currentTrackId: number = 0
    private meshMap: Map<number, BufferGeometry> = new Map()
    private textureMap: Map<number, CompressedArrayTexture> = new Map()
    private onMeshBuffering: onMeshBufferingCallback | null = null
    private onFrameShow: onFrameShowCallback | null = null
    private lastRequestedGeometryFrame: number
    private lastRequestedTextureSegment: number
    private audio: HTMLAudioElement
    private fileHeader: FileHeader | null
    private vertexShader: string
    private fragmentShader: string
    private intervalId: NodeJS.Timer

    get currentTextureSegment(): number {
        if (this.fileHeader) {
            return Math.floor(this.currentTextureFrame / this.fileHeader.BatchSize)
        } else {
            return 0
        }
    }

    get paused(): boolean {
        if (this.fileHeader.AudioURL) {
            return this.audio.paused
        } else {
            return !this.clock.running
        }
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

        this.failMaterial = new MeshBasicMaterial({ color: 0xffffff })
    }

    prepareNextLoop = (nextTrackId?: number) => {
        this.fileHeader = null
        if (typeof nextTrackId === 'undefined') {
            if (this.playMode == PlayMode.random) {
                nextTrackId = Math.floor(Math.random() * this.paths.length)
            } else if (this.playMode == PlayMode.single) {
                nextTrackId = (this.currentTrackId + 1) % this.paths.length
            } else if (this.playMode == PlayMode.singleloop) {
                nextTrackId = this.currentTrackId
            } else {
                // PlayMode.loop
                nextTrackId = (this.currentTrackId + 1) % this.paths.length
            }
        }
        clearInterval(this.intervalId)
        this.currentTrackId = nextTrackId
        this.currentTime = 0;
        this.lastRequestedGeometryFrame = this.lastRequestedTextureSegment = -1
        const manifestFilePath = this.paths[this.currentTrackId].replace('uvol', 'manifest')

        fetch(manifestFilePath).then(response => response.json()).then(json => {
            this.fileHeader = json;

            // Always make sure, we have 5 seconds of buffer.
            this.geometryBufferSize = 5 * this.fileHeader.GeometryFrameRate;

            // segments instead of frames
            this.textureBufferSize = Math.ceil((2 * this.fileHeader.TextureFrameRate) / this.fileHeader.BatchSize)

            console.log('reeeived manifest file: ', this.fileHeader)
            if (this.fileHeader.AudioURL) {
                this.audio.src = this.fileHeader.AudioURL
                this.audio.currentTime = 0
                this.clock = null
            } else {
                // Managing time with THREE.Clock, since this video doesn't have audio
                this.clock = new Clock()
            }

            this.dispose();
            this.currentGeometryFrame = 0
            this.currentTextureFrame = 0
            this.fetchBuffers(this.startVideo); /** Start video once it fetches enough buffers */
        })
    }

    startVideo = () => {
        if (this.fileHeader.AudioURL) {
            this.audio.play()
        } else {
            this.clock.start()
        }
        console.info(`Playing new track: ${this.currentTrackId}, MeshMap.Size: ${this.meshMap.size}, TextureMap.Size: ${this.textureMap.size}`)
        this.intervalId = setInterval(() => {
            this.fetchBuffers();
        }, 100);
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
    fetchBuffers = (callback?: fetchBuffersCallback) => {
        const promises = []

        if ((this.lastRequestedGeometryFrame - this.currentGeometryFrame) < this.geometryBufferSize && this.lastRequestedGeometryFrame != (this.fileHeader.GeometryFrameCount - 1)) {
            let currentRequestingFrame = this.lastRequestedGeometryFrame + 1;
            this.lastRequestedGeometryFrame = Math.min(this.currentGeometryFrame + this.geometryBufferSize, this.fileHeader.GeometryFrameCount - 1);
            for (; currentRequestingFrame <= this.lastRequestedGeometryFrame; currentRequestingFrame++) {
                const padWidth = this.countHashChar(this.fileHeader.DRCURLPattern);
                const dracoURL = this.fileHeader.DRCURLPattern.replace('#'.repeat(padWidth), this.pad(currentRequestingFrame, padWidth));
                promises.push(this.decodeDraco(dracoURL, currentRequestingFrame));
            }
        }
        if ((this.lastRequestedTextureSegment - this.currentTextureSegment) < this.textureBufferSize && this.lastRequestedTextureSegment != (this.fileHeader.TextureSegmentCount - 1)) {
            let currentRequestingTextureSegment = this.lastRequestedTextureSegment + 1;
            this.lastRequestedTextureSegment = Math.min(this.currentTextureSegment + this.textureBufferSize, this.fileHeader.TextureSegmentCount - 1);
            for (; currentRequestingTextureSegment <= this.lastRequestedTextureSegment; currentRequestingTextureSegment++) {
                const padWidth = this.countHashChar(this.fileHeader.KTX2URLPattern);
                const textureURL = this.fileHeader.KTX2URLPattern.replace('#'.repeat(padWidth), this.pad(currentRequestingTextureSegment, padWidth));
                promises.push(this.decodeKTX2(textureURL, currentRequestingTextureSegment));
            }
        }

        if (callback) {
            Promise.all(promises).then(() => {
                callback()
            })
        }
    }

    decodeDraco = (dracoURL: string, frameNo: number) => {
        return new Promise((resolve, reject) => {
            this.dracoLoader.load(dracoURL, (geometry: BufferGeometry) => {
                this.meshMap.set(frameNo, geometry)
                resolve(true) // we only care about when this is resolved, to call callback()
            })
        })
    }

    decodeKTX2 = (textureURL: string, segmentNo: number) => {
        return new Promise((resolve, reject) => {
            this.ktx2Loader.load(textureURL, (texture: CompressedArrayTexture) => {
                this.textureMap.set(segmentNo, texture)
                resolve(true) // we only care about when this is resolved, to call callback()
            })
        })
    }

    processFrame = () => {
        if (!this.fileHeader) {
            return;
        }

        if (this.paused) {
            /**
             * Usually, this case arises when new track is set and fetchBuffers is still loading next frames.
             * Until, startVideo is called, this.paused stays true.
             */
            this.onMeshBuffering(this.meshMap.size / this.geometryBufferSize)
            return;
        }


        if (this.fileHeader.AudioURL) {
            this.currentTime = this.audio.currentTime;
        } else {
            this.currentTime += this.clock.getDelta()
        }

        this.currentGeometryFrame = Math.round(this.currentTime * this.fileHeader.GeometryFrameRate)

        // Need thoughts on this. We can also calculate texture frame from the geometry frame, and change it twice
        // this.currentTextureFrame = Math.round((this.currentGeometryFrame * this.fileHeader.TextureFrameRate) / (this.fileHeader.GeometryFrameRate))
        this.currentTextureFrame = Math.round(this.currentTime * this.fileHeader.TextureFrameRate)

        if (this.currentGeometryFrame >= this.fileHeader.GeometryFrameCount) {
            this.prepareNextLoop()
            return;
        }

        /**
         * We prioritize geometry frames over texture frames.
         * If meshMap does not have the geometry frame, simply skip it
         * If meshMap has geometry frame but not the texture segment, a default failMaterial is applied to that mesh.
         */

        if (!this.meshMap.has(this.currentGeometryFrame)) {
            return;
        }

        if (!this.textureMap.has(this.currentTextureSegment)) {
            this.mesh.geometry = this.meshMap.get(this.currentGeometryFrame)
            this.mesh.material = this.failMaterial
            this.onFrameShow?.(this.currentGeometryFrame);
            return;
        }

        this.onFrameShow(this.currentGeometryFrame)
        const offSet = this.currentTextureFrame % this.fileHeader.BatchSize;

        this.onFrameShow?.(this.currentGeometryFrame);

        // @ts-ignore
        if (offSet == 0 || !this.mesh.material.isShaderMaterial || (this.mesh.material.name != this.currentTextureSegment)) {
            /**
             * Either this is a new segment, hence we need to apply a new texture
             * Or In the previous frame, we applied to failMaterial, so that current mesh.material is not a ShaderMaterial.
             * Or Player skipped current segment's first frame hence it has old segment's ShaderMaterial
             * In all the above cases, we need to apply new texture since we know we have one.
             */
            const material = new ShaderMaterial({
                uniforms: {
                    diffuse: {
                        value: this.textureMap.get(this.currentTextureSegment),
                    },
                    depth: {
                        value: 0,
                    },
                },
                vertexShader: this.vertexShader,
                fragmentShader: this.fragmentShader,
                glslVersion: GLSL3,
            });
            material.name = this.currentTextureSegment.toString();
            material.needsUpdate = true;
            //@ts-ignore
            this.mesh.material.dispose()
            this.mesh.material = material;

            this.mesh.geometry = this.meshMap.get(this.currentGeometryFrame)
            if (this.mesh.geometry) {
                this.mesh.geometry.attributes.position.needsUpdate = true;
            }

        } else {
            this.mesh.geometry = this.meshMap.get(this.currentGeometryFrame)
            if (this.mesh.geometry) {
                this.mesh.geometry.attributes.position.needsUpdate = true;
            }
            // updating texture within CompressedArrayTexture
            (this.mesh.material as ShaderMaterial).uniforms['depth'].value = offSet;
        }
    }

    removePlayedBuffer(frameNo, segmentNo) {
        for (const [key, buffer] of this.meshMap.entries()) {
            if (key < frameNo) {
                buffer.dispose()
                this.meshMap.delete(key)
            }
        }

        for (const [key, buffer] of this.textureMap.entries()) {
            if (key < segmentNo) {
                buffer.dispose()
                this.textureMap.delete(key)
            }
        }
    }

    update = () => {
        if (!this.fileHeader) {
            return;
        }
        this.processFrame()
        this.removePlayedBuffer(this.currentGeometryFrame - 5, this.currentTextureSegment - 1)
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
