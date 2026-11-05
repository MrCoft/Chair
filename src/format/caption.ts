export type Inline = { kind: 'text' | 'bold' | 'italic' | 'code'; text: string } | { kind: 'break' }
export type Paragraph = Array<Inline>

function isWordChar(ch: string | undefined): boolean {
    return ch !== undefined && /[\p{L}\p{N}]/u.test(ch)
}

function findCloser(line: string, marker: string, from: number): number {
    const end = line.indexOf(marker, from)
    return end > from ? end : -1
}

function parseLine(line: string, out: Array<Inline>): void {
    let buffer = ''
    const flush = () => {
        if (buffer) out.push({ kind: 'text', text: buffer })
        buffer = ''
    }
    let i = 0
    while (i < line.length) {
        const ch = line[i]
        let marker = ''
        let kind: 'bold' | 'italic' | 'code' | undefined
        if (ch === '`') {
            marker = '`'
            kind = 'code'
        } else if (line.startsWith('**', i)) {
            marker = '**'
            kind = 'bold'
        } else if ((ch === '*' || (ch === '_' && !isWordChar(line[i - 1]))) && !/\s/.test(line[i + 1] ?? ' ')) {
            marker = ch
            kind = 'italic'
        }
        if (kind) {
            const end = findCloser(line, marker, i + marker.length)
            const closesCleanly = kind !== 'italic' || marker !== '_' || !isWordChar(line[end + 1])
            if (end !== -1 && closesCleanly) {
                flush()
                out.push({ kind, text: line.slice(i + marker.length, end) })
                i = end + marker.length
                continue
            }
        }
        buffer += ch
        i += 1
    }
    flush()
}

export function parseCaption(text: string): Array<Paragraph> {
    return text
        .replace(/\r\n?/g, '\n')
        .split(/\n(?:[ \t]*\n)+/)
        .filter((block) => block.trim() !== '')
        .map((block) => {
            const paragraph: Paragraph = []
            block
                .replace(/^\n+|\n+$/g, '')
                .split('\n')
                .forEach((line, index) => {
                    if (index > 0) paragraph.push({ kind: 'break' })
                    parseLine(line, paragraph)
                })
            return paragraph
        })
}
