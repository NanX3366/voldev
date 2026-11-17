import { escapeHtml, highlightLine } from './highlight'
import type {
  AttrValue,
  Attrs,
  VolcanoClass,
  VolcanoDecl,
  VolcanoMethod,
  MethodItem,
} from './parser'
import { parseVolcano } from './parser'

const FONT = "Consolas,'Cascadia Mono','Sarasa Mono SC',Menlo,'Microsoft YaHei Mono',monospace"

const C = {
  bg: 'var(--vc-bg, #1E1E1E)',
  headBg: 'var(--vc-head-bg, #333333)',
  border: 'var(--vc-border, #555555)',
  grid: 'var(--vc-grid, #4A4A4A)',
  text: 'var(--vc-text, #D4D4D4)',
  head: 'var(--vc-head, #C8C8C8)',

  headKey: 'var(--vc-head-key, #89D185)',
  name: 'var(--vc-name, #9CDCFE)',
  type: 'var(--vc-type, #4EC9B0)',
  value: 'var(--vc-value, #CE9178)',
  check: 'var(--vc-check, #4EC9B0)',
  remark: 'var(--vc-remark, #6A9955)',
  accent: 'var(--vc-accent, #569CD6)',
  guide: 'var(--vc-guide, #D16969)',

  scrollTrack: 'var(--vc-scroll-track, #1E1E1E)',
  scrollThumb: 'var(--vc-scroll-thumb, #424242)',
  scrollThumbHover: 'var(--vc-scroll-thumb-hover, #5A5A5A)',

  attrName: 'var(--vc-attr-name, #C8C8C8)',
  attrValue: 'var(--vc-attr-value, #CE9178)',

  methodCat: 'var(--vc-method-cat, #4EC9B0)',

  num: 'var(--vc-num, #B5CEA8)',
  func: 'var(--vc-func, #DCDCAA)',
  embed: 'var(--vc-embed, #CE9178)',
  bool: 'var(--vc-bool, #569CD6)',
  array: 'var(--vc-array, #9CDCFE)',
  paren: 'var(--vc-paren, #FFD700)',
  bracket: 'var(--vc-bracket, #DA70D6)',
  brace: 'var(--vc-brace, #179FFF)',
  comma: 'var(--vc-comma, #D4D4D4)',
  dot: 'var(--vc-dot, #D4D4D4)',
  op: 'var(--vc-op, #D4D4D4)',

  headBgEventDecl: 'var(--vc-head-bg-event-decl, #3A2A2A)',
  headBgEventRecv: 'var(--vc-head-bg-event-recv, #24363A)',
  headBgPropGet: 'var(--vc-head-bg-prop-get, #2A2A3A)',
  headBgPropSet: 'var(--vc-head-bg-prop-set, #243A2A)',
}

const BLOCK_INDENT = 22
const CODE_STEP = 22
const CODE_BASE = 14

const LINE_NO_WIDTH = 38

const GUTTER = 56

const RAIL = 16

const RAIL_GAP = 2

const TOGGLE_JS =
  "var s=this.parentNode,c=s.getAttribute('data-c')==='1';" +
  "s.setAttribute('data-c',c?'0':'1');this.textContent=c?'\u2212':'+'"

const SECTION_CSS = `
.volcano-ide .vc-body .vc-sec{position:relative}
.volcano-ide .vc-body .vc-sec[data-c="1"]>.vc-sec-b{display:none}
.volcano-ide .vc-body .vc-sec[data-c="1"]>table>tbody>tr:nth-child(n+2),.volcano-ide .vc-body .vc-sec[data-c="1"]>div>table>tbody>tr:nth-child(n+2){display:none}
.volcano-ide .vc-body .vc-tg{position:absolute;left:-${RAIL + RAIL_GAP}px;top:3px;width:${RAIL}px;height:15px;padding:0;border:1px solid ${C.border};border-radius:3px;background-color:transparent;color:${C.text};font-family:${FONT};font-size:11px;line-height:13px;text-align:center;cursor:pointer;opacity:.55;user-select:none;-webkit-user-select:none}
.volcano-ide .vc-body .vc-tg:hover{opacity:1;background-color:${C.headBg}}
@media print{.volcano-ide .vc-body .vc-tg{display:none}}`

const HARD = (color = C.text) =>
  `background-color:${C.bg} !important;color:${color} !important;text-align:left !important`

