export type AttrValue = string | true

/**
 * 一条属性。
 *
 * <p>属性表是**有序列表**而不是键值对：火山会把一段长注释按宽度切成
 * 好几个 `注释 = "…"` 连续写出（同一个名字出现 2~3 次很常见），
 * 用 `Record<string, …>` 存的话前面的全被后面的盖掉，渲染出来就只剩最后一段。</p>
 */
export type Attr = { name: string; value: AttrValue }
export type Attrs = Attr[]

export type VolcanoDecl = {
  name: string
  attrs: Attrs
}

export type MethodItem =
  | { kind: 'local'; decl: VolcanoDecl; depth: number }
  | { kind: 'constant'; decl: VolcanoDecl; depth: number }
  | {
      kind: 'statement'
      text: string
      depth: number
      /**
       * 空块补位行：`如果 ()` / `循环 ()` / `否则` 里一行内容都没有时补的空行。
       * 它只负责把这一层的流程线画出来，没有文字，也不吃一个行号。
       */
      gap?: boolean
    }

export type VolcanoMethod = {
  name: string
  attrs: Attrs
  parameters: VolcanoDecl[]
  items: MethodItem[]
}

export type VolcanoClass = {
  name: string
  attrs: Attrs
  members: VolcanoDecl[]
  constants: VolcanoDecl[]
  methods: VolcanoMethod[]
  /**
   * 类体里出现、但不属于任何「方法」的零散语句。
   * 粘贴局部代码（只有变量和语句、没有 类/方法 头）时会有，按代码行渲染，
   * 之前这些行是被静默丢掉的。
   */
  loose: MethodItem[]
}

export type VolcanoPackage = {
  name: string
  attrs: Attrs
}

export type VolcanoProgram = {
  attrs: Attrs
  pkg: VolcanoPackage | null
  classes: VolcanoClass[]
  /**
   * 没有「类 / 方法」包裹的松散代码片段：变量按**局部变量**渲染，其余按代码行渲染。
   * 用户常常只复制一段方法体里的代码，这种内容不该被当成类成员。
   */
  fragment: MethodItem[]
}

/**
 * 只匹配「关键字 + 名称」，**不要求**后面跟属性表：
 * 火山允许省略属性表，`包 火山.程序`、`方法 我的方法` 都是合法写法，
 * 原来的正则带了个 `\s*<`，这类声明会被整行丢掉（包名消失就是这么来的）。
 */
const DECL_RE = (keyword: string) => new RegExp(`^\\s*${keyword}\\s+([^\\s<]+)`)

/**
 * 属性只做切分，**不做任何转换**：
 * 保留外层的 " 引号、内部的 \" 转义和 \r\n 字面量，交给渲染层决定怎么展示。
 * 需要“去引号”的语义字段（类型/注释等）由 render 侧的 unquote() 处理。
 *
 * <p>同名属性按出现顺序**全部保留**（长注释会被切成多个 `注释 = "…"`），
 * 不做去重、也不合并——合并是渲染层的事。</p>
 */
function parseAttrs(text: string): Attrs {
  const attrs: Attrs = []
  const re =
    /([\u4e00-\u9fa5A-Za-z_@][\u4e00-\u9fa5A-Za-z0-9_.@]*)\s*=\s*("(?:[^"\\]|\\.)*"|\{[^}]*\}|[^\s<>]+)|([\u4e00-\u9fa5A-Za-z_@][\u4e00-\u9fa5A-Za-z0-9_.@]*)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match[1]) {
      attrs.push({ name: match[1], value: match[2] ?? '' })
    } else if (match[3]) {
      attrs.push({ name: match[3], value: true })
    }
  }
  return attrs
}

