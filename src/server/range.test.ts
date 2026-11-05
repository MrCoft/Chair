import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileResponse, parseRange } from './range'

describe('parseRange', () => {
    it('parses closed, open and suffix ranges', () => {
        expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
        expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
        expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
        expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 })
    })
    it('flags unsatisfiable or malformed ranges', () => {
        expect(parseRange('bytes=2000-', 1000)).toBe('invalid')
        expect(parseRange('bytes=50-10', 1000)).toBe('invalid')
        expect(parseRange('bytes=abc', 1000)).toBe('invalid')
    })
    it('no header means no range', () => {
        expect(parseRange(null, 1000)).toBeNull()
    })
})

describe('fileResponse', () => {
    let dir: string
    let file: string
    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'chair range '))
        file = join(dir, 'movie.mp4')
        await writeFile(file, Buffer.alloc(1000, 7))
    })
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    it('serves a partial response', async () => {
        const res = await fileResponse(file, new Request('http://x/media/a', { headers: { Range: 'bytes=0-99' } }))
        expect(res.status).toBe(206)
        expect(res.headers.get('Content-Range')).toBe('bytes 0-99/1000')
        expect(res.headers.get('Content-Type')).toBe('video/mp4')
        expect((await res.arrayBuffer()).byteLength).toBe(100)
    })

    it('serves the whole file without Range', async () => {
        const res = await fileResponse(file, new Request('http://x/media/a'))
        expect(res.status).toBe(200)
        expect(res.headers.get('Accept-Ranges')).toBe('bytes')
        expect(res.headers.get('Content-Length')).toBe('1000')
        expect((await res.arrayBuffer()).byteLength).toBe(1000)
    })

    it('answers 416 for an unsatisfiable range', async () => {
        const res = await fileResponse(file, new Request('http://x/media/a', { headers: { Range: 'bytes=2000-' } }))
        expect(res.status).toBe(416)
        expect(res.headers.get('Content-Range')).toBe('bytes */1000')
    })

    it('rejects for a missing file', async () => {
        await expect(fileResponse(join(dir, 'gone.mp4'), new Request('http://x/'))).rejects.toThrow()
    })
})