const WRAP = [
  'display:block',
  'margin:1.4em 0',
  `border:1px solid ${C.border}`,
  'border-radius:6px',
  `background-color:${C.bg} !important`,
  `color:${C.text} !important`,
  `font-family:${FONT}`,
  'font-size:13px',
  'line-height:1.7',
  'overflow:hidden',
  'text-align:left !important',
].join(';')

const BODY = [

  'padding:8px 14px 10px 56px !important',
  'overflow-x:auto !important',
  'overflow-y:hidden',
  'scrollbar-width:thin',
  `scrollbar-color:${C.scrollThumb} ${C.scrollTrack}`,
  `background-color:${C.bg} !important`,
].join(';')

const TOKEN_CSS = `
.volcano-ide .vc-body .vc-hk{color:${C.accent}}
.volcano-ide .vc-body .vc-hy{color:${C.type}}
.volcano-ide .vc-body .vc-hs{color:${C.value}}
.volcano-ide .vc-body .vc-hn{color:${C.num}}
.volcano-ide .vc-body .vc-hc{color:${C.remark}}
.volcano-ide .vc-body .vc-hf{color:${C.func}}
.volcano-ide .vc-body .vc-hd{color:${C.name}}
.volcano-ide .vc-body .vc-he{color:${C.embed}}
.volcano-ide .vc-body .vc-hx{color:${C.text}}
.volcano-ide .vc-body .vc-hb{color:${C.bool}}
.volcano-ide .vc-body .vc-ha{color:${C.array}}
.volcano-ide .vc-body .vc-hp{color:${C.paren}}
.volcano-ide .vc-body .vc-hq{color:${C.bracket}}
.volcano-ide .vc-body .vc-hg{color:${C.brace}}
.volcano-ide .vc-body .vc-hm{color:${C.comma}}
.volcano-ide .vc-body .vc-ho{color:${C.dot}}
.volcano-ide .vc-body .vc-hv{color:${C.op}}
.volcano-ide .vc-body .vc-ck{color:${C.check}}

.volcano-ide .vc-body .vc-ck-off{color:${C.remark};opacity:.85}
.volcano-ide .vc-body .vc-mc{color:${C.methodCat}}
.volcano-ide .vc-body .vc-hh{color:${C.head}}
`

const CHROME_STYLE = `<style>
.volcano-ide>summary{list-style:none}
.volcano-ide>summary::-webkit-details-marker{display:none}
.volcano-ide>summary::marker{content:""}
.volcano-ide.volcano-ide>summary{border:0 !important;box-shadow:none !important}
.volcano-ide.volcano-ide>summary::after{border-bottom:0 !important;border-block-end:0 !important}
.volcano-ide.volcano-ide>.vc-body{border-top:0 !important;border-block-start:0 !important}
.volcano-ide{interpolate-size:allow-keywords}
.volcano-ide::details-content{block-size:0;overflow:hidden;transition-property:block-size,content-visibility;transition-duration:.35s;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-behavior:allow-discrete}
.volcano-ide[open]::details-content{block-size:auto}
.volcano-ide .vc-body::-webkit-scrollbar{height:9px;width:9px}
.volcano-ide .vc-body::-webkit-scrollbar-track{background:${C.scrollTrack};border-radius:5px}
.volcano-ide .vc-body::-webkit-scrollbar-thumb{background:${C.scrollThumb};border-radius:5px;border:2px solid ${C.scrollTrack}}
.volcano-ide .vc-body::-webkit-scrollbar-thumb:hover{background:${C.scrollThumbHover}}
.volcano-ide .vc-body::-webkit-scrollbar-corner{background:${C.scrollTrack}}
.volcano-ide .vc-copy:hover{background-color:${C.border} !important;color:${C.text} !important}
.volcano-ide .vc-body td{padding:2px 8px;vertical-align:top;white-space:nowrap;border:1px solid ${C.grid} !important;${HARD(C.text)}}
.volcano-ide .vc-body th{padding:4px 8px;font-weight:400;font-size:12px;white-space:nowrap;text-align:left !important;background-color:${C.headBg} !important;color:${C.head} !important;border:1px solid ${C.border} !important}
.volcano-ide .vc-body th.vc-th-key{color:${C.headKey} !important}
.volcano-ide .vc-body th.vc-head-event-decl{background-color:${C.headBgEventDecl} !important}
.volcano-ide .vc-body th.vc-head-event-recv{background-color:${C.headBgEventRecv} !important}
.volcano-ide .vc-body th.vc-head-prop-get{background-color:${C.headBgPropGet} !important}
.volcano-ide .vc-body th.vc-head-prop-set{background-color:${C.headBgPropSet} !important}
.volcano-ide .vc-body td.vc-attr-name{color:${C.attrName} !important}
.volcano-ide .vc-body td.vc-attr-value{color:${C.attrValue} !important}
.volcano-ide .vc-body td.vc-rm{white-space:normal !important;width:320px;min-width:320px;overflow-wrap:anywhere}
.volcano-ide .vc-body .vc-line{white-space:pre;font-family:${FONT};line-height:1.75;${HARD(C.text)}}
.volcano-ide .vc-body .vc-line.vc-guide{background-image:repeating-linear-gradient(to right,${C.guide} 0 1px,transparent 1px ${CODE_STEP}px);background-repeat:no-repeat}
.volcano-ide .vc-body .vc-gap{font-size:0}
.volcano-ide .vc-body{--vc-lno:-${GUTTER}px;--vc-tdnum:-${GUTTER}px;padding-left:${GUTTER}px !important;counter-reset:vc-ln;position:relative}
.volcano-ide .vc-body .vc-line{counter-increment:vc-ln;position:relative}
.volcano-ide .vc-body .vc-line::before{content:counter(vc-ln);position:absolute;left:var(--vc-lno,-${LINE_NO_WIDTH}px);top:1px;width:${LINE_NO_WIDTH}px;padding-right:4px;box-sizing:border-box;text-align:right;color:${C.text};opacity:.45;line-height:1.75;font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none;pointer-events:none}
.volcano-ide .vc-body .vc-line.vc-el{counter-increment:none;min-height:1.75em}
.volcano-ide .vc-body .vc-line.vc-el::before{content:""}
.volcano-ide .vc-body>div:not(.vc-line):not(.vc-sec),.volcano-ide .vc-body>table{position:static !important}
.volcano-ide .vc-body tbody>tr>td:first-child{counter-increment:vc-ln}
.volcano-ide .vc-body tbody>tr>td:first-child::before{content:counter(vc-ln);position:absolute;left:var(--vc-tdnum,0px);width:${LINE_NO_WIDTH}px;padding-right:4px;box-sizing:border-box;text-align:right;color:${C.text};opacity:.45;line-height:1.75;font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none;pointer-events:none}
${SECTION_CSS}
@media (prefers-reduced-motion:reduce){.volcano-ide::details-content{transition:none}}
${TOKEN_CSS}
</style>`

