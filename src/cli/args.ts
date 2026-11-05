import { STEP_CODE } from '../format/movie'

export type Command =
    | { kind: 'view'; dir: string; at?: string; port?: number; idleExitMinutes?: number }
    | { kind: 'export'; dir: string }
    | { kind: 'mcp' }
    | { kind: 'help' }

export class UsageError extends Error {}

const VIEW_USAGE = 'chair view <dir> [--at <code>] [--port <n>] [--idle-exit <minutes>]'
const VIEW_OPTIONS = new Set(['--at', '--port', '--idle-exit'])
const EXPORT_USAGE = 'chair export <movie dir>'

export function parseArgs(argv: Array<string>): Command {
    const [name, ...rest] = argv
    if (argv.length === 0 || name === 'help' || name === '--help' || name === '-h') return { kind: 'help' }
    if (name === 'mcp') return { kind: 'mcp' }
    if (name === 'export') {
        if (rest.length !== 1 || rest[0].startsWith('--')) throw new UsageError(EXPORT_USAGE)
        return { kind: 'export', dir: rest[0] }
    }
    if (name !== 'view') throw new UsageError(`unknown command: ${name}`)

    let dir: string | undefined
    let at: string | undefined
    let port: number | undefined
    let idleExitMinutes: number | undefined
    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i]
        if (VIEW_OPTIONS.has(arg)) {
            const value = rest[++i]
            if (i >= rest.length) throw new UsageError(`${arg} needs a value — ${VIEW_USAGE}`)
            if (arg === '--at') {
                if (!STEP_CODE.test(value)) throw new UsageError(`invalid step code ${value}`)
                at = value
            } else if (arg === '--port') {
                if (!/^\d+$/.test(value)) throw new UsageError('--port must be a number')
                port = Number(value)
            } else {
                if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
                    throw new UsageError('--idle-exit must be a number of minutes above 0')
                }
                idleExitMinutes = Number(value)
            }
        } else if (arg.startsWith('--') || dir !== undefined) {
            throw new UsageError(`unexpected argument: ${arg} — ${VIEW_USAGE}`)
        } else {
            dir = arg
        }
    }
    if (dir === undefined) throw new UsageError(VIEW_USAGE)
    return {
        kind: 'view',
        dir,
        ...(at === undefined ? {} : { at }),
        ...(port === undefined ? {} : { port }),
        ...(idleExitMinutes === undefined ? {} : { idleExitMinutes }),
    }
}
