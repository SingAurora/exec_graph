import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { defaultUrlTransform } from 'react-markdown'
import type { PostImage } from '../model/content'

/** Extracts actual Markdown images in document order, including references and intentional repeats. */
export function getMarkdownImages(markdown: string): PostImage[] {
  const tree = fromMarkdown(markdown)
  const definitions = new Map<string, string>()
  const images: PostImage[] = []
  const normalize = (identifier: string) => identifier.trim().replace(/\s+/g, ' ').toLowerCase()
  function visitDefinitions(node: Nodes) {
    if (node.type === 'definition' && !definitions.has(normalize(node.identifier))) {
      definitions.set(normalize(node.identifier), node.url)
    }
    if ('children' in node) node.children.forEach(visitDefinitions)
  }
  function visitImages(node: Nodes) {
    const url = node.type === 'image' ? node.url
      : node.type === 'imageReference' ? definitions.get(normalize(node.identifier)) : undefined
    if (url && (node.type === 'image' || node.type === 'imageReference')) {
      const renderedUrl = defaultUrlTransform(url)
      if (renderedUrl) images.push({ url: renderedUrl, alt: node.alt?.trim() || '文档图片' })
    }
    if ('children' in node) node.children.forEach(visitImages)
  }
  visitDefinitions(tree)
  visitImages(tree)
  return images
}

/** Keeps inline image positions and appends legacy attachments not already embedded. */
export function remarkDocumentImages({ images }: { images: PostImage[] }) {
  return (tree: Root) => {
    const embedded = new Set<string>()
    const definitions = new Map<string, string>()
    const references = new Set<string>()
    const normalize = (identifier: string) => identifier.trim().replace(/\s+/g, ' ').toLowerCase()
    function visit(node: Nodes) {
      if (node.type === 'image') embedded.add(node.url)
      if (node.type === 'definition') definitions.set(normalize(node.identifier), node.url)
      if (node.type === 'imageReference') references.add(normalize(node.identifier))
      if ('children' in node) node.children.forEach(visit)
    }
    visit(tree)
    for (const identifier of references) {
      const url = definitions.get(identifier)
      if (url) embedded.add(url)
    }
    for (const image of images) {
      if (!embedded.has(image.url)) tree.children.push({
        type: 'paragraph', children: [{ type: 'image', url: image.url, alt: image.alt }],
      })
    }
  }
}