const COPY_JS = [
  '(function(b){',
  'event.preventDefault();event.stopPropagation();',
  "var host=b.closest('volcano-code');",
  "var raw=host?host.getAttribute('data-content')||'':'';",
  "var done=function(){b.textContent='已复制';setTimeout(function(){b.textContent='复制'},1200)};",
  "var fallback=function(){var t=document.createElement('textarea');t.value=raw;t.style.position='fixed';t.style.top='-9999px';document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(t)};",
  'if(navigator.clipboard&amp;&amp;navigator.clipboard.writeText){navigator.clipboard.writeText(raw).then(done,fallback)}else{fallback()}',
  '})(this)',
].join('')

const DOT = (color: string) =>
  `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${color};border:1px solid rgba(0,0,0,.25);box-sizing:border-box"></span>`

function chrome(body: string): string {
  const header =
    `<summary style="display:flex;align-items:center;gap:10px;padding:7px 12px;` +
    `background-color:${C.headBg} !important;color:${C.text} !important;` +
    `font-size:12px;list-style:none;` +
    `cursor:pointer;user-select:none;text-align:left">` +
    `<span style="display:inline-flex;align-items:center;gap:7px;flex:0 0 auto">` +
    DOT('#ff5f57') +
    DOT('#febc2e') +
    DOT('#28c840') +
    `</span>` +
    `<span style="flex:0 0 auto;letter-spacing:.02em">火山中文编程开发平台</span>` +
    `<span style="flex:1 1 auto"></span>` +
    `<button type="button" class="vc-copy" onclick="${COPY_JS}" ` +
    `style="padding:2px 10px;border:1px solid ${C.border};border-radius:4px;` +
    `background-color:${C.headBg} !important;color:${C.text} !important;font-size:12px;` +
    `font-family:inherit;line-height:1.6;cursor:pointer">复制</button>` +
    `</summary>`
  return `<details class="volcano-ide" open style="${WRAP}">${CHROME_STYLE}${header}<div class="vc-body" style="${BODY}">${body}</div></details>`
}

const TABLE = [
  'margin:0 !important',
  'padding:0',
  'width:max-content',
  'border:0 !important',
  'border-collapse:collapse',
  'table-layout:auto',
  `background-color:${C.bg} !important`,
  'text-align:left !important',
].join(';')

