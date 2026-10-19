import type { Nodes, Root } from 'mdast'
import type { PostImage } from '../model'

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
