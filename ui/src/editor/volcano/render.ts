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

/**
 * 所有颜色都走 CSS 变量，兜底色 = 默认主题「火山配色」（取自 火山配色.vui）。
 * 变量由插件后端按「设置 → 配色主题」注入到页面 :root（见 ThemeStyleFilter），
 * 所以换主题时历史文章不用重新保存也能换色。
 * 变量名必须与 ThemePalette.java 的 Vars.NAMES 一一对应。
 */
const C = {
  bg: 'var(--vc-bg, #1E1E1E)',
  headBg: 'var(--vc-head-bg, #333333)',
  border: 'var(--vc-border, #555555)',
  grid: 'var(--vc-grid, #4A4A4A)',
  text: 'var(--vc-text, #D4D4D4)',
  head: 'var(--vc-head, #C8C8C8)',
  /** 名称列表头（包名/类名/成员变量/常量名/方法名/局部变量名/局部常量名） */
  headKey: 'var(--vc-head-key, #89D185)',
  name: 'var(--vc-name, #9CDCFE)',
  type: 'var(--vc-type, #4EC9B0)',
  value: 'var(--vc-value, #CE9178)',
  check: 'var(--vc-check, #4EC9B0)',
  remark: 'var(--vc-remark, #6A9955)',
  accent: 'var(--vc-accent, #569CD6)',
  guide: 'var(--vc-guide, #D16969)',
  /** 横向滚动条：轨道 / 滑块，细条，和代码高亮组件的观感一致 */
  scrollTrack: 'var(--vc-scroll-track, #1E1E1E)',
  scrollThumb: 'var(--vc-scroll-thumb, #424242)',
  scrollThumbHover: 'var(--vc-scroll-thumb-hover, #5A5A5A)',
  /** 表格里的「属性名 / 属性值」两列文字（DRC_T_ATTR_GRID_PROP_NAME / VALUE） */
  attrName: 'var(--vc-attr-name, #C8C8C8)',
  attrValue: 'var(--vc-attr-value, #CE9178)',
  /** 方法「类别」列（DRC_T_METHOD_CATEGORY） */
  methodCat: 'var(--vc-method-cat, #4EC9B0)',
  /** 下面这些只给 token 着色类（TOKEN_CSS）用，等价于 highlight 里原来的内联色 */
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
  /** 火山按方法类别给表头首列换底色 */
  headBgEventDecl: 'var(--vc-head-bg-event-decl, #3A2A2A)',
  headBgEventRecv: 'var(--vc-head-bg-event-recv, #24363A)',
  headBgPropGet: 'var(--vc-head-bg-prop-get, #2A2A3A)',
  headBgPropSet: 'var(--vc-head-bg-prop-set, #243A2A)',
}

/** 一级缩进：整个表格块（含表头和左右边框）整体右移。 */
const BLOCK_INDENT = 22
const CODE_STEP = 22
const CODE_BASE = 14

/**
 * 左侧行号列宽。
 *
 * <p>行号完全由 CSS 计数器生成（`counter-increment` + `::before`），HTML 里不增加任何
 * 节点：好处是单块体积不变，而且**历史文章**靠注入的样式也能生效，不用重新保存。
 * 行号画在 `.vc-body` 的左侧留白里（容器加 `padding-left`），代码缩进仍然由
 * `.vc-line` 自己的 `padding-left` 决定，两者互不干扰。</p>
 */
const LINE_NO_WIDTH = 38

/**
 * 正文容器左侧留白 = 行号列（38px）+ 折叠按钮栏（16px）+ 2px 间隙。
 *
 * <p>列序（从左到右）：行号 → 折叠按钮 → 表格 / 代码，和 IDE 阅读习惯一致：
 * 行号是最外层的坐标，属于渲染内容的只有按钮和正文。所有段的按钮都落在
 * 同一条竖栏（38..54）里，缩进再深的表格按钮也不会跑位、更不会压到行号。</p>
 */
const GUTTER = 56

/** 折叠按钮栏宽度 */
const RAIL = 16