const NAME_HEADERS = new Set([
  '包名',
  '类名',
  '成员变量',
  '常量名',
  '方法名',
  '局部变量名',
  '局部常量名',
])

const METHOD_FLAGS = ['接收事件', '定义事件', '属性读', '属性写'] as const

const HIDDEN_ATTRS = new Set(['折叠', '折叠2', '隐藏值属性', '编辑时信息'])

const KNOWN_ATTRS = new Set([
  '公开',
  '私有',
  '保护',
  '静态',
  '参考',
  '可空',
  '数组',
  '类型',
  '值',

  '初始值',
  '注释',
  '注释2',
  '类别',
  '基础类',
  '返回值注释',
  ...METHOD_FLAGS,
  '构造方法',
  '析构方法',
])

type AttrPair = { name: string; value: string }

function attrRaw(attrs: Attrs, key: string): string {
  for (let i = attrs.length - 1; i >= 0; i--) {
    const item = attrs[i]
    if (item && item.name === key) {
      const value: AttrValue = item.value
      return typeof value === 'string' ? value : ''
    }
  }
  return ''
}

const ENTITY_MAP: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
}

function decodeEntities(text: string): string {
  return text.replace(/&(quot|apos|lt|gt|amp);/g, (whole) => ENTITY_MAP[whole] ?? whole)
}

function unquote(value: string): string {
  const text = decodeEntities(value.trim())
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\"/g, '"')
  }
  return text.replace(/\\"/g, '"')
}

function attr(attrs: Attrs, key: string): string {
  return unquote(attrRaw(attrs, key))
}

function attrLines(attrs: Attrs, key: string): string[] {
  const lines: string[] = []
  attrs.forEach((item) => {
    if (item.name !== key) {
      return
    }
    const value = unquote(typeof item.value === 'string' ? item.value : '')

    value.split(/\\r\\n|\\n|\\r|\r\n|\n|\r/).forEach((part) => {
      const line = part.trim()
      if (line) {
        lines.push(line)
      }
    })
  })
  return lines
}

function has(attrs: Attrs, key: string): boolean {
  return attrs.some((item) => item.name === key)
}

function flag(attrs: Attrs, key: string): boolean {
  return attrs.some(
    (item) => item.name === key && item.value !== '假' && item.value !== '0',
  )
}

function check(attrs: Attrs, key: string): string {
  return flag(attrs, key) ? `<span class="vc-ck">✓</span>` : ''
}

function refMark(attrs: Attrs, key: string): string {
  return flag(attrs, key) ? `<span class="vc-ck vc-ck-off">×</span>` : ''
}

function name(text: string): string {
  return `<span class="vc-hd">${escapeHtml(text)}</span>`
}

function typeName(text: string): string {
  return text ? `<span class="vc-hy">${escapeHtml(text)}</span>` : ''
}

function valueText(text: string): string {
  return text ? `<span class="vc-hs">${escapeHtml(text)}</span>` : ''
}

function remark(lines: string[]): string {
  const rows = lines.filter(Boolean).map((line) => escapeHtml(line))
  return rows.length > 0 ? `<span class="vc-hc">${rows.join('<br>')}</span>` : ''
}

function attrPairs(attrs: Attrs, skip: Set<string> = KNOWN_ATTRS): AttrPair[] {
  const pairs: AttrPair[] = []
  attrs.forEach((item) => {
    const key = item.name

    if (skip.has(key) || HIDDEN_ATTRS.has(key)) {
      return
    }
    pairs.push({ name: key, value: item.value === true ? '' : String(item.value) })
  })
  return pairs
}

function methodCategory(attrs: Attrs): string {
  const flags = METHOD_FLAGS.filter((flag) => has(attrs, flag))
  const paint = (text: string) => `<span class="vc-mc">${escapeHtml(text)}</span>`
  if (flags.length > 0) {
    return paint(flags.join(' / '))
  }
  const declared = attr(attrs, '类别')
  if (declared) {
    return paint(declared)
  }
  return `<span class="vc-hh">通常</span>`
}

function methodHeadTone(attrs: Attrs): string {
  if (has(attrs, '定义事件')) {
    return 'vc-head-event-decl'
  }
  if (has(attrs, '接收事件')) {
    return 'vc-head-event-recv'
  }
  if (has(attrs, '属性读')) {
    return 'vc-head-prop-get'
  }
  if (has(attrs, '属性写')) {
    return 'vc-head-prop-set'
  }
  return ''
}

