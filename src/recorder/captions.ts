import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { parseCaption } from '../format/caption'
import { CAPTIONED_VIDEO, movieSchema } from '../format/movie'
import { defaultFfmpeg, runFfmpeg } from './encode'
import type { Inline } from '../format/caption'
import type { Step } from '../format/movie'

export type Size = { width: number; height: number }
export type CaptionImage = { file: string; startMs: number; endMs: number; x: number; y: number }

const PLAYER_WIDTH = 1280

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (ch) => ENTITIES[ch])

const inlineHtml = (part: Inline): string => {
    switch (part.kind) {
        case 'break':
            return '<br>'
        case 'bold':
            return `<strong>${escapeHtml(part.text)}</strong>`
        case 'italic':
            return `<em>${escapeHtml(part.text)}</em>`
        case 'code':
            return `<code>${escapeHtml(part.text)}</code>`
        case 'text':
            return escapeHtml(part.text)
    }
}

export function captionHtml(step: Pick<Step, 'code' | 'title' | 'text'>, size: Size): string {
    const scale = size.width / PLAYER_WIDTH
    const px = (n: number) => `${Number((n * scale).toFixed(2))}px`
    const paragraphs = parseCaption(step.text)
        .map((paragraph) => `<p>${paragraph.map(inlineHtml).join('')}</p>`)
        .join('')
    const style = [
        'html,body{margin:0;background:transparent}',
        `#box{position:absolute;left:${Math.round(size.width * 0.025)}px;bottom:${Math.round(size.height * 0.04)}px;` +
            `max-width:${Math.round(size.width * 0.52)}px;box-sizing:border-box;border:${px(2)} solid #ffcc66;` +
            `border-radius:${px(8)};background:rgba(18,22,48,0.94);padding:${px(12)} ${px(16)};color:#fff;` +
            `font:${px(15)}/1.375 "Segoe UI",system-ui,sans-serif}`,
        '#title{margin:0;font-weight:700;color:#ffcc66}',
        `#text{margin-top:${px(4)}}`,
        `#text p{margin:${px(6)} 0 0}`,
        '#text p:first-child{margin-top:0}',
        'strong{font-weight:600}',
        `code{font-family:Consolas,ui-monospace,monospace;font-size:0.9em;background:rgba(255,255,255,0.1);` +
            `border-radius:${px(4)};padding:0 ${px(4)}}`,
    ].join('')
    return (
        `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>` +
        `<div id="box"><p id="title">${escapeHtml(step.code)} · ${escapeHtml(step.title)}</p>` +
        `<div id="text">${paragraphs}</div></div></body></html>`
    )
}

export function captionFilter(images: Array<CaptionImage>): string {
    if (images.length === 0) return '[0:v]null[out]'
    const seconds = (ms: number) => (ms / 1000).toFixed(3)
    return images
        .map((image, index) => {
            const from = index === 0 ? '[0:v]' : `[v${index}]`
            const to = index === images.length - 1 ? '[out]' : `[v${index + 1}]`
            const when = `gte(t,${seconds(image.startMs)})*lt(t,${seconds(image.endMs)})`
            return `${from}[${index + 1}:v]overlay=x=${image.x}:y=${image.y}:enable='${when}'${to}`
        })
        .join(';')
}

export function parseVideoSize(stderr: string): Size | null {
    const match = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(stderr)
    return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

async function videoSize(file: string, ffmpegPath: string): Promise<Size> {
    const size = parseVideoSize(await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', file], true))
    if (!size) throw new Error(`could not read the video size of ${file}`)
    return size
}

async function renderCaptionImages(steps: Array<Step>, size: Size, outDir: string): Promise<Array<CaptionImage>> {
    const browser = await chromium.launch({ headless: true })
    try {
        const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 })
        const images: Array<CaptionImage> = []
        for (const [index, step] of steps.entries()) {
            if (step.durationMs <= 0) continue
            await page.setContent(captionHtml(step, size))
            const box = page.locator('#box')
            const bounds = await box.boundingBox()
            if (!bounds) throw new Error(`the caption of step ${step.code} did not render`)
            const file = join(outDir, `caption-${String(index).padStart(3, '0')}.png`)
            await box.screenshot({ path: file, omitBackground: true })
            images.push({
                file,
                startMs: step.startMs,
                endMs: step.startMs + step.durationMs,
                x: Math.floor(bounds.x),
                y: Math.floor(bounds.y),
            })
        }
        return images
    } finally {
        await browser.close()
    }
}

export async function exportCaptioned(dir: string, ffmpegPath = defaultFfmpeg()): Promise<string> {
    const movie = movieSchema.parse(JSON.parse(await readFile(join(dir, 'movie.json'), 'utf8')))
    const video = join(dir, movie.video)
    const size = await videoSize(video, ffmpegPath)
    const work = join(dir, '.captions-work')
    const out = join(dir, CAPTIONED_VIDEO)
    const partial = join(dir, `${CAPTIONED_VIDEO}.partial.mp4`)
    await mkdir(work, { recursive: true })
    try {
        const images = await renderCaptionImages(movie.steps, size, work)
        await runFfmpeg(ffmpegPath, [
            '-y',
            '-nostdin',
            '-i',
            video,
            ...images.flatMap((image) => ['-i', image.file]),
            '-filter_complex',
            captionFilter(images),
            '-map',
            '[out]',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            partial,
        ])
        await rename(partial, out)
        return out
    } finally {
        await rm(work, { recursive: true, force: true })
        await rm(partial, { force: true })
    }
}
