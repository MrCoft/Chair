import { describe, expect, it } from 'vitest'
import { captionFilter, captionHtml, parseVideoSize } from './captions'

const size = { width: 1600, height: 900 }

describe('captionHtml', () => {
    it('renders the code, title and Markdown caption, escaping HTML', () => {
        const html = captionHtml({ code: '2f', title: 'Save <now>', text: 'Press **Save** & see `toast`.' }, size)

        expect(html).toContain('2f · Save &lt;now&gt;')
        expect(html).toContain('Press <strong>Save</strong> &amp; see <code>toast</code>.')
        expect(html).not.toContain('<now>')
    })

    it('scales the box to the video, as the viewer shows it on a 1280 px wide player', () => {
        const html = captionHtml({ code: '1', title: 'T', text: 'x' }, size)

        expect(html).toContain('left:40px')
        expect(html).toContain('bottom:36px')
        expect(html).toContain('max-width:832px')
        expect(html).toContain('font:18.75px/1.375')
    })
})

describe('captionFilter', () => {
    it('overlays each caption only during its step', () => {
        const filter = captionFilter([
            { file: 'a.png', startMs: 0, endMs: 4000, x: 40, y: 760 },
            { file: 'b.png', startMs: 4000, endMs: 9500, x: 40, y: 740 },
        ])

        expect(filter).toBe(
            "[0:v][1:v]overlay=x=40:y=760:enable='gte(t,0.000)*lt(t,4.000)'[v1];" +
                "[v1][2:v]overlay=x=40:y=740:enable='gte(t,4.000)*lt(t,9.500)'[out]",
        )
    })

    it('passes the video through when there is nothing to overlay', () => {
        expect(captionFilter([])).toBe('[0:v]null[out]')
    })
})

describe('parseVideoSize', () => {
    it('reads the size from ffmpeg output', () => {
        const stderr =
            '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt470bg/unknown/unknown, progressive), 1600x900 [SAR 1:1 DAR 16:9], 727 kb/s, 30 fps'
        expect(parseVideoSize(stderr)).toEqual({ width: 1600, height: 900 })
    })

    it('returns null when there is no video stream', () => {
        expect(parseVideoSize('Input #0, mp3, from x.mp3')).toBeNull()
    })
})