const REMARK_WRAP_AT = 24

function td(
  html: string,
  opts: { rowspan?: number; colspan?: number; shrink?: boolean; tone?: string } = {},
): string {
  const { rowspan = 1, colspan = 1, shrink = false, tone = '' } = opts

  const plain =
    html.indexOf('<') < 0 && html.indexOf('&') < 0
      ? html.trim()
      : html
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .trim()
  const flat = plain.indexOf('\n') < 0 ? plain : plain.replace(/\s*\n\s*/g, ' ').trim()
  const title = flat.length > 10 ? ` title="${escapeHtml(flat)}"` : ''

  const wrap = shrink && plain.split('\n').some((line) => line.length > REMARK_WRAP_AT)

  const style = shrink && !wrap ? ` style="width:1%"` : ''
  const span = colspan > 1 ? ` colspan="${colspan}"` : ''
  const row = rowspan > 1 ? ` rowspan="${rowspan}"` : ''
  const classes = [tone, wrap ? 'vc-rm' : ''].filter(Boolean)
  const cls = classes.length > 0 ? ` class="${classes.join(' ')}"` : ''
  return `<td${span}${row}${cls}${style}${title}>${html}</td>`
}

function th(
  text: string,
  opts: { colspan?: number; shrink?: boolean; tone?: string } = {},
): string {
  const { colspan = 1, shrink = false, tone = '' } = opts
  const span = colspan > 1 ? ` colspan="${colspan}"` : ''

  const classes = [NAME_HEADERS.has(text) ? 'vc-th-key' : '', tone].filter(Boolean)
  const cls = classes.length > 0 ? ` class="${classes.join(' ')}"` : ''
  const style = shrink ? ' style="width:1%"' : ''
  return `<th${span}${cls}${style}>${escapeHtml(text)}</th>`
}

function attrTable(
  headers: string[],
  rows: { cells: string[]; attrs: AttrPair[] }[],
  leftPx = 0,
): string {
  const nameIdx = headers.indexOf('属性名')
  const valueIdx = headers.indexOf('属性值')
  const ths = headers
    .map((text, index) => th(text, { shrink: index === headers.length - 1 }))
    .join('')

  const trs: string[] = []
  rows.forEach((row) => {
    const pairs: AttrPair[] = row.attrs.length > 0 ? row.attrs : [{ name: '', value: '' }]
    const span = pairs.length
    pairs.forEach((pair, pairIndex) => {
      const cells = row.cells.slice()
      if (nameIdx >= 0) {
        cells[nameIdx] = pair.name ? escapeHtml(pair.name) : ''
      }
      if (valueIdx >= 0) {
        cells[valueIdx] = pair.value ? escapeHtml(pair.value) : ''
      }
      const tds: string[] = []
      cells.forEach((html, index) => {
        const isAttrCol = index === nameIdx || index === valueIdx
        if (pairIndex > 0 && !isAttrCol) {
          return
        }
        const rowspan = !isAttrCol && pairIndex === 0 && span > 1 ? span : 1
        tds.push(
          td(html, {
            rowspan,
            shrink: index === cells.length - 1,
            tone: index === nameIdx ? 'vc-attr-name' : index === valueIdx ? 'vc-attr-value' : '',
          }),
        )
      })
      trs.push(`<tr>${tds.join('')}</tr>`)
    })
  })

  const table = `<table style="${TABLE}"><thead><tr>${ths}</tr></thead><tbody>${trs.join(
    '',
  )}</tbody></table>`
  return leftPx > 0 ? `<div style="padding-left:${leftPx}px">${table}</div>` : table
}

const GUIDE_START = 0

function guideBackground(depth: number, baseLeft: number, height = '100%'): string {
  if (depth <= 0) {
    return ''
  }
  return [
    `background-image:repeating-linear-gradient(to right,${C.guide} 0 1px,transparent 1px ${CODE_STEP}px)`,
    `background-size:${depth * CODE_STEP}px ${height}`,
    `background-position:${baseLeft + GUIDE_START}px 0`,
    'background-repeat:no-repeat',
  ].join(';')
}

function nestedBlock(table: string, depth: number, codeBase: number): string {
  if (depth <= 0) {
    return `<div style="padding-left:${codeBase}px">${table}</div>`
  }
  const left = codeBase + depth * CODE_STEP
  return `<div style="padding:4px 0 4px ${left}px;${guideBackground(depth, codeBase)}">${table}</div>`
}

function countRows(html: string): number {
  let count = 0
  let at = html.indexOf('<tr>')
  while (at >= 0) {
    count += 1
    at = html.indexOf('<tr>', at + 4)
  }
  return count
}

