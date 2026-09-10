import { html } from '@codemirror/lang-html'
import { Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { Code2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ThemeMode } from '../lib/theme'

type CursorPosition = {
  line: number
  column: number
}

type CustomProfileCodeEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const baseTheme = EditorView.theme({
  '&': {
    border: '1px solid rgb(var(--color-rail))',
    borderRadius: '0 0 6px 6px',
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    minHeight: '520px',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.7',
  },
  '.cm-content': {
    padding: '14px 0',
  },
  '.cm-line': {
    padding: '0 14px',
  },
  '.cm-gutters': {
    borderRight: '1px solid rgb(var(--color-rail))',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '38px',
    padding: '0 10px 0 8px',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '12px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgb(var(--color-signal) / 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgb(var(--color-signal) / 0.12)',
    color: 'rgb(var(--color-signal))',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgb(var(--color-signal) / 0.22) !important',
  },
})

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'rgb(var(--color-paper))',
    color: 'rgb(var(--color-ink))',
  },
  '.cm-gutters': {
    backgroundColor: 'rgb(var(--color-shell))',
    color: 'rgb(var(--color-graphite))',
  },
  '.cm-content': {
    caretColor: 'rgb(var(--color-signal))',
  },
}, { dark: false })

function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function lineCount(value: string) {
  return value.length === 0 ? 1 : value.split('\n').length
}

export function CustomProfileCodeEditor({ value, onChange, placeholder }: CustomProfileCodeEditorProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => currentTheme())
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
  const extensions = useMemo<Extension[]>(() => [baseTheme, html({ matchClosingTags: true, autoCloseTags: true })], [])
  const editorTheme = theme === 'dark' ? oneDark : lightTheme

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
    <div className="overflow-hidden rounded-md bg-paper">
      <div className="flex h-10 items-center justify-between gap-3 rounded-t-md border border-b-0 border-rail bg-shell px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <Code2 size={15} className="text-signal" aria-hidden="true" />
          HTML / CSS
        </div>
        <div className="shrink-0 font-mono text-xs text-graphite">
          {lineCount(value)} 行 · 第 {cursor.line} 行，第 {cursor.column} 列
        </div>
      </div>
      <CodeMirror
        value={value}
        height="520px"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          searchKeymap: true,
        }}
        extensions={extensions}
        theme={editorTheme}
        placeholder={placeholder}
        onChange={onChange}
        onUpdate={(update) => {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          setCursor({ line: line.number, column: head - line.from + 1 })
        }}
      />
    </div>
  )
}
