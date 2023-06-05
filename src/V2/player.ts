import {
    BufferGeometry,
    Float32BufferAttribute,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    ShaderMaterial,
    PlaneGeometry,
    // sRGBEncoding,
    SRGBColorSpace,
    Texture,
    Uint16BufferAttribute,
    CompressedArrayTexture,
    WebGLRenderer,
    Vector2,
    GLSL3,
    Clock
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
    material?: MeshBasicMaterial | MeshBasicMaterial
}

export default class Player {
    static defaultWorkerURL = new URL('./worker.build.js', import.meta.url).href

    // Public Fields
    public renderer: WebGLRenderer
    public playMode: PlayMode

    // Three objects
    public mesh: Mesh
    public paths: Array<string>
    public material: MeshBasicMaterial
    public failMaterial?: MeshBasicMaterial

    // Private Fields
    private currentFrame: number = 0
    private currentSegment: number = 0
    private currentTrack: number = 0
    private meshMap: Map<number, BufferGeometry> = new Map()
    private textureMap: Map<number, CompressedArrayTexture> = new Map()
    private onMeshBuffering: onMeshBufferingCallback | null = null
    private onFrameShow: onFrameShowCallback | null = null

    private manifestData: any;
    private ktx2Loader: KTX2Loader
    private dracoLoader: DRACOLoader
    private clock: Clock
    private pendingFetchRequest: number
    private lastRequestedSegment: number
    private lastPlayedTexture: number
    private totalFrameCount: number



    constructor({
        renderer,
        playMode,
        paths,
        onMeshBuffering,
        onFrameShow,
        material
    }: PlayerConstructorArgs) {
        this.renderer = renderer

        this.onMeshBuffering = onMeshBuffering
        this.onFrameShow = onFrameShow

        this.paths = paths

        // backwards-compat
        if (typeof playMode === 'number') {
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
        this.material = material
        this.mesh = new Mesh(new PlaneGeometry(0.00001, 0.00001), new MeshStandardMaterial({ color: 0xffffff }))
        this.ktx2Loader = new KTX2Loader();
        this.ktx2Loader.setTranscoderPath("/");
        this.ktx2Loader.detectSupport(this.renderer);

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath("/");
        this.dracoLoader.preload();

        this.clock = new Clock();
        this.pendingFetchRequest = 0
        this.lastRequestedSegment = -1
        this.lastPlayedTexture = 0
        this.prepareNextLoop()
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
        this.currentTrack = nextTrack
        console.log('new track: ', this.currentTrack)
        this.currentFrame = 0;
        this.lastPlayedTexture = 0
        this.lastRequestedSegment = -1
        this.fetchManifest();
        const currentBatchSize = this.manifestData.batchSize
        this.totalFrameCount = ((this.manifestData.sequences.length - 1) * currentBatchSize) + (this.manifestData.sequences.slice(-1)[0].length - 2)
    }

    fetchManifest = () => {
        const manifestFilePath = this.paths[this.currentTrack].replace('uvol', 'manifest');
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return
            this.manifestData = JSON.parse(xhr.responseText)
        }

        xhr.open('GET', manifestFilePath, false) // true for asynchronous
        xhr.send()
    }

    getNextSegmentToRequest = (loaded, notLoaded) => {
        let nextSegmentToRequest = Math.floor(notLoaded / this.manifestData.batchSize)
        while (loaded <= notLoaded) {
            const mid = Math.floor((loaded + notLoaded) / 2)
            if (!this.meshMap.has(mid)) {
                nextSegmentToRequest = Math.floor(mid / this.manifestData.batchSize)
                notLoaded = mid
            } else {
                loaded = mid
            }
        }
        return nextSegmentToRequest
    }

    fetchBuffers = () => {
        if (this.lastRequestedSegment == (this.manifestData.sequences.length - 1)) {
            return;
        }
        const currentSegment = this.lastRequestedSegment + 1
        const minNeededSegments = 3;
        const nextSegment = Math.min(this.manifestData.sequences.length - 1, currentSegment + minNeededSegments - 1)
        const totalSegmentsToBeRequested = nextSegment - currentSegment + 1;
        // console.log(`Pending Requests: ${this.pendingFetchRequest}, MeshMap.size = ${this.meshMap.size}, TextureMap.size = ${this.textureMap.size}`);

        if (this.pendingFetchRequest > 0) {
            console.log('\tpending: ', this.pendingFetchRequest);
            return;
        }

        this.pendingFetchRequest += totalSegmentsToBeRequested;
        console.log(`Fetching segments: [${currentSegment}, ${nextSegment}], pendingRequests: ${this.pendingFetchRequest}`)
        for (let segmentNo = currentSegment; segmentNo <= nextSegment; segmentNo++) {
            const segmentData = this.manifestData.sequences[segmentNo];
            const currentFrameCount = segmentData.length - 2;
            const startFrame = segmentNo * this.manifestData.batchSize, endFrame = segmentNo * this.manifestData.batchSize + currentFrameCount - 1
            if (this.textureMap.has(segmentNo) || this.meshMap.has(startFrame)) {
                console.log('ignoring segment, cuz we already have that: ', segmentNo)
                this.pendingFetchRequest--
                continue;
            }



            const requestStart = segmentData[0]
            const requestEnd = (segmentNo == (this.manifestData.sequences.length - 1)) ? "" : segmentData[currentFrameCount + 1]
            this.lastRequestedSegment = segmentNo
            fetch(this.paths[this.currentTrack], {
                headers: {
                    range: `bytes=${requestStart}-${requestEnd}`
                }
            }).then(response => response.arrayBuffer()).then(buffer => {
                const offSet = segmentData[0]
                this.decodeKTX2(buffer.slice(segmentData[0] - offSet, segmentData[1] - offSet), segmentNo);
                for (let frameNo = startFrame; frameNo <= endFrame; frameNo++) {
                    this.decodeDraco(buffer.slice(segmentData[frameNo - startFrame + 1] - offSet, segmentData[frameNo - startFrame + 2] - offSet), frameNo)
                }
            })
        }
    }