function sec(head: string, body = ''): string {
  const inner = body.trim()
  const rows = countRows(head) + countRows(inner)
  if (rows <= 2) {
    return head + inner
  }
  const toggle = `<button type="button" class="vc-tg" aria-label="折叠/展开" onclick="${TOGGLE_JS}">\u2212</button>`
  const content = inner ? `<div class="vc-sec-b">${inner}</div>` : ''
  return `<div class="vc-sec">${toggle}${head}${content}</div>`
}

function gap(height = 10): string {
  return `<div class="vc-gap" style="height:${height}px;line-height:${height}px"></div>`
}

function gapInside(prevDepth: number, nextDepth: number, codeBase: number, height = 10): string {
  if (prevDepth <= 0 || nextDepth <= 0) {
    return gap(height)
  }
  const level = Math.min(prevDepth, nextDepth)
  return `<div style="height:${height}px;line-height:${height}px;font-size:0;${guideBackground(level, codeBase)}"></div>`
}

const PARAM_LABEL = '参数名'
const PARAM_TYPE_COLSPAN = 3

function methodBlock(method: VolcanoMethod, leftPx: number): string {
  const headers = ['方法名', '公开', '类别', '静态', '属性名', '属性值', '备注']

  const headTone = methodHeadTone(method.attrs)
  const ths = headers
    .map((text, index) =>
      th(text, { shrink: index === headers.length - 1, tone: index === 0 ? headTone : '' }),
    )
    .join('')

  const trs: string[] = []

  const extraAttrs = attrPairs(method.attrs)
  const methodPairs: AttrPair[] = extraAttrs.length > 0 ? extraAttrs : [{ name: '', value: '' }]
  const methodSpan = methodPairs.length
  methodPairs.forEach((pair, pairIndex) => {
    if (pairIndex === 0) {
      const tds = [
        td(name(method.name), { rowspan: methodSpan }),
        td(check(method.attrs, '公开'), { rowspan: methodSpan }),
        td(methodCategory(method.attrs), { rowspan: methodSpan }),
        td(check(method.attrs, '静态'), { rowspan: methodSpan }),
        td(pair.name ? escapeHtml(pair.name) : '', { tone: 'vc-attr-name' }),
        td(pair.value ? escapeHtml(pair.value) : '', { tone: 'vc-attr-value' }),
        td(remark(attrLines(method.attrs, '注释')), {
          shrink: true,
          rowspan: methodSpan,
        }),
      ]
      trs.push(`<tr>${tds.join('')}</tr>`)
    } else {
      trs.push(
        `<tr>${td(pair.name ? escapeHtml(pair.name) : '', {
          tone: 'vc-attr-name',
        })}${td(pair.value ? escapeHtml(pair.value) : '', {
          tone: 'vc-attr-value',
        })}</tr>`,
      )
    }
  })

  const label = (text: string) => `<span style="color:${C.accent}">${escapeHtml(text)}</span>`
  trs.push(
    `<tr>${td(label('返回值类型:'))}${td(typeName(attr(method.attrs, '类型')), {
      colspan: 3,
    })}${td(label('返回值备注:'), {
      colspan: 2,
    })}${td(remark(attrLines(method.attrs, '返回值注释')), { shrink: true })}</tr>`,
  )

  if (method.parameters.length > 0) {
    trs.push(
      `<tr>${th(PARAM_LABEL)}${th('类型', {
        colspan: PARAM_TYPE_COLSPAN,
      })}${th('属性名')}${th('属性值')}${th('备注', { shrink: true })}</tr>`,
    )

    method.parameters.forEach((decl) => {
      const extra = attrPairs(decl.attrs)
      const pairs: AttrPair[] = extra.length > 0 ? extra : [{ name: '', value: '' }]
      const span = pairs.length
      const typeCell = typeName(attr(decl.attrs, '类型'))
      pairs.forEach((pair, pairIndex) => {
        if (pairIndex === 0) {
          const tds = [
            td(name(decl.name), { rowspan: span }),
            td(typeCell, { colspan: PARAM_TYPE_COLSPAN, rowspan: span }),
            td(pair.name ? escapeHtml(pair.name) : ''),
            td(pair.value ? escapeHtml(pair.value) : ''),
            td(remark(attrLines(decl.attrs, '注释')), { shrink: true, rowspan: span }),
          ]
          trs.push(`<tr>${tds.join('')}</tr>`)
        } else {
          trs.push(
            `<tr>${td(pair.name ? escapeHtml(pair.name) : '')}${td(
              pair.value ? escapeHtml(pair.value) : '',
            )}</tr>`,
          )
        }
      })
    })
  }

  const table = `<table style="${TABLE}"><thead><tr>${ths}</tr></thead><tbody>${trs.join(
    '',
  )}</tbody></table>`
  return leftPx > 0 ? `<div style="padding-left:${leftPx}px">${table}</div>` : table
}

