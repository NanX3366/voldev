export type AttrValue = string | true

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

  loose: MethodItem[]
}

export type VolcanoPackage = {
  name: string
  attrs: Attrs
}

export type VolcanoProgram = {
  pkg: VolcanoPackage | null
  classes: VolcanoClass[]

  fragment: MethodItem[]
}

const DECL_RES = new Map<string, RegExp>()

function declRe(keyword: string): RegExp {
  let re = DECL_RES.get(keyword)
  if (!re) {
    re = new RegExp(`^\\s*${keyword}\\s+([^\\s<]+)`)
    DECL_RES.set(keyword, re)
  }
  return re
}

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
  const match = text.match(declRe(keyword))
  if (!match) {
    return null
  }
  const name = match[1] ?? ''
  const open = text.indexOf('<', match.index ?? 0)

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

  const empty: boolean[] = []
  let i = 0

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

      const inner = depth
      const wasEmpty = empty.pop() ?? false
      depth = Math.max(0, depth - 1)

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

    if (text.startsWith('//')) {
      i += 1
      continue
    }

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
      i = readAngleBlock(lines, i, raw.indexOf('<')).endLine + 1
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

  return { pkg, classes, fragment }
}