/** 折叠按钮与表格左边缘之间的空隙 */
const RAIL_GAP = 2

/**
 * 折叠/展开：点一下翻转所在 `.vc-sec` 的 `data-c`，再把符号在 + / − 之间换掉。
 *
 * <p>用内联处理器而不是全局脚本，和「复制」按钮保持一致：快照拿去别处（RSS、导出）
 * 也能用，不需要额外挂 JS 文件。</p>
 */
const TOGGLE_JS =
  "var s=this.parentNode,c=s.getAttribute('data-c')==='1';" +
  "s.setAttribute('data-c',c?'0':'1');this.textContent=c?'\u2212':'+'"

/**
 * 折叠机制：
 *   展开时 `data-c` 不为 1，全部内容照常显示；
 *   收起时 `<thead>` 之外的表格行从第 2 行起隐藏（只留表头 + 第一行数据），
 *   同时隐藏 `.vc-sec-b`（该段管辖的层级子表与代码）。
 *
 * <p>被隐藏的元素不生成盒子，CSS 计数器也就不会为它们计数，行号会自动重排成连续
 * 的 1..n——这正是想要的效果，不用额外的 JS 去改号。</p>
 */
const SECTION_CSS = `
.volcano-ide .vc-body .vc-sec{position:relative}
.volcano-ide .vc-body .vc-sec[data-c="1"]>.vc-sec-b{display:none}
.volcano-ide .vc-body .vc-sec[data-c="1"]>table>tbody>tr:nth-child(n+2),.volcano-ide .vc-body .vc-sec[data-c="1"]>div>table>tbody>tr:nth-child(n+2){display:none}
.volcano-ide .vc-body .vc-tg{position:absolute;left:-${RAIL + RAIL_GAP}px;top:3px;width:${RAIL}px;height:15px;padding:0;border:1px solid ${C.border};border-radius:3px;background-color:transparent;color:${C.text};font-family:${FONT};font-size:11px;line-height:13px;text-align:center;cursor:pointer;opacity:.55;user-select:none;-webkit-user-select:none}
.volcano-ide .vc-body .vc-tg:hover{opacity:1;background-color:${C.headBg}}
@media print{.volcano-ide .vc-body .vc-tg{display:none}}`

/** 关键属性一律内联 !important，压住主题/编辑器自带的 table、code 样式。 */
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

/** 正文区：单行显示，超宽时横向滚动；滚动条自绘，不用系统原生外观。 */
const BODY = [
  // 左:56 = 折叠按钮栏 16 + 行号列 38 + 2px 间隙；!important 压过后端为老快照注入的 38px
  'padding:8px 14px 10px 56px !important',
  'overflow-x:auto !important',
  'overflow-y:hidden',
  'scrollbar-width:thin',
  `scrollbar-color:${C.scrollThumb} ${C.scrollTrack}`,
  `background-color:${C.bg} !important`,
].join(';')

/**
 * 伪元素样式集中在这里：滚动条外观、去掉 summary 自带箭头、清除主题挂的分隔线、按钮 hover、行号
 *
 * 关于那条「标题栏和正文之间的虚线」：插件自己从不画它。真实来源是主题给
 * `summary::after` 之类的伪元素挂了 `border-bottom`（原本用于普通块级 summary 的分隔），
 * 而我们的 summary 是 flex 容器，伪元素成了 flex item，那条边框就贴着标题栏底边横贯一条线。
 * 所以这里把已知的几个落点全部清零：summary 自身四边、`::after` 的下边框、
 * 以及正文容器的上边框。不清 `::before`——主题常用它画左侧那个折叠箭头。
 * 类名写两遍（`.volcano-ide.volcano-ide`）是为了把特异性抬到 (0,2,x)，
 * 一般主题那些 `.content details summary` 级别的规则压不过它。
 */