/** 从 startLine/startCol 的 '<' 开始读到配对的 '>'。 */
function readAngleBlock(
  lines: string[],
  startLine: number,
  startCol: number,
): { content: string; endLine: number } {
  let depth = 0
  let inString = false
  let content = ''
  let line = startLine
  let col = startCol

  while (line < lines.length) {
    const text = lines[line] ?? ''
    for (; col < text.length; col++) {
      const ch = text[col]
      if (inString) {
        if (ch === '\\') {
          content += ch
          if (col + 1 < text.length) {
            content += text[++col]
          }
          continue
        }
        if (ch === '"') {
          inString = false
        }
        content += ch
        continue
      }
      if (ch === '"') {
        inString = true
        content += ch
        continue
      }
      if (ch === '<') {
        depth += 1
        if (depth === 1) {
          continue
        }
      }
      if (ch === '>') {
        depth -= 1
        if (depth === 0) {
          return { content, endLine: line }
        }
      }
      content += ch
    }
    content += '\n'
    line += 1
    col = 0
  }
  return { content, endLine: line }
}

function readDecl(lines: string[], start: number, keyword: string) {
  const text = lines[start] ?? ''
  const match = text.match(DECL_RE(keyword))
  if (!match) {
    return null
  }
  const name = match[1] ?? ''
  const open = text.indexOf('<', match.index ?? 0)
  // 没有属性表：整行就是「关键字 + 名称」，属性为空，声明到本行结束
  if (open < 0) {
    return { name, attrs: [], endLine: start }
  }
  const block = readAngleBlock(lines, start, open)
  return {
    name,
    attrs: parseAttrs(block.content),
    endLine: block.endLine,
  }
}

function findBraceLine(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if ((lines[i] ?? '').includes('{')) {
      return i
    }
  }
  return -1
}

/** 收集到配对 '}' 之前的内容；只忽略字符串里的括号。 */
function collectBody(lines: string[], openLine: number): { lines: string[]; next: number } {
  let depth = 0
  let inString = false
  const body: string[] = []

  for (let li = openLine; li < lines.length; li++) {
    const text = lines[li] ?? ''
    let start = 0
    for (let ci = 0; ci < text.length; ci++) {
      const ch = text[ci]
      if (inString) {
        if (ch === '\\') {
          ci += 1
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') {
        depth += 1
        if (depth === 1) {
          start = ci + 1
        }
      } else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          const rest = text.slice(start, ci)
          if (rest.trim()) {
            body.push(rest)
          }
          return { lines: body, next: li + 1 }
        }
      }
    }
    if (depth >= 1) {
      body.push(text.slice(start))
    }
  }
  return { lines: body, next: lines.length }
}

function parseMethodBody(bodyLines: string[]): MethodItem[] {
  const items: MethodItem[] = []
  let depth = 0
  /**
   * 每一层打开着的代码块里是否还没有任何内容，与 depth 同步入栈/出栈。
   *
   * <p>`如果 ()` / `循环 ()` / `否则` 内部一行都没有时，块里没有任何代码行，
   * 那一层的流程线就整段消失了，父层的线看起来断在中途。出栈时若这一层是空的，
   * 就补一行空行（只有流程线、没有文字），线就接上了。</p>
   */
  const empty: boolean[] = []
  let i = 0

  /** 所有内容都走这里入容器，顺带记下「最内层已经有内容了」。 */
  const push = (item: MethodItem) => {
    items.push(item)
    if (empty.length > 0) {
      empty[empty.length - 1] = false
    }
  }

  while (i < bodyLines.length) {
    const raw = bodyLines[i] ?? ''
    const text = raw.trim()
    i += 1
    if (!text) {
      continue
    }
    if (text === '{') {
      depth += 1
      empty.push(true)
      continue
    }
    if (text === '}') {
      // 出栈前先量这一层：补位行的 depth 就是「块内部」的层级
      const inner = depth
      const wasEmpty = empty.pop() ?? false
      depth = Math.max(0, depth - 1)
      // inner > 0 才补：括号不配对时 inner 是 0，补了也是一行什么都没有的空壳
      if (wasEmpty && inner > 0) {
        push({ kind: 'statement', text: '', depth: inner, gap: true })
      }
      continue
    }
    if (text.startsWith('变量 ') || text.startsWith('常量 ')) {
      const kind = text.startsWith('常量 ') ? 'constant' : 'local'
      const decl = readDecl(bodyLines, i - 1, kind === 'constant' ? '常量' : '变量')
      if (decl) {
        push({
          kind,
          decl: { name: decl.name, attrs: decl.attrs },
          depth,
        })
        i = Math.max(i, decl.endLine + 1)
        continue
      }
    }
    push({ kind: 'statement', text, depth })
    if (text.endsWith('{')) {
      depth += 1
      empty.push(true)
    }
  }

  return items
}