function codeBlock(
  items: { text: string; depth: number; gap?: boolean }[],
  baseLeft: number,
): string {
  const lines = items.map((item) => {
    if (!item.gap && !item.text.trim()) {
      return `<div class="vc-gap" style="height:10px"></div>`
    }
    const depth = Math.max(0, item.depth)
    const left = baseLeft + depth * CODE_STEP

    const style = [
      `padding:1px 12px 1px ${left}px`,
      depth > 0 ? `background-size:${depth * CODE_STEP}px 100%` : '',
      depth > 0 ? `background-position:${baseLeft + GUIDE_START}px 0` : '',
    ]
      .filter(Boolean)
      .join(';')
    if (item.gap) {

      return `<div class="vc-line vc-guide vc-el" style="${style}"></div>`
    }
    const cls = depth > 0 ? 'vc-line vc-guide' : 'vc-line'
    return `<div class="${cls}" style="${style}">${highlightLine(item.text)}</div>`
  })
  return lines.join('')
}

function renderItems(items: MethodItem[], codeBase: number): string {
  const parts: string[] = []
  let index = 0
  let prevDepth = 0

  while (index < items.length) {
    const item: MethodItem | undefined = items[index]
    if (!item) {
      break
    }
    if (item.kind === 'local' || item.kind === 'constant') {
      const kind = item.kind
      const depth = item.depth
      const run: VolcanoDecl[] = []
      let current: MethodItem | undefined = items[index]
      while (
        current &&
        (current.kind === 'local' || current.kind === 'constant') &&
        current.kind === kind &&
        current.depth === depth
      ) {
        run.push(current.decl)
        index += 1
        current = items[index]
      }

      const isConstant = kind === 'constant'
      const rows = run.map((decl) => ({
        cells: isConstant
          ? [
              name(decl.name),
              typeName(attr(decl.attrs, '类型')),
              valueText(attrRaw(decl.attrs, '值')),
              '',
              '',
              remark(attrLines(decl.attrs, '注释')),
            ]
          : [
              name(decl.name),
              typeName(attr(decl.attrs, '类型')),
              check(decl.attrs, '静态'),
              refMark(decl.attrs, '参考'),
              valueText(attrRaw(decl.attrs, '值') || attrRaw(decl.attrs, '初始值')),
              '',
              '',
              remark(attrLines(decl.attrs, '注释')),
            ],
        attrs: attrPairs(decl.attrs),
      }))
      const table = isConstant
        ? attrTable(['局部常量名', '类型', '初始值', '属性名', '属性值', '备注'], rows)
        : attrTable(
            ['局部变量名', '类型', '静态', '参考', '初始值', '属性名', '属性值', '备注'],
            rows,
          )
      parts.push(gapInside(prevDepth, depth, codeBase))
      parts.push(sec(nestedBlock(table, depth, codeBase)))
      prevDepth = depth
      continue
    }
    const run: { text: string; depth: number; gap?: boolean }[] = []
    let stmt: MethodItem | undefined = items[index]
    while (stmt && stmt.kind === 'statement') {
      run.push({ text: stmt.text, depth: stmt.depth, gap: stmt.gap })
      index += 1
      stmt = items[index]
    }
    const firstDepth = run[0]?.depth ?? 0
    const lastDepth = run[run.length - 1]?.depth ?? 0
    parts.push(gapInside(prevDepth, firstDepth, codeBase))
    parts.push(codeBlock(run, codeBase))
    prevDepth = lastDepth
  }
  return parts.join('')
}

