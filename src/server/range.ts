import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { NotFoundError, resolveMediaPath } from './library.server'

const CONTENT_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.json': 'application/json',
}

export const parseRange = (header: string | null, size: number): { start: number; end: number } | 'invalid' | null => {
    if (header === null) return null
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
    if (!match || (match[1] === '' && match[2] === '')) return 'invalid'

    let start: number
    let end: number
    if (match[1] === '') {
        const suffix = Number(match[2])
        if (suffix === 0) return 'invalid'
        start = Math.max(0, size - suffix)
        end = size - 1
    } else {
        start = Number(match[1])
        end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
    }
    if (start >= size || start > end) return 'invalid'
    return { start, end }
}

const streamOf = (path: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> =>
    Readable.toWeb(createReadStream(path, range)) as ReadableStream<Uint8Array>

export const fileResponse = async (path: string, request: Request): Promise<Response> => {
    const { size } = await stat(path)
    const headers: Record<string, string> = {
        'Content-Type': CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
    }
    const range = parseRange(request.headers.get('range'), size)

    if (range === 'invalid') {
        return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
    }
    if (range === null) {
        return new Response(streamOf(path), { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
    }
    return new Response(streamOf(path, range), {
        status: 206,
        headers: {
            ...headers,
            'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
            'Content-Length': String(range.end - range.start + 1),
        },
    })
}

export const mediaHandler = async (root: string | undefined, splat: string, request: Request): Promise<Response> => {
    if (!root) return new Response('CHAIR_DIR is not set', { status: 500 })
    try {
        const path = resolveMediaPath(root, splat)
        if (!(await stat(path)).isFile()) throw new NotFoundError('not a file')
        return await fileResponse(path, request)
    } catch (error) {
        if (error instanceof NotFoundError || (error as NodeJS.ErrnoException).code === 'ENOENT') {
            return new Response('No such file.', { status: 404 })
        }
        throw error
    }
}
