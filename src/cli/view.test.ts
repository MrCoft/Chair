import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { repoRoot, runView, viewerEntry } from './view'

const { open } = vi.hoisted(() => ({ open: vi.fn(() => Promise.resolve()) }))
vi.mock('open', () => ({ default: open }))

const temps: Array<string> = []
const makeTemp = () => {
    const dir = mkdtempSync(join(tmpdir(), "chair it's "))
    temps.push(dir)
    return dir
}
afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fakeViewer(lifetimeMs: number): { root: string; record: string } {
    const root = makeTemp()
    const record = join(root, 'record.json')
    mkdirSync(join(root, '.output', 'server'), { recursive: true })
    writeFileSync(
        viewerEntry(root),
        `import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
writeFileSync(${JSON.stringify(record)}, JSON.stringify({
    execArgv: process.execArgv,
    idleMs: process.env.CHAIR_IDLE_EXIT_MS ?? null,
}))
createServer((request, response) => response.end('ok')).listen(Number(process.env.PORT), process.env.HOST)
setTimeout(() => process.exit(0), ${lifetimeMs})
`,
    )
    return { root, record }
}

const recorded = (record: string): unknown => JSON.parse(readFileSync(record, 'utf8'))

describe('runView', () => {
    it('rejects a missing folder', async () => {
        const dir = join(makeTemp(), 'missing folder')
        await expect(runView({ kind: 'view', dir }, makeTemp())).rejects.toThrow(`no such folder: ${dir}`)
    })

    it('rejects when the viewer is not built', async () => {
        const dir = join(makeTemp(), 'movies')
        mkdirSync(dir)
        const root = makeTemp()
        await expect(runView({ kind: 'view', dir }, root)).rejects.toThrow(
            `Viewer not built — run \`pnpm build\` in ${root}`,
        )
    })
})

describe('runView lifetime', () => {
    beforeEach(() => {
        open.mockClear()
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('with --idle-exit, the server and the wrapper exit once nobody asks for a while', async () => {
        const { root, record } = fakeViewer(4000)
        const started = Date.now()
        await runView({ kind: 'view', dir: makeTemp(), idleExitMinutes: 0.01 }, root)
        expect(Date.now() - started).toBeLessThan(3000)
        expect(recorded(record)).toEqual({
            execArgv: ['--import', pathToFileURL(resolve('src', 'cli', 'idleExit.ts')).href],
            idleMs: '600',
        })
        expect(open).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/$/))
    })

    it('without --idle-exit, the server keeps serving until it is stopped', async () => {
        const { root, record } = fakeViewer(1500)
        const started = Date.now()
        await runView({ kind: 'view', dir: makeTemp() }, root)
        expect(Date.now() - started).toBeGreaterThanOrEqual(1500)
        expect(recorded(record)).toEqual({ execArgv: [], idleMs: null })
    })
})

describe('paths', () => {
    it('finds the repo root and viewer entry', () => {
        expect(viewerEntry(repoRoot())).toBe(join(repoRoot(), '.output', 'server', 'index.mjs'))
    })
})
