import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThemeMode } from '../lib/theme'

type CustomProfileContentProps = {
  content: string
  className?: string
  framed?: boolean
  autoHeight?: boolean
}

const shellCSS = `
  :root {
    color-scheme: light;
    --paper: #f7f8fa;
    --surface: #ffffff;
    --ink: #1d2939;
    --graphite: #667085;
    --rail: #e4e7ec;
    --signal: #1677ff;
    --moss: #2e8b57;
    --amber: #d97706;
    --clay: #d14343;
  }

  :root[data-theme='dark'] {
    color-scheme: dark;
    --paper: #17191d;
    --surface: #272b31;
    --ink: #f3f4f6;
    --graphite: #a7afba;
    --rail: #3a4048;
    --signal: #2d68d5;
    --moss: #55b77a;
    --amber: #f0aa3d;
    --clay: #f27676;
  }

  * { box-sizing: border-box; }

  html, body {
    min-width: 320px;
    margin: 0;
    background: transparent;
    color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  body {
    padding: 0;
    scrollbar-color: rgba(145, 160, 184, 0.78) transparent;
  }

  body.profile-auto {
    overflow: hidden;
  }

  body.profile-scroll {
    overflow: auto;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: rgba(145, 160, 184, 0.72);
    background-clip: content-box;
  }

  a {
    color: var(--signal);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--signal), transparent 68%);
    text-underline-offset: 3px;
  }

  img {
    max-width: 100%;
    border: 1px solid var(--rail);
    border-radius: 8px;
  }

  h1, h2, h3, p {
    margin: 0;
  }

  h1 {
    font-size: clamp(30px, 5vw, 56px);
    line-height: 1.02;
    letter-spacing: 0;
  }

  h2 {
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid var(--rail);
    font-size: 22px;
    line-height: 1.2;
  }

  h3 {
    margin-top: 18px;
    font-size: 16px;
    line-height: 1.4;
  }

  p, li {
    color: var(--graphite);
    font-size: 14px;
    line-height: 1.75;
  }

  ul, ol {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding-left: 20px;
  }

  blockquote {
    margin: 16px 0 0;
    padding-left: 14px;
    border-left: 2px solid color-mix(in srgb, var(--signal), transparent 45%);
    color: var(--graphite);
    font-style: italic;
  }

  table {
    width: 100%;
    margin-top: 14px;
    border-collapse: collapse;
    font-size: 14px;
  }

  th, td {
    border: 1px solid var(--rail);
    padding: 10px 12px;
    text-align: left;
  }

  th {
    background: color-mix(in srgb, var(--paper), white 45%);
    color: var(--ink);
  }

  td {
    color: var(--graphite);
  }

  code, pre {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  code {
    border-radius: 6px;
    background: color-mix(in srgb, var(--rail), transparent 45%);
    padding: 2px 6px;
    color: inherit;
    font-size: 0.9em;
  }

  pre {
    overflow-x: auto;
    margin: 14px 0 0;
    border-radius: 8px;
    background: #1d2939;
    padding: 16px;
    color: white;
    font-size: 12px;
    line-height: 1.7;
  }

  .custom-profile-root {
    min-height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`

const minimumAutoHeight = 720

function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function buildProfileDocument(content: string, autoHeight: boolean, theme: ThemeMode) {
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
    <style>${shellCSS}</style>
  </head>
  <body class="${autoHeight ? 'profile-auto' : 'profile-scroll'}">
    <main class="custom-profile-root">${content}</main>
  </body>
</html>`
}

export function CustomProfileContent({ content, className = '', framed = true, autoHeight = true }: CustomProfileContentProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [height, setHeight] = useState(minimumAutoHeight)
  const [theme, setTheme] = useState<ThemeMode>(() => currentTheme())
  const srcDoc = useMemo(() => buildProfileDocument(content, autoHeight, theme), [autoHeight, content, theme])
  const frameClassName = autoHeight ? className : className || 'min-h-[720px]'
  const frameStyleClassName = framed ? 'rounded-md border border-rail bg-paper' : 'border-0 bg-transparent'
  const syncHeight = useCallback(() => {
    if (!autoHeight) return
    const documentElement = iframeRef.current?.contentDocument?.documentElement
    const body = iframeRef.current?.contentDocument?.body
    if (!documentElement || !body) return
    const nextHeight = Math.max(
      minimumAutoHeight,
      documentElement.scrollHeight,
      body.scrollHeight,
      documentElement.offsetHeight,
      body.offsetHeight,
    )
    setHeight(nextHeight)
  }, [autoHeight])

  useEffect(() => {
    if (!autoHeight) return undefined
    const frame = iframeRef.current
    if (!frame) return undefined

    const cleanup = () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    const scheduleSync = () => {
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = window.requestAnimationFrame(syncHeight)
    }

    const attachObserver = () => {
      cleanup()
      const documentElement = frame.contentDocument?.documentElement
      const body = frame.contentDocument?.body
      if (!documentElement || !body) return
      const observer = new ResizeObserver(scheduleSync)
      observer.observe(documentElement)
      observer.observe(body)
      resizeObserverRef.current = observer
      scheduleSync()
    }

    setHeight(minimumAutoHeight)
    frame.addEventListener('load', attachObserver)
    attachObserver()

    return () => {
      frame.removeEventListener('load', attachObserver)
      cleanup()
    }
  }, [autoHeight, srcDoc, syncHeight])

  useEffect(() => {
    const updateTheme = () => setTheme(currentTheme())
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('exec-graph-theme-change', updateTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('exec-graph-theme-change', updateTheme)
    }
  }, [])

  return (
    <iframe
      ref={iframeRef}
      className={`w-full ${frameStyleClassName} ${frameClassName}`}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      scrolling={autoHeight ? 'no' : undefined}
      style={autoHeight ? { height } : undefined}
      title="自定义个人页"
      referrerPolicy="no-referrer"
    />
  )
}