function parseMethod(
  lines: string[],
  start: number,
): { method: VolcanoMethod; next: number } | null {
  const decl = readDecl(lines, start, '方法')
  if (!decl) {
    return null
  }
  const parameters: VolcanoDecl[] = []
  let i = decl.endLine + 1
  while (i < lines.length) {
    const param = readDecl(lines, i, '参数')
    if (!param) {
      break
    }
    parameters.push({ name: param.name, attrs: param.attrs })
    i = param.endLine + 1
  }
  const openLine = findBraceLine(lines, i)
  if (openLine < 0) {
    return {
      method: { name: decl.name, attrs: decl.attrs, parameters, items: [] },
      next: i,
    }
  }
  const body = collectBody(lines, openLine)
  return {
    method: {
      name: decl.name,
      attrs: decl.attrs,
      parameters,
      items: parseMethodBody(body.lines),
    },
    next: body.next,
  }
}

function parseClass(
  lines: string[],
  start: number,
  name: string,
  attrs: Attrs,
): { cls: VolcanoClass; next: number } {
  const members: VolcanoDecl[] = []
  const constants: VolcanoDecl[] = []
  const methods: VolcanoMethod[] = []
  // 认不出来的行先留着：可能是粘贴片段里的一段代码，宁可渲染成代码行也不要丢掉
  const loose: string[] = []
  let i = start

  while (i < lines.length) {
    const raw = lines[i] ?? ''
    const text = raw.trim()
    if (!text) {
      i += 1
      continue
    }
    if (text === '}') {
      return {
        cls: {
          name,
          attrs,
          members,
          constants,
          methods,
          loose: parseMethodBody(loose),
        },
        next: i + 1,
      }
    }
    // 类体里的整行注释：不参与渲染，也不该进 loose（否则会跑到类末尾变成代码行）
    if (text.startsWith('//')) {
      i += 1
      continue
    }
    // 文件级声明（<火山程序/> 文件头、包声明）不是类体内容：
    // 无「类」包裹时这个函数是从第 0 行开始扫的，不排掉就会变成一行代码
    if (text.startsWith('<火山程序') || text.startsWith('包 ')) {
      i += 1
      continue
    }
    if (text.startsWith('方法 ')) {
      const parsed = parseMethod(lines, i)
      if (parsed) {
        methods.push(parsed.method)
        i = parsed.next
        continue
      }
    }
    if (text.startsWith('常量 ')) {
      const decl = readDecl(lines, i, '常量')
      if (decl) {
        constants.push({ name: decl.name, attrs: decl.attrs })
        i = decl.endLine + 1
        continue
      }
    }
    if (text.startsWith('变量 ')) {
      const decl = readDecl(lines, i, '变量')
      if (decl) {
        // 类体里（方法之外）的变量就是成员变量，和位置前后无关：
        // 火山导出的文本不标成员/局部，只能靠「在谁的大括号里」判断
        members.push({ name: decl.name, attrs: decl.attrs })
        i = decl.endLine + 1
        continue
      }
    }
    loose.push(raw)
    i += 1
  }

  return {
    cls: { name, attrs, members, constants, methods, loose: parseMethodBody(loose) },
    next: i,
  }
}

/**
 * 跳过 `<火山程序 … />` 文件头与 `包 …` 声明，返回正文首行的下标。
 * 解析「松散片段」时用，避免把固定文件头当成代码行。
 *
 * 注释只在「后面紧跟文件头/包声明」时才当头部噪声跳掉：
 * 片段里的注释是代码的一部分，必须保留成代码行。
 */
