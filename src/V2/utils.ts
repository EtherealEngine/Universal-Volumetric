/**
 * This module contains stateless and immutable utility functions.
 * Meaning they do not depend on any external state and they do not mutate any external state.
 */
import {
  BufferGeometry,
  CompressedPixelFormat,
  CompressedTexture,
  Material,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Texture,
  WebGLRenderer
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
import { KTXLoader } from 'three/examples/jsm/loaders/KTXLoader'

import { FORMATS_TO_EXT, GeometryFormat, GeometryTarget, TextureFormat, TextureType, V2Schema } from '../Interfaces'

/**
 * Utility function to pad 'n' with 'width' number of '0' characters.
 * This is used when expanding URLs, which are filled with '#'
 * For example: frame_#### is expanded to frame_0000, frame_0010, frame_0100 etc...
 */
export function pad(n: number, width: number) {
  const padChar = '0'
  let paddedN = n.toString()
  return paddedN.length >= width ? paddedN : new Array(width - paddedN.length + 1).join(padChar) + paddedN
}

export function countHashChar(URL: string) {
  let count = 0
  for (let i = 0; i < URL.length; i++) {
    if (URL[i] === '#') {
      count++
    }
  }
  return count
}

export function isTextureFormatSupported(renderer: WebGLRenderer, format: TextureFormat) {
  if (format == 'ktx2') {
    return true
  } else if (format == 'astc/ktx') {
    return renderer.extensions.has('WEBGL_compressed_texture_astc')
  }
}

/**
 * If the URL paths in UVOL2 manifest are relative, Create absolute path using manifest path.
 * If the URL paths are absolute, return them.
 */
export function getAbsoluteURL(manifestURL: string, newSegment: string) {
  if (newSegment.startsWith('http')) return newSegment
  const manifestURLSegments = manifestURL.split('/')
  manifestURLSegments.pop()
  manifestURLSegments.push(newSegment)
  return manifestURLSegments.join('/')
}

export const getGeometryURL = (
  manifest: V2Schema,
  manifestPath: string,
  currentGeometryTarget: string,
  frameNo: number
) => {
  const geometryTargets = manifest.geometry.targets
  const targetData = geometryTargets[currentGeometryTarget]
  let path = manifest.geometry.path
  const padWidth = countHashChar(path)
  const TEMPLATE_MAP = {
    '[target]': currentGeometryTarget,
    '[ext]': FORMATS_TO_EXT[targetData.format]
  }
  TEMPLATE_MAP[`[${'#'.repeat(padWidth)}]`] = pad(frameNo, padWidth)
  Object.keys(TEMPLATE_MAP).forEach((key) => {
    path = path.replace(key, TEMPLATE_MAP[key])
  })
  return getAbsoluteURL(manifestPath, path)
}

export const getTextureURL = (
  manifest: V2Schema,
  manifestPath: string,
  textureType: TextureType,
  textureTag: string,
  textureTarget: string,
  frameNo: number
) => {
  const targetData = manifest.texture[textureType].targets[textureTarget]
  let path = manifest.texture.path
  const padWidth = countHashChar(path)
  const TEMPLATE_MAP = {
    '[target]': textureTarget,
    '[type]': textureType as string,
    '[tag]': textureTag,
    '[ext]': FORMATS_TO_EXT[targetData.format]
  }
  TEMPLATE_MAP[`[${'#'.repeat(padWidth)}]`] = pad(frameNo, padWidth)

  Object.keys(TEMPLATE_MAP).forEach((key) => {
    path = path.replace(key, TEMPLATE_MAP[key])
  })
  return getAbsoluteURL(manifestPath, path)
}

export const calculateGeometryFrame = (manifest: V2Schema, gTarget: string, currentTime: number) => {
  const targetData = manifest.geometry.targets[gTarget]
  const frameRate = targetData.frameRate
  return Math.round(currentTime * frameRate)
}

export const GeometryFrameCount = (manifest: V2Schema, gTarget: string) => {
  const targetData = manifest.geometry.targets[gTarget]
  return targetData.frameCount ?? 0
}

/* All tags have same frame number. So it's not needed */
export const calculateTextureFrame = (
  manifest: V2Schema,
  textureType: TextureType,
  tTarget: string,
  currentTime: number
) => {
  const targetData = manifest.texture[textureType].targets[tTarget]
  const frameRate = targetData.frameRate
  return Math.round(currentTime * frameRate)
}

/**
 * Only consider 'baseColor' for frameCount.
 * Others are not as important as 'baseColor'.
 */
export const TextureFrameCount = (manifest: V2Schema, textureType: TextureType = 'baseColor', tTarget: string) => {
  const targetData = manifest.texture.baseColor.targets[tTarget]
  return targetData.frameCount ?? 0
}

const decodeDRACO = (loader: DRACOLoader, geometryURL: string): Promise<BufferGeometry> => {
  return new Promise((resolve, reject) => {
    loader.load(geometryURL, (geometry) => {
      resolve(geometry)
    })
  })
}

const decodeGLB = (loader: GLTFLoader, geometryURL: string): Promise<BufferGeometry> => {
  return new Promise((resolve, reject) => {
    loader.load(geometryURL, (gltf) => {
      gltf.scene.traverse((node) => {
        if ('isMesh' in node) {
          // @ts-ignore
          if (node.material && 'map' in node.material) {
            // @ts-ignore
            if ('map' in node.material) {
              // @ts-ignore
              node.material.map.dispose()
            }
            // @ts-ignore
          } else if (node.material) {
            // @ts-ignore
            node.material.dispose()
          }
          // @ts-ignore
          resolve(node.geometry as BufferGeometry)
        }
      })
    })
  })
}

export const decodeGeometry = async (
  dracoLoader: DRACOLoader,
  gltfLoader: GLTFLoader,
  format: GeometryFormat,
  geometryURL: string
) => {
  if (format == 'glb') {
    return decodeGLB(gltfLoader, geometryURL)
  } else if (format == 'draco') {
    return decodeDRACO(dracoLoader, geometryURL)
  }
}

const decodeKTX2 = (loader: KTX2Loader, textureURL: string): Promise<CompressedTexture> => {
  return new Promise((resolve, reject) => {
    loader.load(textureURL, (texture) => {
      texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
      resolve(texture)
    })
  })
}

const decodeASTC = (
  loader: KTXLoader,
  textureURL: string,
  astcFormat: CompressedPixelFormat
): Promise<CompressedTexture> => {
  return new Promise((resolve, reject) => {
    loader.load(textureURL, (texture) => {
      texture.colorSpace = SRGBColorSpace
      texture.format = astcFormat
      resolve(texture)
    })
  })
}

export const decodeTexture = async (
  ktx2Loader: KTX2Loader,
  ktxLoader: KTXLoader,
  format: TextureFormat,
  textureURL: string,
  astcFormat?: CompressedPixelFormat
) => {
  if (format == 'ktx2') {
    return decodeKTX2(ktx2Loader, textureURL)
  } else if (format == 'astc/ktx') {
    return decodeASTC(ktxLoader, textureURL, astcFormat)
  }
}

export const updateGeometry = (mesh: Mesh, geometry: BufferGeometry) => {
  if (mesh.geometry.uuid != geometry.uuid) {
    mesh.geometry = geometry
    mesh.geometry.attributes.position.needsUpdate = true
  }
}

export const updateTexture = (mesh: Mesh, texture: Texture, meshMaterial: Material, failMaterial: Material) => {
  /* Check if mesh.material is failMaterial.
   * If yes, set it to meshMaterial first and mark it to update material later.
   */
  let isMeshChanged = false
  if ((mesh.material as Material).uuid == failMaterial.uuid) {
    mesh.material = meshMaterial
    isMeshChanged = true
  }

  if (
    (mesh.material as MeshBasicMaterial).map == null ||
    (mesh.material as MeshBasicMaterial).map.uuid != texture.uuid
  ) {
    ;(mesh.material as MeshBasicMaterial).map = texture
    ;(mesh.material as MeshBasicMaterial).map.needsUpdate = true
    if (!isMeshChanged) {
      ;(mesh.material as MeshBasicMaterial).needsUpdate = true
    }
  }
}
