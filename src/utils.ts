import { WebGLRenderer } from 'three'

import { TextureFileFormat } from './Interfaces'

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

export function isTextureFormatSupported(renderer: WebGLRenderer, format: TextureFileFormat): boolean {
  if (format == 'ktx2' || format == 'mp4') {
    return true
  } else if (format == 'etc2') {
    return renderer.extensions.has('WEBGL_compressed_texture_etc')
  }
}
