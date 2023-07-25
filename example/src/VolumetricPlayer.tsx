import React, { useEffect, useRef, useState } from 'react'
import {
  Group,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WebGLRendererParameters
} from 'three'
import { OrbitControls } from 'three-stdlib'
import Player from 'universal-volumetric/dist/Player'
import Stats from 'stats.js'
import { PlayMode } from '../../dist/Interfaces'

const cameraOrbitingHeight = 1.7
const cameraDistance = 6.5
const cameraVerticalOffset = 0.4
const cameraFov = 35

type VolumetricPlayerProps = {
  paths: Array<string>
  style: any
}

const VolumetricPlayer = (props: VolumetricPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const playerRef = useRef<Player | null>(null)
  const anchorRef = useRef<Object3D | null>(null)
  const sceneRef = useRef<Object3D | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  let animationFrameId: number
  const [dracosisSequence, setDracosisSequence] = useState<Player | null>(null)
  const [playIsStarted, setPlayIsStarted] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [bufferingProgress, setBufferingProgress] = useState(0)
  const [bufferingTimestamp, setBufferingTimestamp] = useState(Date.now())
  const [, setForceRerender] = useState(0)
  const videoReady = !!dracosisSequence

  const stats = new Stats()
  stats.showPanel(1)


  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    if (!canvasRef.current) {
      return
    }

    let w = (container as any).clientWidth,
      h = (container as any).clientHeight
    if (!sceneRef.current) {
      sceneRef.current = new Scene()
    }
    const scene = sceneRef.current

    if (!anchorRef.current) {
      anchorRef.current = new Group()
    }
    const anchor = anchorRef.current
    scene.add(anchor)

    if (!cameraRef.current) {
      cameraRef.current = new PerspectiveCamera(cameraFov, w / h, 0.001, 100)
    }
    const camera = cameraRef.current
    if (!controlsRef.current) {
      controlsRef.current = new OrbitControls(camera, container)
      controlsRef.current.addEventListener('change', () => {
        renderNeedsUpdate = true
      })
    }
    const controls = controlsRef.current

    const renderConfig: WebGLRendererParameters = {
      canvas: canvasRef.current,
      // antialias: true,
      alpha: true,
      precision: 'highp',
      powerPreference: 'high-performance',
      stencil: false,
      antialias: false,
      depth: true,
      logarithmicDepthBuffer: true,
      // canvas,
      // context,
      preserveDrawingBuffer: false,
      //@ts-ignore
      multiviewStereo: true
    }
    if (!rendererRef.current) {
      console.log('config: ', renderConfig)
      rendererRef.current = new WebGLRenderer(renderConfig)
      rendererRef.current.debug.checkShaderErrors = true
    }
    let renderer = rendererRef.current
    if (controls) {
      controls.target = new Vector3(0, cameraOrbitingHeight, 0)
      controls.panSpeed = 0.4
      camera.position.set(0, cameraOrbitingHeight, cameraDistance)
      camera.lookAt(controls.target)
    }
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)
    ;(container as any).appendChild(renderer.domElement)
    ;(container as any).appendChild(stats.dom)
    const onResize = function () {
      console.log('onResize!')
      w = (container as any).clientWidth
      h = (container as any).clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      setCameraOffset()
      renderNeedsUpdate = true
    }

    window.addEventListener('resize', onResize)

    /**
     * shift camera from it's center
     */
    function setCameraOffset() {
      const fullWidth = w
      const fullHeight = h + h * Math.abs(cameraVerticalOffset)
      const width = w
      const height = h
      const x = 0
      const y = h * cameraVerticalOffset
      /*
        fullWidth — full width of multiview setup
        fullHeight — full height of multiview setup
        x — horizontal offset of subcamera
        y — vertical offset of subcamera
        width — width of subcamera
        height — height of subcamera
       */
      camera.setViewOffset(fullWidth, fullHeight, x, y, width, height)
    }
    setCameraOffset()

    let renderNeedsUpdate = false
    function render() {
      stats.begin()
      playerRef.current?.update()
      stats.end()
      controls?.update()
      animationFrameId = requestAnimationFrame(render)
      renderer.render(scene, camera)
    }

    console.log('create new player')

    if (!playerRef.current) {
      playerRef.current = new Player({
        renderer,
        paths: props.paths,
        onMeshBuffering: (progress: number) => {
          console.warn('BUFFERING!!', progress)
          setBufferingProgress(Math.round(progress * 100))
          setIsBuffering(true)
          setBufferingTimestamp(Date.now())
          setTimeout(() => setForceRerender(Math.random()), 100)
        },
        onFrameShow: () => {
          setIsBuffering(false)
        },
        playMode: PlayMode.loop,
        video: document.createElement('video')
      })
      playerRef.current.mesh.scale.setScalar(0.001)
      scene.add(playerRef.current.mesh as any)
    }

    //test purpose
    //@ts-ignore
    window.UVOLPlayer = playerRef.current

    setDracosisSequence(playerRef.current)

    console.log('+++  dracosisSequence')

    render()

    return () => {
      console.log('+++ CLEANUP player')

      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', onResize)
      // clear volumetric player
      playerRef.current?.dispose()

      playerRef.current = null
      sceneRef.current = null
      anchorRef.current = null
      cameraRef.current = null

      controlsRef.current?.dispose()
      controlsRef.current = null

      setDracosisSequence(null)
      setPlayIsStarted(false)
      setIsBuffering(false)
    }
  }, [])

  function startPlayer() {
    if (videoReady && dracosisSequence) {
      dracosisSequence.setTrackPath()
      setPlayIsStarted(true)
    }
  }

  const timeSincebufferingStarted = Date.now() - bufferingTimestamp

  const playButton = playIsStarted ? null : (
    <button onTouchEnd={() => startPlayer()} onClick={() => startPlayer()} className={'button player-play'}>
      {videoReady ? 'Play' : 'Loading...'}
    </button>
  )
  const bufferingIndication =
    playIsStarted && isBuffering && timeSincebufferingStarted > 80 ? (
      <div className={'buffering-indication'}>Buffering...</div>
    ) : null
  return (
    <div className="volumetric__player" style={props.style} ref={containerRef}>
      {playButton}
      {bufferingIndication}
      <canvas ref={canvasRef} className={'mainCanvas'} />
    </div>
  )
}

export default VolumetricPlayer
