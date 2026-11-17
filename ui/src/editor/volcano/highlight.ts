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

/** 逻辑值立即数（DRC_T_BOOL_IMM） */
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

/**
 * token 的着色类名。颜色本身写在 render.ts 的 `<style>`（TOKEN_CSS）里，
 * 走同一套 CSS 变量，换主题仍然只改变量即可。
 *
 * <p>为什么不用内联 `style="color:…"`：一个 token 的内联写法是
 * `<span style="color:var(--vc-accent, #569CD6)">`，光开标签就 44 字节；
 * 一行代码动辄十几个 token，快照体积会膨胀到源码的 10 倍。改成类名后
 * 开标签只有 21 字节，同样的高亮效果、快照体积少四成左右。</p>
 */
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

/** 把一行火山文本渲染成带颜色的 HTML；颜色由块内 `<style>` 提供。 */
export function highlightLine(line: string): string {
  if (!line || !line.trim()) {
    return ''
  }
  // 行首 @ 开头是嵌入的 C 代码
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

  // 声明名：类/方法/变量/常量/参数 后面的那个名字用「元素定义名」色，和火山 IDE 一致。
  // 必须在关键字替换之前做，否则关键字已经被替换成占位符就匹配不到了。
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

  // 数组名：后面紧跟中括号的标识符
  rest = rest.replace(/([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)(?=\s*\[)/g, (match) =>
    stash(CS.array, match),
  )

  // 标点与括号（火山里小/中/花括号、逗号、点、操作符都是独立配色的）
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

/** 表格单元格里用的纯文本着色（不做关键字切分，避免把中文注释误判）。 */
export function plainText(text: string, cls: string = CS.text): string {
  return paint(cls, text)
}