/**
 * token 着色规则。
 *
 * <p>快照里每个 token 只写 `class="vc-hk"` 这样的短类名，颜色在这里集中定义，
 * 依旧走 CSS 变量，所以换主题、历史文章都不用重存。
 * 兜底色与「火山配色.vui」一致，对应关系见 highlight.ts 的 CS 注释。</p>
 */
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
/* 「参考」列的 ×：唯一的异形符号，压暗一点 */
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

/** 复制按钮：优先 Clipboard API，非安全上下文退回 textarea + execCommand */
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

/**
 * macOS 风格的标题栏 + 可折叠外壳。
 *
 * 标题栏与正文之间不再画分割线：两者底色本来就不同（head-bg / bg），
 * 那道 1px 的浅色描边在深色主题下反而像一条发虚的白线，很碍眼。
 * 折叠指示也不在右侧重复挂箭头，交给 summary 自带的左侧指示即可。
 */
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

/**
 * 表格宽度随内容自适应。
 * 原来写死 width:100% + min-width:640px，浏览器会把多余宽度摊给各列，
 * 于是「属性名/属性值/备注」这些全空的列也被拉开，每张表都撑成同样的宽度。
 * 注意不能用 width:auto —— 在 .vc-body（overflow-x:auto 的滚动容器）里，
 * auto 会被解析成「填满容器」；必须用 max-content 才真正按内容取宽。
 */
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

/** 名称列表头（包名/类名/成员变量/常量名/方法名/局部变量名/局部常量名）用浅绿色。 */
const NAME_HEADERS = new Set([
  '包名',
  '类名',
  '成员变量',
  '常量名',
  '方法名',
  '局部变量名',
  '局部常量名',
])

/**
 * 方法「类别」标记：火山里这些都只写名字、不带值（如 `<公开 接收事件 类型 = 整数>`），
 * 用来标识方法的性质，属于内建标记，不是作者自定义的属性。
 * 顺序即多标记同时出现时的显示顺序。
 */
const METHOD_FLAGS = ['接收事件', '定义事件', '属性读', '属性写'] as const

/**
 * 编辑期专用属性：只在火山 IDE 内部起作用，没有任何运行语义，前端一律不显示。
 *   折叠 / 折叠2 —— IDE 里的折叠层级标记（裸标记，无值）
 *   隐藏值属性   —— IDE 用来占位的隐藏值，官方代码里几乎全是 "0"
 *   编辑时信息   —— IDE 的编辑元数据，取值形如 "7954D, 0, 0, 0"
 * 这些在官方类库源码里大量出现（折叠2 约 1500 处、隐藏值属性约 1800 处），
 * 渲染出来只会干扰阅读。
 */
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
  // 初始值已经单独占一列了，再当属性列出来就是重复一遍
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

/**
 * 原始值：不做任何转换，外层引号、\" 转义、\r\n 字面量一律原样返回。
 * 同名属性出现多次时取**最后一次**（火山用多个 `注释 = "…"` 拼一段长注释，
 * 这种字段请用 {@link attrText} 取拼接后的全文）。
 */
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

/**
 * 火山两种转义写法混着用：较新的导出把引号写成 `\"`，老一点的（以及
 * 从类库源码导出的）写成 HTML 实体 `&quot;`。实体不解码的话，备注里会原样
 * 显示成 `用户调用&quot;挂接事件&quot;…`，和 IDE 里看到的不一样。
 * 只解一层：`&amp;quot;` 会变成 `&quot;`，不会被连解两次。
 */
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

/** 语义字段（类型/类别/注释…）去掉外层引号，把 `\"` 与 `&quot;` 还原成 "，只为可读性。 */
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

/**
 * 同名属性的**每一段**，一段一行，按出现顺序返回。
 *
 * <p>火山导出时，备注里每换一行就写一个独立的 `注释 = "…"`，例如：</p>
 * <pre>
 * 变量 bb &lt;类型 = 文本型 注释 = "哈哈哈哈哈" 注释 = "啥也不说啊" 注释 = "我不知道"&gt;
 * </pre>
 * <p>所以属性出现几次，备注就该显示几行，不能拼成一行（拼起来读不出原来的分行）。</p>
 * <p>另一条路径是单个属性值内部用 `\r\n` 字面量换行（同 {@link attrRaw} 里的
 * `@视窗.布局`），这里一并按行拆开。</p>
 */
