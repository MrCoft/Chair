import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { spawnDetachedView } from './spawn'

const { child, spawn } = vi.hoisted(() => {
    const fakeChild = {
        on: vi.fn((_event: string, _listener: (error: Error) => void): unknown => fakeChild),
        unref: vi.fn(),
    }
    return { child: fakeChild, spawn: vi.fn(() => fakeChild) }
})
vi.mock('node:child_process', () => ({ spawn }))

const detached = { detached: true, stdio: 'ignore', windowsHide: true }
const temps: Array<string> = []

function makeRoot({ built }: { built: boolean }): string {
    const root = mkdtempSync(join(tmpdir(), "chair it's root "))
    temps.push(root)
    if (built) {
        mkdirSync(join(root, '.output', 'server'), { recursive: true })
        writeFileSync(join(root, '.output', 'server', 'index.mjs'), '')
    }
    return root
}

beforeEach(() => {
    spawn.mockClear()
    child.on.mockClear()
    child.unref.mockClear()
})
afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

it('starts chair view detached, lets it outlive the caller and exit when idle', () => {
    const root = makeRoot({ built: true })
    const dir = "C:\\Projects\\My App\\web client\\it's here"
    expect(spawnDetachedView(dir, { root })).toBeNull()
    expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        [join(root, 'bin', 'chair.mjs'), 'view', dir, '--idle-exit', '30'],
        detached,
    )
    expect(child.unref).toHaveBeenCalled()
})

it('passes --at when given a step code', () => {
    const root = makeRoot({ built: true })
    spawnDetachedView('movies', { at: '2f', root })
    expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        [join(root, 'bin', 'chair.mjs'), 'view', 'movies', '--at', '2f', '--idle-exit', '30'],
        detached,
    )
})

it('reports an unbuilt viewer instead of spawning one that fails unseen', () => {
    const root = makeRoot({ built: false })
    const dir = "C:\\movies\\it's here"
    expect(spawnDetachedView(dir, { root })).toBe(
        `viewer not built — run pnpm build in ${root}, then chair view "${dir}"`,
    )
    expect(spawn).not.toHaveBeenCalled()
})

it('handles a failed spawn instead of crashing the caller', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    spawnDetachedView('movies', { root: makeRoot({ built: true }) })
    expect(child.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(child.on.mock.invocationCallOrder[0]).toBeLessThan(child.unref.mock.invocationCallOrder[0])
    const [, onError] = child.on.mock.calls[0]
    expect(() => onError(new Error('spawn ENOENT'))).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('spawn ENOENT'))
    warn.mockRestore()
})
