import { describe, expect, test } from 'bun:test'
import { getCropLayout, moveCropPosition, zoomCropPosition } from './image-crop.ts'
import { dataUrlToFile, renderCroppedImage, renderRectangularCroppedImage, renderScaledImage } from './image.ts'

describe('image crop geometry', () => {
  test('fills a banner with portrait and landscape images without empty edges', () => {
    const viewport = { width: 640, height: 128 }
    for (const image of [{ width: 600, height: 1200 }, { width: 3200, height: 400 }]) {
      for (const position of [{ x: -1, y: -1 }, { x: .5, y: .5 }, { x: 2, y: 2 }]) {
        const layout = getCropLayout(image, viewport, 1, position)
        expect(layout.offsetX).toBeLessThanOrEqual(0)
        expect(layout.offsetY).toBeLessThanOrEqual(0)
        expect(layout.offsetX + layout.width).toBeGreaterThanOrEqual(viewport.width)
        expect(layout.offsetY + layout.height).toBeGreaterThanOrEqual(viewport.height)
      }
    }
  })

  test('bounds dragging and keeps a fitted axis centered', () => {
    const layout = getCropLayout({ width: 1000, height: 1000 }, { width: 640, height: 128 }, 1, { x: .5, y: .5 })
    expect(moveCropPosition(layout, { x: .5, y: .5 }, { x: 9999, y: 9999 })).toEqual({ x: .5, y: 0 })
    expect(moveCropPosition(layout, { x: .5, y: .5 }, { x: -9999, y: -9999 })).toEqual({ x: .5, y: 1 })
  })

  test('keeps the same source point under the center while zooming', () => {
    const image = { width: 1200, height: 800 }
    const viewport = { width: 640, height: 128 }
    const position = { x: .5, y: .3 }
    const before = getCropLayout(image, viewport, 1, position)
    const nextPosition = zoomCropPosition(image, viewport, 1, 2, position)
    const after = getCropLayout(image, viewport, 2, nextPosition)
    expect((viewport.width / 2 - before.offsetX) / before.scale).toBeCloseTo((viewport.width / 2 - after.offsetX) / after.scale)
    expect((viewport.height / 2 - before.offsetY) / before.scale).toBeCloseTo((viewport.height / 2 - after.offsetY) / after.scale)
  })

  test('keeps the same source crop when the dialog width changes', () => {
    const image = { width: 2000, height: 1000 }
    const position = { x: .7, y: .2 }
    const large = getCropLayout(image, { width: 640, height: 128 }, 2, position)
    const small = getCropLayout(image, { width: 320, height: 64 }, 2, position)
    expect(large.offsetX / large.scale).toBeCloseTo(small.offsetX / small.scale)
    expect(large.offsetY / large.scale).toBeCloseTo(small.offsetY / small.scale)
  })
})

describe('uncropped image compression', () => {
  test('preserves the full image aspect ratio and never upscales', () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const calls = []
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage: (...args) => calls.push(args) }),
      toDataURL: (mime, quality) => `${mime};quality=${quality}`,
    }
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } })
    try {
      const large = { naturalWidth: 2000, naturalHeight: 1000 }
      expect(renderScaledImage(large, { maxWidth: 1600, maxHeight: 1600, quality: .78 })).toBe('image/jpeg;quality=0.78')
      expect([canvas.width, canvas.height]).toEqual([1600, 800])
      expect(calls[0]).toEqual([large, 0, 0, 2000, 1000, 0, 0, 1600, 800])
      const small = { naturalWidth: 800, naturalHeight: 600 }
      renderScaledImage(small, { maxWidth: 1600, maxHeight: 1600, quality: .88 })
      expect([canvas.width, canvas.height]).toEqual([800, 600])
    } finally {
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
      else Reflect.deleteProperty(globalThis, 'document')
    }
  })
})

describe('cropped image upload conversion', () => {
  test('turns a compressed data URL into an uploadable file', async () => {
    const file = dataUrlToFile('data:image/jpeg;base64,aGVsbG8=', 'action-image.jpg')
    expect(file.name).toBe('action-image.jpg')
    expect(file.type).toBe('image/jpeg')
    expect(await file.text()).toBe('hello')
  })
})

describe('cropped image export', () => {
  test('exports the selected source rectangle and compresses without upscaling small images', () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const calls = []
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage: (...args) => calls.push(args) }),
      toDataURL: (mime, quality) => `${mime};quality=${quality}`,
    }
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } })
    try {
      const image = { naturalWidth: 1200, naturalHeight: 2000 }
      const encoded = renderRectangularCroppedImage(image, { viewportWidth: 600, viewportHeight: 120, offsetX: 0, offsetY: -440, renderScale: .5 }, { outputWidth: 1600, outputHeight: 320, quality: .78 })
      expect(encoded).toBe('image/jpeg;quality=0.78')
      expect([canvas.width, canvas.height]).toEqual([1200, 240])
      expect(calls[0]).toEqual([image, 0, 880, 1200, 240, 0, 0, 1200, 240])
      renderCroppedImage(image, { viewportSize: 280, offsetX: 0, offsetY: 0, renderScale: .25 }, { outputSize: 512, quality: .9 })
      expect([canvas.width, canvas.height]).toEqual([512, 512])
    } finally {
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
      else Reflect.deleteProperty(globalThis, 'document')
    }
  })
})