function attrLines(attrs: Attrs, key: string): string[] {
  const lines: string[] = []
  attrs.forEach((item) => {
    if (item.name !== key) {
      return
    }
    const value = unquote(typeof item.value === 'string' ? item.value : '')
    // 值里可能是字面量 \r\n（反斜杠 + r + 反斜杠 + n），也可能是真换行
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

/**
 * 布尔属性是否为真。
 *
 * `参考` 这种裸写的算真；写成 `参考 = 假` / `参考 = 0` 的是假 —— 火山导出的文本里
 * 两种写法都会出现（`允许多行表头 = 假` 就是显式写出来的），只判断「有没有这个属性」
 * 会把假当成真。
 */
function flag(attrs: Attrs, key: string): boolean {
  return attrs.some(
    (item) => item.name === key && item.value !== '假' && item.value !== '0',
  )
}

/** 勾选格：有值才打 ✓，没有留空（公开 / 静态 / 方法 / 类名这些列都用它） */
function check(attrs: Attrs, key: string): string {
  return flag(attrs, key) ? `<span class="vc-ck">✓</span>` : ''
}

/**
 * 「参考」列的格子：**和别的列不一样**，有值显示 ×，没有留空。
 *
 * 参考是火山里唯一标成 × 的属性（表示「这是引用」），不跟 ✓ 走。
 * 别把它和 check() 混用 —— 通用列都是「有值 ✓、无值空」。
 */
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

/** 备注：每段一行（`<br>` 分隔），与火山里 `注释 = "…"` 的出现次数一致。 */
function remark(lines: string[]): string {
  const rows = lines.filter(Boolean).map((line) => escapeHtml(line))
  return rows.length > 0 ? `<span class="vc-hc">${rows.join('<br>')}</span>` : ''
}

/**
 * 未归入固定列的自定义属性，按「属性名 / 属性值」成对展开。
 *
 * <p>按属性表原顺序逐个输出，**同名属性不会被合并**：火山偶尔会重复写同一个
 * 自定义属性，各占一行比悄悄丢掉更符合预期。</p>
 */
function attrPairs(attrs: Attrs, skip: Set<string> = KNOWN_ATTRS): AttrPair[] {
  const pairs: AttrPair[] = []
  attrs.forEach((item) => {
    const key = item.name
    // 编辑期专用属性任何时候都不输出（包声明传了空的 skip 集合也照样拦掉）
    if (skip.has(key) || HIDDEN_ATTRS.has(key)) {
      return
    }
    pairs.push({ name: key, value: item.value === true ? '' : String(item.value) })
  })
  return pairs
}

/** 属性值原样输出：不转 <br>、不还原 \"，只做 HTML 转义防注入。 */
function attrValueHtml(value: string): string {
  return escapeHtml(value)
}

/**
 * 方法「类别」：
 *   接收事件 / 定义事件 / 属性读 / 属性写 这些标记一旦存在就决定了方法性质，
 *   都没有才是「通常」。都没命中但显式写了 类别 = "…" 时以该值为准。
 */
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

/** 按方法类别决定表头首列底色，和火山 IDE 一致。 */
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

/**
 * 备注列里超过这个字数就允许折行（单位：字）。
 *
 * <p>备注是一整句话，火山还会把长注释切成好几段拼回来，一条注释经常上百字。
 * 全单行的话这张表能被一条备注撑到 1000px 以上，正文区只能横向滚，
 * 等于「注释还是看不全」。短备注照旧单行、宽度收到内容，不会白占地方。</p>
 */
const REMARK_WRAP_AT = 24

/**
 * 单元格：四边都有框线，表格才是封闭的。
 * 内容一律单行（nowrap），超宽由外层 .vc-body 横向滚动；
 * 只有备注列里的长文本例外（见 {@link REMARK_WRAP_AT}）。
 * shrink=true 用于备注列：宽度收到内容宽度，备注为空时不会白占一大截。
 */
function td(
  html: string,
  opts: { rowspan?: number; colspan?: number; shrink?: boolean; tone?: string } = {},
): string {
  const { rowspan = 1, colspan = 1, shrink = false, tone = '' } = opts
  // title 用纯文本：先把已经转义好的实体还原，稍后再统一 escape 一次，避免 &amp;quot; 这种二次转义
  // （<br> 保留成换行，下面既用来算最长一行，也给 title 压成单行）
  const plain = html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()
  const flat = plain.replace(/\s*\n\s*/g, ' ').trim()
  const title = flat.length > 10 ? ` title="${escapeHtml(flat)}"` : ''
  // 长备注折行：不再写 width:1%，改由 .vc-rm 给一个固定列宽（否则 width:1% 会把它压成几十像素的窄条）。
  // 多段备注已经用 <br> 分好行了，只有「随便哪一行超宽」才需要再折。
  const wrap = shrink && plain.split('\n').some((line) => line.length > REMARK_WRAP_AT)
  // 静态样式（padding / nowrap / 边框 / 底色 / 字色）统一写在 <style> 里的
  // `.volcano-ide td` 规则上，这里只留动态的列宽，尽量把单块 HTML 压小
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
  // 名称列用浅绿、方法表首列按类别换底色，其余列用普通表头色；样式同样下放到 <style>
  const classes = [NAME_HEADERS.has(text) ? 'vc-th-key' : '', tone].filter(Boolean)
  const cls = classes.length > 0 ? ` class="${classes.join(' ')}"` : ''
  const style = shrink ? ' style="width:1%"' : ''
  return `<th${span}${cls}${style}>${escapeHtml(text)}</th>`
}

/**
 * 通用声明表：属性名/属性值两列按属性个数向下展开，
 * 其余列（名称、类型、公开……）用 rowspan 合并，文本保持左对齐。
 */
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
        cells[valueIdx] = pair.value ? attrValueHtml(pair.value) : ''
      }
      const tds: string[] = []
      cells.forEach((html, index) => {
        const isAttrCol = index === nameIdx || index === valueIdx
        if (pairIndex > 0 && !isAttrCol) {
          return // 被上一行的 rowspan 覆盖
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

/**
 * 线的起点相对代码基准的偏移。
 * 每一级流程线的 x 必须与**开启该层流程块的关键字左边缘**重合：
 * 代码行 padding-left = baseLeft + depth * CODE_STEP，
 * 所以第 d 层的线就画在 baseLeft + d * CODE_STEP，偏移取 0。
 * （原来是 CODE_STEP - 6 = 16px，线会压到关键字中间，如「如果」的第 1、2 字之间。）
 */
const GUIDE_START = 0

/**
 * 所有红色流程线共用同一套画法（坐标、宽度、颜色必须完全一致，
 * 否则相邻块的线会错开 1px，看起来就像断了一截）。
 *
 * 注意：代码行的线分成两半——底图（渐变本身）由 `.vc-line.vc-guide` 类提供，
 * 内联只写 `background-size` / `background-position`。渐变图案每 22px 一条线、
 * 与层数无关，所以一份规则够所有层用，每行省下 110 字节左右；
 * 计算出来的 background-image/size/position 与原来逐行内联完全一致。
 */
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

/**
 * 嵌套的局部变量/常量表：表格左边框与同层级代码行的文字起点严格对齐。
 *
 * depth=0 时表格整体左边缘 = 代码文字起点（codeBase）；
 * depth>0 时左侧画流程线，和上方代码块的红色流程线接上。
 * 纵向 padding 也由背景图覆盖（background 覆盖 padding-box），所以线不断。
 *
 * 注意 depth=0 这里以前多加了 8px，导致顶层局部变量表比代码文字右移 8px，
 * 而 depth>0 的表格本身已经和代码文字对齐，于是同一段代码里表格时左时右，很割裂。
 */
function nestedBlock(table: string, depth: number, codeBase: number): string {
  if (depth <= 0) {
    return `<div style="padding-left:${codeBase}px">${table}</div>`
  }
  const left = codeBase + depth * CODE_STEP
  return `<div style="padding:4px 0 4px ${left}px;${guideBackground(depth, codeBase)}">${table}</div>`
}

/**
 * 把「一张表 + 它管辖的下级内容」包成可折叠的一段。
 *
 * <p>层级关系：包 → 类 → 成员变量 / 常量 → 方法 → 局部变量 / 代码。
 * 每一段只管自己 `.vc-sec-b` 里的东西，所以收成员变量表只影响它自己的行，
 * 不会连累同级的常量表或方法。</p>
 *
 * <p>什么时候给按钮：这一段里的表格行数（含表头、含下级表格）超过 2 行。
 * 只有表头 + 1 行数据、又没有下级的表（例如单个成员变量），折起来一行都省不掉，
 * 就不放按钮，免得点了没反应。</p>
 */
function sec(head: string, body = ''): string {
  const inner = body.trim()
  const rows = (head.match(/<tr>/g) ?? []).length + (inner.match(/<tr>/g) ?? []).length
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

/**
 * 块内间距：如果上一段和下一段都在同一层流程块里，就在间距里续上红色流程线，
 * 这样表格与代码之间不会断线。
 */
function gapInside(prevDepth: number, nextDepth: number, codeBase: number, height = 10): string {
  if (prevDepth <= 0 || nextDepth <= 0) {
    return gap(height)
  }
  const level = Math.min(prevDepth, nextDepth)
  return `<div style="height:${height}px;line-height:${height}px;font-size:0;${guideBackground(level, codeBase)}"></div>`
}

const PARAM_LABEL = '参数名'
const PARAM_TYPE_COLSPAN = 3

/**
 * 方法块：
 *   表头 方法名|公开|类别|静态|属性名|属性值|备注
 *   方法行（属性多时其余列 rowspan 合并）
 *   返回值行：返回值类型:|类型值(合并3)|返回值备注:(合并2)|备注值
 *   表头 参数名|类型(合并3)|属性名|属性值|备注
 *   参数行（同结构，属性多时合并）
 */
function methodBlock(method: VolcanoMethod, leftPx: number): string {
  const headers = ['方法名', '公开', '类别', '静态', '属性名', '属性值', '备注']
  // 火山 IDE 会按方法类别给表头首列换底色（定义事件偏红、接收事件偏青、属性读偏蓝、属性写偏绿）
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
        td(pair.value ? attrValueHtml(pair.value) : '', { tone: 'vc-attr-value' }),
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
            td(pair.value ? attrValueHtml(pair.value) : ''),
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

/**
 * 代码区：不画横线、不交替底色。
 * 只有流程命令（如果/否则/循环…）内部的语句才画红色流程线，条数 = 花括号深度。
 * 注意：这里不能再包一层带纵向 padding 的容器，否则上下会各留 2px 无色区域，
 * 与前后 gapInside 的线断开。
 */
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
    // 静态部分（pre / 字体 / 行高 / 字色）在 <style> 的 .vc-line 里，这里只留缩进和流程线的尺寸
    const style = [
      `padding:1px 12px 1px ${left}px`,
      depth > 0 ? `background-size:${depth * CODE_STEP}px 100%` : '',
      depth > 0 ? `background-position:${baseLeft + GUIDE_START}px 0` : '',
    ]
      .filter(Boolean)
      .join(';')
    if (item.gap) {
      // 空块补位行：没有文字，只把这一层的流程线画出来。
      // vc-el 在样式里关掉了行号计数，所以行号列留空、后面的行号不会跳号。
      return `<div class="vc-line vc-guide vc-el" style="${style}"></div>`
    }
    const cls = depth > 0 ? 'vc-line vc-guide' : 'vc-line'
    return `<div class="${cls}" style="${style}">${highlightLine(item.text)}</div>`
  })
  return lines.join('')
}

/**
 * 局部变量 / 局部常量表与代码行，按它们在源码里的先后顺序交替输出。
 * 方法体和「只粘贴了一段代码」的松散片段共用这段逻辑。
 */
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
      // 这里只可能是局部：方法体里的声明，以及「判断不出归属」的片段。
      // 火山导出的文本不带成员/局部的标签，成员与否只能看位置（在谁的大括号里），
      // 所以片段一律按局部渲染 —— 拿 `公开` 去猜会让同类的几条声明被拆成两张表。
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

  // 只有代码里显式出现「包 …」时才渲染包名表；<火山程序/> 只是固定文件头
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
    /** 代码区/嵌套表格的基准 x（方法体第一层的起点） */
    const codeBase = CODE_BASE + (hasClass ? BLOCK_INDENT : 0)

    // 类体内的一切：成员表、常量表、每个方法（表 + 方法体）、零散代码。
    // 它们都装进类这一段的 `.vc-sec-b`，收起类时整块隐藏。
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
      // 方法这一段 = 方法表（含参数表）+ 方法体（局部变量表与代码行）
      blocks.push(
        sec(
          methodBlock(method, memberLeft),
          // 局部变量与语句按原始顺序输出：局部变量出现在哪一行，就渲染在哪一行
          renderItems(method.items, codeBase) + gap(16),
        ),
      )
    })

    // 不属于任何方法的零散代码（粘贴片段时常见），跟在方法后面照常输出
    if (cls.loose.length > 0) {
      blocks.push(renderItems(cls.loose, codeBase))
    }

    // 段与段之间统一留 10px。
    // 以前只有方法在自己前面补了 gap(8)，成员表 / 常量表则直接贴着类表，
    // 于是「类名 → 成员变量」零间距，「成员变量 → 方法」却有 18px，看着像断了一截。
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
      // 类表与第一个块之间也要断开，否则「类名」表会直接贴着成员变量表
      parts.push(sec(classHead, body ? gap() + body : ''))
      parts.push(gap())
      return
    }

    // 没有类声明（只粘贴了方法体/片段）：没有可折叠的类层，内容直接铺开
    parts.push(body)
    parts.push(gap())
  })

  // 只有一段方法体、没有 类/方法 外壳：变量按局部变量渲染，其余按代码行渲染
  if (program.fragment.length > 0) {
    parts.push(renderItems(program.fragment, CODE_BASE))
    parts.push(gap(16))
  }

  return chrome(parts.join(''))
}

