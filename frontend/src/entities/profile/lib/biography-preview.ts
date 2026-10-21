import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'
import { getMarkdownImages } from '../../../shared/lib/document-images'

/** Keeps the first text paragraph and image for a compact biography without exposing Markdown syntax. */
export function getBiographyPreview(markdown: string) {
  const tree = fromMarkdown(markdown)
  const images = getMarkdownImages(markdown).slice(0, 1)
  function hasText(node: Nodes): boolean {
    if (node.type === 'text' || node.type === 'inlineCode') return Boolean(node.value.trim())
    return 'children' in node && node.children.some(hasText)
  }
  function firstParagraph(node: Nodes): Nodes | undefined {
    if ((node.type === 'paragraph' || node.type === 'heading') && hasText(node)) return node
    if ('children' in node) return node.children.map(firstParagraph).find(Boolean)
  }
  const paragraph = firstParagraph(tree)
  if (!paragraph?.position) return { markdown: '', images }

  const start = paragraph.position.start.offset ?? 0
  let text = markdown.slice(start, paragraph.position.end.offset)
  const imageRanges: { start: number; end: number }[] = []
  function collectImages(node: Nodes) {
    if ((node.type === 'image' || node.type === 'imageReference') && node.position) {
      imageRanges.push({ start: (node.position.start.offset ?? start) - start, end: (node.position.end.offset ?? start) - start })
    }
    if ('children' in node) node.children.forEach(collectImages)
  }
  collectImages(paragraph)
  for (const range of imageRanges.reverse()) text = text.slice(0, range.start) + text.slice(range.end)
  const definitions = tree.children.filter((node) => node.type === 'definition')
    .map((node) => markdown.slice(node.position?.start.offset, node.position?.end.offset))
  return { markdown: [text, ...definitions].join('\n\n'), images }
}
