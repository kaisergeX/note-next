import sanitizeHtml from 'sanitize-html'

// Display boundary for both saved HTML and browser recovery copies. Do not use
// this projection for persistence, reconciliation, or editor acknowledgements.
export function sanitizeNoteHtml(html: string | null): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'strike',
      'mark',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'br',
      'hr',
    ],
    allowedAttributes: {ol: ['start']},
    allowedClasses: {code: [/^language-[a-zA-Z0-9_-]+$/]},
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'iframe',
      'object',
      'svg',
      'math',
      'noscript',
      'template',
    ],
    // No styles are allowed; disable the Node-only CSS parser in browser builds.
    parseStyleAttributes: false,
  })
}