/**
 * 渲染结果缓存（按字节预算的 LRU）。
 *
 * <p>renderHTML 在每次序列化文档时都会被调用（保存草稿、预览、字数统计可能各来一次），
 * 一份 50KB 的火山源码要渲染出几百 KB 的 HTML，不缓存就会在点保存时反复全量渲染。</p>
 *
 * <p>但缓存不能按「条数」算：旧的实现是 40 条上限、满了整张清空，
 * 而单条可能是 1MB 的字符串，编辑一篇大文章时堆里能压几十 MB，正好在保存
 * （要新分配几百 KB 字符串 + 解析 DOM）时触发 GC，手感就是「保存卡一下」。
 * 改成按字节预算 LRU：总量封顶、最近用过的留几条就够了，因为编辑时内容一变
 * 就是新的键，历史条目基本不会再用到。</p>
 */
const CACHE_MAX_BYTES = 8 * 1024 * 1024
const CACHE_MAX_ENTRIES = 4
const RENDER_CACHE = new Map<string, string>()
let RENDER_CACHE_BYTES = 0

function cacheGet(key: string): string | undefined {
  const hit = RENDER_CACHE.get(key)
  if (hit === undefined) {
    return undefined
  }
  // Map 保持插入序：删掉再塞回去即「最近使用」
  RENDER_CACHE.delete(key)
  RENDER_CACHE.set(key, hit)
  return hit
}

function cacheSet(key: string, html: string): void {
  RENDER_CACHE.set(key, html)
  RENDER_CACHE_BYTES += key.length + html.length
  // 超预算或超条数时从最久未使用的开始淘汰
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
