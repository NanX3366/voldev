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

export function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paint(cls: string, text: string): string {
  return `<span class="${cls}">${escapeHtml(text)}</span>`
}

export function highlightLine(line: string): string {
  if (!line || !line.trim()) {
    return ''
  }

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

  rest = rest.replace(/[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_.]*/g, (match) => {
    if (KEYWORDS.has(match)) {
      return stash(CS.keyword, match)
    }
    if (TYPES.has(match)) {
      return stash(CS.type, match)
    }
    if (BOOLS.has(match)) {
      return stash(CS.bool, match)
    }
    return match
  })

  rest = rest.replace(/([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)(?=\s*[（(])/g, (match) =>
    stash(CS.func, match),
  )

  rest = rest.replace(/([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)(?=\s*\[)/g, (match) =>
    stash(CS.array, match),
  )

  rest = rest.replace(/[()]/g, (match) => stash(CS.paren, match))
  rest = rest.replace(/[[\]]/g, (match) => stash(CS.bracket, match))
  rest = rest.replace(/[{}]/g, (match) => stash(CS.brace, match))
  rest = rest.replace(/,/g, (match) => stash(CS.comma, match))
  rest = rest.replace(/\./g, (match) => stash(CS.dot, match))
  rest = rest.replace(/(==|!=|<>|<=|>=|\|\||&&)/g, (match) => stash(CS.op, match))
  rest = rest.replace(/([=+\-*/%<>])/g, (match) => stash(CS.op, match))

  let html = escapeHtml(rest).replace(/[\ue000-\uf8ff]/g, (marker) => {
    const index = marker.charCodeAt(0) - 0xe000
    return tokens[index] ?? ''
  })

  if (comment) {
    html += paint(CS.comment, comment)
  }
  return html
}

export function plainText(text: string, cls: string = CS.text): string {
  return paint(cls, text)
}