function skipHeader(lines: string[]): number {
  const isHeader = (text: string) => text.startsWith('<火山程序') || text.startsWith('包 ')
  let i = 0
  while (i < lines.length) {
    const raw = lines[i] ?? ''
    const text = raw.trim()
    if (!text) {
      i += 1
      continue
    }
    if (text.startsWith('<火山程序')) {
      const open = raw.indexOf('<')
      i = readAngleBlock(lines, i, open).endLine + 1
      continue
    }
    if (text.startsWith('包 ')) {
      const decl = readDecl(lines, i, '包')
      if (decl) {
        i = decl.endLine + 1
        continue
      }
    }
    if (text.startsWith('//')) {
      let next = i + 1
      while (next < lines.length) {
        const probe = (lines[next] ?? '').trim()
        if (!probe || probe.startsWith('//')) {
          next += 1
          continue
        }
        break
      }
      if (next < lines.length && isHeader((lines[next] ?? '').trim())) {
        i += 1
        continue
      }
      return i
    }
    break
  }
  return i
}

export function parseVolcano(text: string): VolcanoProgram {
  const lines = (text ?? '').replace(/\r\n?/g, '\n').split('\n')
  let attrs: Attrs = []
  let pkg: VolcanoPackage | null = null
  const classes: VolcanoClass[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i] ?? ''
    const text = raw.trim()
    if (!text || text.startsWith('//')) {
      i += 1
      continue
    }
    if (text.startsWith('<火山程序')) {
      const open = raw.indexOf('<')
      const block = readAngleBlock(lines, i, open)
      // 去掉标签名「火山程序」，只保留属性
      attrs = parseAttrs(block.content.replace(/^\s*火山程序/, '').replace(/\/\s*$/, ''))
      i = block.endLine + 1
      continue
    }
    if (text.startsWith('包 ')) {
      const decl = readDecl(lines, i, '包')
      if (decl) {
        pkg = { name: decl.name, attrs: decl.attrs }
        i = decl.endLine + 1
        continue
      }
    }
    if (text.startsWith('类 ')) {
      const decl = readDecl(lines, i, '类')
      if (decl) {
        const openLine = findBraceLine(lines, decl.endLine)
        if (openLine < 0) {
          classes.push({
            name: decl.name,
            attrs: decl.attrs,
            members: [],
            constants: [],
            methods: [],
            loose: [],
          })
          i = decl.endLine + 1
          continue
        }
        const parsed = parseClass(lines, openLine + 1, decl.name, decl.attrs)
        classes.push(parsed.cls)
        i = parsed.next
        continue
      }
    }
    i += 1
  }

  // 没有「类」包裹时有两种可能：
  //   ① 复制了「方法 / 常量」声明片段 —— 沿用容器，方法照常渲染
  //   ② 只复制了方法体里的一段代码 —— 变量必须是**局部变量**，其余是代码行
  // 判断依据：出现语句或 变量 就是 ②（没有 类，变量就不可能是成员变量）；
  // 只有 常量 列表时仍按 ① 渲染，避免把一张常量表变成局部常量表。
  let fragment: MethodItem[] = []
  if (classes.length === 0) {
    const hasMethod = lines.some((line) => /^\s*方法[\s<]/.test(line))
    if (!hasMethod) {
      const body = parseMethodBody(lines.slice(skipHeader(lines)))
      if (body.some((item) => item.kind === 'statement' || item.kind === 'local')) {
        fragment = body
      }
    }
    if (fragment.length === 0) {
      const top = parseClass(lines, 0, '', [])
      if (
        top.cls.members.length > 0 ||
        top.cls.constants.length > 0 ||
        top.cls.methods.length > 0 ||
        top.cls.loose.length > 0
      ) {
        classes.push(top.cls)
      }
    }
  }

  return { attrs, pkg, classes, fragment }
}
