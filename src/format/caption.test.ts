import { describe, expect, it } from 'vitest'
import { parseCaption } from './caption'

describe('parseCaption', () => {
    it('parses bold', () => {
        expect(parseCaption('a **b** c')).toEqual([
            [
                { kind: 'text', text: 'a ' },
                { kind: 'bold', text: 'b' },
                { kind: 'text', text: ' c' },
            ],
        ])
    })

    it('turns a single newline into a break', () => {
        expect(parseCaption('x\ny')).toEqual([
            [{ kind: 'text', text: 'x' }, { kind: 'break' }, { kind: 'text', text: 'y' }],
        ])
    })

    it('splits paragraphs on blank lines', () => {
        expect(parseCaption('p1\n\np2')).toEqual([[{ kind: 'text', text: 'p1' }], [{ kind: 'text', text: 'p2' }]])
    })

    it('parses italics with * and _', () => {
        expect(parseCaption('*i* and _j_')).toEqual([
            [
                { kind: 'italic', text: 'i' },
                { kind: 'text', text: ' and ' },
                { kind: 'italic', text: 'j' },
            ],
        ])
    })

    it('keeps inline code raw, never HTML', () => {
        expect(parseCaption('`<b>x</b>`')).toEqual([[{ kind: 'code', text: '<b>x</b>' }]])
    })

    it('gives code spans precedence over emphasis', () => {
        expect(parseCaption('`**a**`')).toEqual([[{ kind: 'code', text: '**a**' }]])
    })

    it('keeps unclosed markers literal', () => {
        expect(parseCaption('**open')).toEqual([[{ kind: 'text', text: '**open' }]])
        expect(parseCaption('a `b')).toEqual([[{ kind: 'text', text: 'a `b' }]])
        expect(parseCaption('*x')).toEqual([[{ kind: 'text', text: '*x' }]])
    })

    it('does not treat intraword underscores as italics', () => {
        expect(parseCaption('snake_case_name')).toEqual([[{ kind: 'text', text: 'snake_case_name' }]])
    })

    it('leaves raw HTML as plain text', () => {
        expect(parseCaption('<script>x</script>')).toEqual([[{ kind: 'text', text: '<script>x</script>' }]])
    })

    it('returns no paragraphs for empty or blank input', () => {
        expect(parseCaption('')).toEqual([])
        expect(parseCaption('  \n\n ')).toEqual([])
    })

    it('handles CRLF line endings', () => {
        expect(parseCaption('a\r\nb\r\n\r\nc')).toEqual([
            [{ kind: 'text', text: 'a' }, { kind: 'break' }, { kind: 'text', text: 'b' }],
            [{ kind: 'text', text: 'c' }],
        ])
    })

    it('treats several blank lines as one paragraph separator', () => {
        const expected = [[{ kind: 'text', text: 'p1' }], [{ kind: 'text', text: 'p2' }]]
        expect(parseCaption('p1\n\n\np2')).toEqual(expected)
        expect(parseCaption('p1\n \n \np2')).toEqual(expected)
    })

    it('does not produce dangling breaks at the edges', () => {
        expect(parseCaption('a\n')).toEqual([[{ kind: 'text', text: 'a' }]])
        expect(parseCaption('\na')).toEqual([[{ kind: 'text', text: 'a' }]])
    })

    it('keeps spaced asterisks literal', () => {
        expect(parseCaption('2 * 3 * 4')).toEqual([[{ kind: 'text', text: '2 * 3 * 4' }]])
    })
})
