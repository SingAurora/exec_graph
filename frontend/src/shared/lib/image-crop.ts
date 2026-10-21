export type ImageDimensions = { width: number; height: number }
export type CropPosition = { x: number; y: number }

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Fits and positions an image so the crop viewport never exposes an empty edge. */
export function getCropLayout(image: ImageDimensions, viewport: ImageDimensions, zoom: number, position: CropPosition) {
  const scale = Math.max(viewport.width / image.width, viewport.height / image.height) * Math.max(1, zoom)
  const width = image.width * scale
  const height = image.height * scale
  return {
    scale, width, height,
    overflowX: Math.max(0, width - viewport.width),
    overflowY: Math.max(0, height - viewport.height),
    offsetX: -Math.max(0, width - viewport.width) * clamp(position.x),
    offsetY: -Math.max(0, height - viewport.height) * clamp(position.y),
  }
}

/** Converts a drag distance to a bounded crop position independent of viewport size. */
export function moveCropPosition(layout: ReturnType<typeof getCropLayout>, origin: CropPosition, delta: CropPosition): CropPosition {
  return {
    x: layout.overflowX ? clamp(origin.x - delta.x / layout.overflowX) : .5,
    y: layout.overflowY ? clamp(origin.y - delta.y / layout.overflowY) : .5,
  }
}

/** Keeps the visible image center fixed while zooming, unless an image edge is reached. */
export function zoomCropPosition(image: ImageDimensions, viewport: ImageDimensions, zoom: number, nextZoom: number, position: CropPosition): CropPosition {
  const previous = getCropLayout(image, viewport, zoom, position)
  const next = getCropLayout(image, viewport, nextZoom, position)
  const offsetX = viewport.width / 2 - (viewport.width / 2 - previous.offsetX) * next.scale / previous.scale
  const offsetY = viewport.height / 2 - (viewport.height / 2 - previous.offsetY) * next.scale / previous.scale
  return {
    x: next.overflowX ? clamp(-offsetX / next.overflowX) : .5,
    y: next.overflowY ? clamp(-offsetY / next.overflowY) : .5,
  }
}