    decodeDraco = (buffer, frameIndex) => {
        const dracoTaskConfig = {
            attributeIDs: {
                position: 'POSITION',
                normal: 'NORMAL',
                color: 'COLOR',
                uv: 'TEX_COORD',
            },
            attributeTypes: {
                position: 'Float32Array',
                normal: 'Float32Array',
                color: 'Float32Array',
                uv: 'Float32Array',
            },
            useUniqueIDs: false,
            vertexColorSpace: SRGBColorSpace,
        };
        this.dracoLoader.decodeGeometry(
            buffer,
            dracoTaskConfig
        ).then(decodedDraco => {
            this.meshMap.set(frameIndex, decodedDraco);
        })
    }

    decodeKTX2 = (buffer, segmentIndex) => {
        this.ktx2Loader._createTexture(buffer).then(decodedTexture => {
            const decodedMaterial = new ShaderMaterial({
                uniforms: {
                    diffuse: {
                        value: decodedTexture,
                    },
                    depth: {
                        value: 0,
                    },
                    size: { value: new Vector2(4096, 4096) },
                },
                vertexShader: `uniform vec2 size;
            out vec2 vUv;
            
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                vUv = uv;
            }`,
                fragmentShader: `precision highp float;
            precision highp int;
            precision highp sampler2DArray;
            
            uniform sampler2DArray diffuse;
            in vec2 vUv;
            uniform int depth;
            out vec4 outColor;
            
            void main() {
                vec4 color = texture( diffuse, vec3( vUv, depth ) );
                outColor = vec4(color.rgb, 1.0 );
            }`,
                glslVersion: GLSL3,
            });
            // @ts-ignore
            this.textureMap.set(segmentIndex, decodedMaterial);
            this.pendingFetchRequest -= 1
        })
    }

    processFrame = () => {
        const previousFrameInt = Math.round(this.currentFrame)
        const previousSegment = Math.floor(previousFrameInt / this.manifestData.batchSize);
        const thresholdFrame = previousFrameInt + 1;
        const thresholdSegment = Math.floor(thresholdFrame / this.manifestData.batchSize);
        const canPlay = (this.meshMap.has(previousFrameInt) &&
            this.meshMap.has(thresholdFrame) &&
            this.textureMap.has(previousSegment) &&
            this.textureMap.has(thresholdSegment))

        // console.log(previousFrameInt, Array.from(this.meshMap), Array.from(this.textureMap))
        if (!canPlay) {
            this.clock.running = false // pausing the clock
            // console.log('pausing the clock', this.meshMap.size, this.textureMap.size, this.meshMap.has(previousFrameInt), this.meshMap.has(thresholdFrame), this.textureMap.has(previousSegment), this.textureMap.has(thresholdSegment), Array.from(this.meshMap.keys()), Array.from(this.textureMap.keys()), previousFrameInt)
            return;
        }


        if (!this.clock.running) {
            // continuing again
            this.clock.running = true
            this.clock.start() // sets date to current date time
            console.log('restarted clock')
        }

        const delta = this.clock.getDelta() // in seconds
        this.currentFrame += delta * this.manifestData.frameRate;
        const currentFrameInt = Math.round(this.currentFrame)
        console.log('delta: ', delta, 'playing frame no: ', currentFrameInt)
        const currentBatchSize = this.manifestData.batchSize
        const offSet = currentFrameInt % currentBatchSize;

        if (currentFrameInt >= this.totalFrameCount) {
            this.prepareNextLoop()
        }

        this.currentSegment = Math.floor(currentFrameInt / currentBatchSize);

        if (!this.meshMap.has(currentFrameInt) || !this.textureMap.has(this.currentSegment)) {
            this.onMeshBuffering?.(0)
            return;
        }


        this.onFrameShow?.(currentFrameInt);
        this.mesh.geometry = this.meshMap.get(currentFrameInt)
        this.mesh.geometry.attributes.position.needsUpdate = true;
        if (offSet == 0 || this.lastPlayedTexture != this.currentSegment) {
            /* this video texture is a new segment */

            // @ts-ignore
            this.mesh.material = this.textureMap.get(this.currentSegment);

            // @ts-ignore
            this.mesh.material.needsUpdate = true;

            this.lastPlayedTexture = this.currentSegment
        }

        (this.mesh.material as ShaderMaterial).uniforms['depth'].value = offSet;
    }

    removePlayedBuffer() {
        const currentFrameInt = Math.round(this.currentFrame)
        /* remove played buffer */
        for (const [key, buffer] of this.meshMap.entries()) {
            if (key < currentFrameInt) {
                buffer.dispose()
                this.meshMap.delete(key)
            }
        }

        for (const [key, buffer] of this.textureMap.entries()) {
            if (key < this.currentSegment) {
                buffer.dispose()
                this.textureMap.delete(key)
            }
        }
    }

    update = () => {
        this.fetchBuffers()
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