function renderUncached(text: string): string {
  const program = parseVolcano(text ?? '')
  const raw = (text ?? '').trim()

  if (!raw) {
    return chrome(
      `<div style="padding:14px 0;color:${C.head}">在左侧粘贴火山视窗的“文本格式”代码</div>`,
    )
  }
  if (program.classes.length === 0 && program.fragment.length === 0) {
    return chrome(
      `<div style="white-space:pre;font-family:${FONT};color:${C.text} !important">${escapeHtml(
        text,
      )}</div>`,
    )
  }

  const parts: string[] = []

  if (program.pkg) {
    parts.push(
      sec(
        attrTable(
          ['包名', '属性名', '属性值', '备注'],
          [
            {
              cells: [name(program.pkg.name), '', '', remark([])],
              attrs: attrPairs(program.pkg.attrs, new Set<string>()),
            },
          ],
        ),
      ),
    )
    parts.push(gap())
  }

  program.classes.forEach((cls) => {
    const hasClass = cls.name.length > 0
    const memberLeft = hasClass ? BLOCK_INDENT : 0

    const codeBase = CODE_BASE + (hasClass ? BLOCK_INDENT : 0)

    const blocks: string[] = []

    if (cls.members.length > 0) {
      blocks.push(
        sec(
          attrTable(
            ['成员变量', '类型', '公开', '静态', '参考', '初始值', '属性名', '属性值', '备注'],
            cls.members.map((decl) => ({
              cells: [
                name(decl.name),
                typeName(attr(decl.attrs, '类型')),
                check(decl.attrs, '公开'),
                check(decl.attrs, '静态'),
                refMark(decl.attrs, '参考'),
                valueText(attrRaw(decl.attrs, '值') || attrRaw(decl.attrs, '初始值')),
                '',
                '',
                remark(attrLines(decl.attrs, '注释')),
              ],
              attrs: attrPairs(decl.attrs),
            })),
            memberLeft,
          ),
        ),
      )
    }

    if (cls.constants.length > 0) {
      blocks.push(
        sec(
          attrTable(
            ['常量名', '类型', '初始值', '公开', '属性名', '属性值', '备注'],
            cls.constants.map((decl) => ({
              cells: [
                name(decl.name),
                typeName(attr(decl.attrs, '类型')),
                valueText(attrRaw(decl.attrs, '值')),
                check(decl.attrs, '公开'),
                '',
                '',
                remark(attrLines(decl.attrs, '注释')),
              ],
              attrs: attrPairs(decl.attrs),
            })),
            memberLeft,
          ),
        ),
      )
    }

    cls.methods.forEach((method) => {

      blocks.push(
        sec(
          methodBlock(method, memberLeft),

          renderItems(method.items, codeBase) + gap(16),
        ),
      )
    })

    if (cls.loose.length > 0) {
      blocks.push(renderItems(cls.loose, codeBase))
    }

    const body = blocks.join(gap())

    if (hasClass) {
      const classHead = attrTable(
        ['类名', '基础类', '公开', '属性名', '属性值', '备注'],
        [
          {
            cells: [
              name(cls.name),
              typeName(attr(cls.attrs, '基础类')),
              check(cls.attrs, '公开'),
              '',
              '',
              remark(attrLines(cls.attrs, '注释')),
            ],
            attrs: attrPairs(cls.attrs),
          },
        ],
        0,
      )

      parts.push(sec(classHead, body ? gap() + body : ''))
      parts.push(gap())
      return
    }

    parts.push(body)
    parts.push(gap())
  })

  if (program.fragment.length > 0) {
    parts.push(renderItems(program.fragment, CODE_BASE))
    parts.push(gap(16))
  }

  return chrome(parts.join(''))
}

const CACHE_MAX_BYTES = 8 * 1024 * 1024
const CACHE_MAX_ENTRIES = 4
const RENDER_CACHE = new Map<string, string>()
let RENDER_CACHE_BYTES = 0

function cacheGet(key: string): string | undefined {
  const hit = RENDER_CACHE.get(key)
  if (hit === undefined) {
    return undefined
  }

  RENDER_CACHE.delete(key)
  RENDER_CACHE.set(key, hit)
  return hit
}

function cacheSet(key: string, html: string): void {
  RENDER_CACHE.set(key, html)
  RENDER_CACHE_BYTES += key.length + html.length

  while (
    RENDER_CACHE.size > 1 &&
    (RENDER_CACHE_BYTES > CACHE_MAX_BYTES || RENDER_CACHE.size > CACHE_MAX_ENTRIES)
  ) {
    const oldest = RENDER_CACHE.keys().next()
    if (oldest.done) {
      break
    }
    const value = RENDER_CACHE.get(oldest.value)
    RENDER_CACHE.delete(oldest.value)
    RENDER_CACHE_BYTES -= oldest.value.length + (value?.length ?? 0)
  }
}

export function renderVolcano(text: string): string {
  const key = text ?? ''
  const cached = cacheGet(key)
  if (cached !== undefined) {
    return cached
  }
  const html = renderUncached(key)
  cacheSet(key, html)
  return html
}
