import { describe, expect, it } from 'vitest'
import { UsageError, parseArgs } from './args'

describe('parseArgs', () => {
    it('parses view with a path containing spaces and --at', () => {
        const dir = String.raw`C:\Projects\My App\web client`
        expect(parseArgs(['view', dir, '--at', '2f'])).toEqual({ kind: 'view', dir, at: '2f' })
    })

    it('parses --port', () => {
        expect(parseArgs(['view', 'd', '--port', '4100'])).toEqual({ kind: 'view', dir: 'd', port: 4100 })
    })

    it('parses --idle-exit in minutes', () => {
        expect(parseArgs(['view', 'd', '--idle-exit', '30'])).toEqual({ kind: 'view', dir: 'd', idleExitMinutes: 30 })
        expect(parseArgs(['view', 'd', '--idle-exit', '0.5'])).toEqual({ kind: 'view', dir: 'd', idleExitMinutes: 0.5 })
    })

    it('parses mcp and help', () => {
        expect(parseArgs(['mcp'])).toEqual({ kind: 'mcp' })
        expect(parseArgs([])).toEqual({ kind: 'help' })
        expect(parseArgs(['--help'])).toEqual({ kind: 'help' })
        expect(parseArgs(['help'])).toEqual({ kind: 'help' })
    })

    it('parses export with one movie folder', () => {
        const dir = String.raw`C:\movies\it's here`
        expect(parseArgs(['export', dir])).toEqual({ kind: 'export', dir })
        expect(() => parseArgs(['export'])).toThrow('chair export <movie dir>')
        expect(() => parseArgs(['export', 'a', 'b'])).toThrow(UsageError)
        expect(() => parseArgs(['export', '--at'])).toThrow(UsageError)
    })

    it('rejects bad input', () => {
        expect(() => parseArgs(['view'])).toThrow(UsageError)
        expect(() => parseArgs(['view'])).toThrow('chair view <dir> [--at <code>] [--port <n>]')
        expect(() => parseArgs(['view', 'd', '--port', 'abc'])).toThrow('--port must be a number')
        expect(() => parseArgs(['view', 'd', '--at', '2F'])).toThrow('invalid step code 2F')
        expect(() => parseArgs(['view', 'd', '--at'])).toThrow(UsageError)
        for (const minutes of ['0', 'abc', '-5']) {
            expect(() => parseArgs(['view', 'd', '--idle-exit', minutes])).toThrow(
                '--idle-exit must be a number of minutes above 0',
            )
        }
        expect(() => parseArgs(['view', 'd', '--idle-exit'])).toThrow(UsageError)
        expect(() => parseArgs(['view', 'd', '--bogus'])).toThrow(UsageError)
        expect(() => parseArgs(['nope'])).toThrow(UsageError)
    })
})
