import {diffWordsWithSpace, type ChangeObject} from 'diff'

// Diff presentation only. Never use this projection to reconcile or save HTML.
export function diffText(saved: string, mine: string) {
  if (saved === mine)
    return {
      changes: [{value: saved, added: false, removed: false}],
      coarse: false,
    }
  const changes =
    saved.length + mine.length <= 100000
      ? diffWordsWithSpace(saved, mine, {timeout: 50, maxEditLength: 1000})
      : undefined
  return {
    changes:
      changes ??
      ([
        {value: saved, removed: true, added: false},
        {value: mine, added: true, removed: false},
      ] satisfies Partial<ChangeObject<string>>[]),
    coarse: !changes,
  }
}

// Called only from the client-side Show changes view. A detached document
// decodes entities without ever mounting authored HTML in the page.
export function diffDocument(html: string | null) {
  const document = new DOMParser().parseFromString(html ?? '', 'text/html')
  document.querySelectorAll('script, style').forEach((node) => node.remove())
  const blocks = new Set([
    'P',
    'DIV',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'UL',
    'OL',
    'BLOCKQUOTE',
    'PRE',
    'HR',
  ])
  const text = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? ''
    if (node.nodeType !== 1) return ''
    const element = node as Element
    if (element.tagName === 'BR') return '\n'
    const value = Array.from(node.childNodes, text).join('')
    return blocks.has(element.tagName) ? `\n${value}\n` : value
  }
  const structure = (element: Element): unknown[] => [
    element.tagName,
    Array.from(element.attributes, ({name, value}) => [name, value]).sort(),
    Array.from(element.children, structure),
  ]
  return {
    text: Array.from(document.body.childNodes, text)
      .join('')
      .replace(/^\n|\n$/g, ''),
    structure: JSON.stringify(structure(document.body)),
  }
}
