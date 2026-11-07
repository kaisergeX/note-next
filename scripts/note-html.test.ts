import assert from 'node:assert/strict'
import {test} from 'node:test'
import {sanitizeNoteHtml} from '../lib/notes/html'

test('preserves the editor formatting and Vietnamese text', () => {
  const html =
    '<h1>Ý tưởng</h1><h2>Hai</h2><h3>Ba</h3><h4>Bốn</h4><h5>Năm</h5><h6>Sáu</h6>' +
    '<p><strong>đậm</strong><em>nghiêng</em><u>gạch</u><s>xóa</s><mark>sáng</mark><br></p>' +
    '<blockquote><p>Trích dẫn</p></blockquote><ul><li><p>một</p></li></ul>' +
    '<ol start="3"><li><p>ba</p></li></ol><pre><code class="language-js">a &lt; b</code></pre><hr>'
  assert.equal(
    sanitizeNoteHtml(html),
    html.replaceAll('<br>', '<br />').replaceAll('<hr>', '<hr />'),
  )
})

test('removes active elements, handlers, CSS, URL attributes and DOM clobbering', () => {
  const html =
    '<p id="location" name="cookie" onclick="alert(1)" style="background:url(https://example.invalid)">keep</p>' +
    '<script>alert(1)</script><style>body{display:none}</style>' +
    '<img src="x" onerror="alert(1)"><iframe srcdoc="<script>alert(1)</script>"></iframe>' +
    '<object data="x"></object><embed src="x"><form action="x"><input autofocus onfocus="alert(1)"></form>' +
    '<a href="jav&#x61;script:alert(1)">label</a>' +
    '<mark data-color="red" style="position:fixed">highlight</mark>'
  assert.equal(sanitizeNoteHtml(html), '<p>keep</p>label<mark>highlight</mark>')
})

test('strips SVG, MathML and malformed mutation-XSS payloads', () => {
  for (const html of [
    '<svg><a xlink:href="javascript:alert(1)"><text>text</text></a><animate onbegin="alert(1)"></animate></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
    '<svg><style><img src=x onerror=alert(1)></style></svg>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    '<p onpointerenter=alert(1)>safe</p><IMG SRC=javascript:alert(1)>',
  ]) {
    const clean = sanitizeNoteHtml(html)
    assert.doesNotMatch(
      clean,
      /<(?:svg|math|img|script|style|iframe|noscript)\b|<[^>]*\bon\w+\s*=/i,
    )
    assert.equal(sanitizeNoteHtml(clean), clean)
  }
})

test('only permits ordered-list starts and code language classes', () => {
  assert.equal(
    sanitizeNoteHtml(
      '<ol start="2" reversed class="fixed"><li value="4">item</li></ol><code class="language-ts fixed" style="color:red">code</code>',
    ),
    '<ol start="2"><li>item</li></ol><code class="language-ts">code</code>',
  )
})

test('handles null, empty content, entities and escaped HTML as text', () => {
  assert.equal(sanitizeNoteHtml(null), '')
  assert.equal(sanitizeNoteHtml(''), '')
  assert.equal(
    sanitizeNoteHtml(
      '<p>&lt;img src=x onerror=alert(1)&gt; &amp; Xin chào</p>',
    ),
    '<p>&lt;img src=x onerror=alert(1)&gt; &amp; Xin chào</p>',
  )
})
