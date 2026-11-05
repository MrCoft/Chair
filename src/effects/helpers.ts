import type { Locator, Page, Response } from 'playwright'

export type Pacing = { markMs: number; cursorMs: number; typeDelayMs: number; afterMs: number }

export const DEFAULT_PACING: Pacing = { markMs: 1200, cursorMs: 1000, typeDelayMs: 140, afterMs: 1000 }

export type Helpers = {
    mark: (l: Locator, ms?: number) => Promise<void>
    click: (l: Locator, ms?: number) => Promise<void>
    type: (l: Locator, text: string) => Promise<void>
    press: (key: string) => Promise<void>
    hover: (l: Locator) => Promise<void>
    goto: (url: string) => Promise<void>
    wait: (ms: number) => Promise<void>
    waitForResponse: (urlPart: string, timeoutMs?: number) => Promise<Response>
    log: (kind: string, target?: string) => void
}

type ChairWindow = {
    __chair?: {
        move: (fromX: number, fromY: number, toX: number, toY: number, ms: number) => Promise<void>
        ripple: (x: number, y: number) => void
    }
}

const OUTLINE = '3px solid #ff4081'
const OUTLINE_OFFSET = '2px'

export function createHelpers(page: Page, log: (kind: string, target?: string) => void, pacing: Pacing): Helpers {
    const viewport = page.viewportSize()
    let last = { x: (viewport?.width ?? 1280) / 2, y: (viewport?.height ?? 720) / 2 }

    const pause = (ms: number) => (ms > 0 ? page.waitForTimeout(ms) : Promise.resolve())

    const mark = async (l: Locator, ms: number = pacing.markMs): Promise<void> => {
        const previous = await l.evaluate(
            (el, style) => {
                const target = el as HTMLElement
                const saved = { outline: target.style.outline, offset: target.style.outlineOffset }
                target.style.outline = style.outline
                target.style.outlineOffset = style.offset
                return saved
            },
            { outline: OUTLINE, offset: OUTLINE_OFFSET },
        )
        try {
            await pause(ms)
        } finally {
            await l
                .evaluate((el, saved) => {
                    const target = el as HTMLElement
                    target.style.outline = saved.outline
                    target.style.outlineOffset = saved.offset
                }, previous)
                .catch(() => undefined)
        }
    }

    const approach = async (l: Locator, ms: number, effects: { ripple: boolean }): Promise<void> => {
        await l.scrollIntoViewIfNeeded()
        const box = await l.boundingBox()
        if (!box) throw new Error(`Cannot find a position for ${String(l)}`)
        const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        const from = last
        last = to
        await page.evaluate(
            ([fx, fy, tx, ty, duration]) => (window as unknown as ChairWindow).__chair?.move(fx, fy, tx, ty, duration),
            [from.x, from.y, to.x, to.y, pacing.cursorMs] as const,
        )
        await mark(l, ms)
        if (!effects.ripple) return
        await page.evaluate(([x, y]) => (window as unknown as ChairWindow).__chair?.ripple(x, y), [to.x, to.y] as const)
    }

    return {
        mark,
        async click(l, ms = pacing.markMs) {
            await approach(l, ms, { ripple: true })
            await l.click()
            await pause(pacing.afterMs)
            log('click', String(l))
        },
        async type(l, text) {
            await approach(l, pacing.markMs, { ripple: true })
            await l.click()
            await page.keyboard.type(text, { delay: pacing.typeDelayMs })
            await pause(pacing.afterMs)
            log('type', String(l))
        },
        async press(key) {
            await page.keyboard.press(key)
            await pause(pacing.afterMs)
            log('press', key)
        },
        async hover(l) {
            await approach(l, pacing.markMs, { ripple: false })
            await l.hover()
            await pause(pacing.afterMs)
            log('hover', String(l))
        },
        async goto(url) {
            await page.goto(url)
            await pause(pacing.afterMs)
            log('goto', url)
        },
        wait: (ms) => page.waitForTimeout(ms),
        waitForResponse: (urlPart, timeoutMs = 30000) =>
            page.waitForResponse((r) => r.url().includes(urlPart), { timeout: timeoutMs }),
        log,
    }
}
