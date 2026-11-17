const KEYWORDS = new Set([
  '类',
  '方法',
  '常量',
  '变量',
  '参数',
  '如果',
  '否则',
  '循环',
  '返回',
  '公开',
  '私有',
  '保护',
  '静态',
  '参考',
  '折叠',
  '通常',
  '类型',
  '值',
  '注释',
  '默认值',
  '基础类',
  '类别',
])

const BOOLS = new Set(['真', '假'])

const TYPES = new Set([
  '整数',
  '长整数',
  '小数',
  '文本型',
  '逻辑型',
  '字节集类',
  '变整数',
  '字节',
  '字符',
  '日期时间',
  '短整数',
  '单精度小数',
  '双精度小数',
  '整数数组',
  '文本型数组',
])

const CS = {
  keyword: 'vc-hk',
  type: 'vc-hy',
  string: 'vc-hs',
  number: 'vc-hn',
  comment: 'vc-hc',
  func: 'vc-hf',
  defName: 'vc-hd',
  macro: 'vc-he',
  text: 'vc-hx',
  bool: 'vc-hb',
  array: 'vc-ha',
  paren: 'vc-hp',
  bracket: 'vc-hq',
  brace: 'vc-hg',
  comma: 'vc-hm',
  dot: 'vc-ho',
  op: 'vc-hv',
} as const

const PUNCT: Record<string, string> = {
  '(': CS.paren,
  ')': CS.paren,
  '[': CS.bracket,
  ']': CS.bracket,
  '{': CS.brace,
  '}': CS.brace,
  ',': CS.comma,
  '.': CS.dot,
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

export function escapeHtml(text: string): string {
  return (text ?? '').replace(/[&<>"]/g, (ch) => ESCAPES[ch] ?? ch)
}

function nextChar(text: string, from: number): string {
  for (let i = from; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code !== 32 && code !== 9) {
      return text[i] ?? ''
    }
  }
  return ''
}

function paint(cls: string, text: string): string {
  return `<span class="${cls}">${escapeHtml(text)}</span>`
}

const LINE_CACHE = new Map<string, string>()
const LINE_CACHE_MAX = 4096

export function highlightLine(line: string): string {
  if (!line || !line.trim()) {
    return ''
  }
  const hit = LINE_CACHE.get(line)
  if (hit !== undefined) {
    return hit
  }
  const html = renderLine(line)
  if (LINE_CACHE.size >= LINE_CACHE_MAX) {
    LINE_CACHE.clear()
  }
  LINE_CACHE.set(line, html)
  return html
}

function renderLine(line: string): string {
  if (line.trimStart().startsWith('@')) {
    return paint(CS.macro, line)
  }

  const tokens: string[] = []
  const stash = (cls: string, text: string): string => {
    const index = tokens.length
    tokens.push(paint(cls, text))
    return String.fromCharCode(0xe000 + index)
  }

  let rest = line.replace(/"(?:[^"\\]|\\.)*"|“(?:[^”\\]|\\.)*”|'(?:[^'\\]|\\.)*'/g, (match) =>
    stash(CS.string, match),
  )

  let comment = ''
  const commentIndex = rest.indexOf('//')
  if (commentIndex >= 0) {
    comment = rest.slice(commentIndex)
    rest = rest.slice(0, commentIndex)
  }

  rest = rest.replace(/\b\d+(?:\.\d+)?\b/g, (match) => stash(CS.number, match))

  rest = rest.replace(
    /(^|[\s(（])(类|方法|变量|常量|参数)(\s+)([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)/g,
    (_match, lead: string, keyword: string, space: string, name: string) =>
      lead + stash(CS.keyword, keyword) + space + stash(CS.defName, name),
  )

  rest = rest.replace(
    /[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_.]*/g,
    (match, offset: number) => {
      if (KEYWORDS.has(match)) {
        return stash(CS.keyword, match)
      }
      if (TYPES.has(match)) {
        return stash(CS.type, match)
      }
      if (BOOLS.has(match)) {
        return stash(CS.bool, match)
      }
      const dot = match.lastIndexOf('.')
      const head = dot >= 0 ? match.slice(0, dot + 1) : ''
      const tail = dot >= 0 ? match.slice(dot + 1) : match
      if (tail) {
        const next = nextChar(rest, offset + match.length)
        if (next === '(' || next === '（') {
          return head + stash(CS.func, tail)
        }
        if (next === '[') {
          return head + stash(CS.array, tail)
        }
      }
      return match
    },
  )

  rest = rest.replace(/[()[\]{},.]/g, (match) => stash(PUNCT[match] ?? CS.text, match))
  rest = rest.replace(/(==|!=|<>|<=|>=|\|\||&&|[=+\-*/%<>])/g, (match) =>
    stash(CS.op, match),
  )

  let html = rest.replace(/[&<>"]|[\ue000-\uf8ff]/g, (ch) => {
    const code = ch.charCodeAt(0)
    if (code >= 0xe000) {
      return tokens[code - 0xe000] ?? ''
    }
    return ESCAPES[ch] ?? ch
  })

  if (comment) {
    html += paint(CS.comment, comment)
  }
  return html
}


