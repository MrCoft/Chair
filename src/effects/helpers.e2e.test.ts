import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { Camera } from '../recorder/camera'
import { OVERLAY_SCRIPT } from './overlay'
import { DEFAULT_PACING, createHelpers } from './helpers'
import type { Frame } from '../recorder/timeline'
import type { Browser, Page } from 'playwright'

const fixture = (name: string) => pathToFileURL(resolve('test', 'fixtures', 'site', name)).href
const pacing = { markMs: 80, cursorMs: 60, typeDelayMs: 40, afterMs: 20 }

let browser: Browser
let page: Page
let logs: Array<[string, string | undefined]>
const log = (kind: string, target?: string) => {
    logs.push([kind, target])
}

beforeAll(async () => {
    browser = await chromium.launch()
})
afterAll(async () => {
    await browser.close()
})
beforeEach(async () => {
    logs = []
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
    await context.addInitScript(OVERLAY_SCRIPT)
    page = await context.newPage()
    await page.goto(fixture('index.html'))
})

it('has sensible default pacing', () => {
    expect(DEFAULT_PACING).toEqual({ markMs: 1200, cursorMs: 1000, typeDelayMs: 140, afterMs: 1000 })
})

it('click moves the cursor, clicks and logs', async () => {
    const h = createHelpers(page, log, pacing)
    await h.click(page.getByRole('button', { name: 'Add' }))
    expect(await page.locator('#count').textContent()).toBe('1')
    expect(await page.locator('#__chair_cursor').isVisible()).toBe(true)
    expect(logs).toEqual([['click', "getByRole('button', { name: 'Add' })"]])
})

it('type types slowly and logs', async () => {
    const h = createHelpers(page, log, pacing)
    const started = Date.now()
    await h.type(page.getByLabel('Name'), 'abc')
    expect(Date.now() - started).toBeGreaterThanOrEqual(3 * pacing.typeDelayMs)
    expect(await page.locator('#name').inputValue()).toBe('abc')
    expect(logs).toEqual([['type', "getByLabel('Name')"]])
})

it('hover moves the cursor without a click ripple', async () => {
    await page.evaluate(() => {
        const win = window as unknown as { __ripples: number; __chair: { ripple: (x: number, y: number) => void } }
        const ripple = win.__chair.ripple
        win.__ripples = 0
        win.__chair.ripple = (x, y) => {
            win.__ripples += 1
            ripple(x, y)
        }
    })
    const ripples = () => page.evaluate(() => (window as unknown as { __ripples: number }).__ripples)
    const h = createHelpers(page, log, pacing)
    await h.hover(page.getByRole('button', { name: 'Add' }))
    expect(await ripples()).toBe(0)
    await h.click(page.getByRole('button', { name: 'Add' }))
    expect(await ripples()).toBe(1)
    expect(logs.map(([kind]) => kind)).toEqual(['hover', 'click'])
})

it('draws the cursor on a page that enforces Trusted Types', async () => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(fixture('trusted-types.html'))
    const h = createHelpers(page, log, pacing)
    await h.click(page.getByRole('button', { name: 'Add' }))
    expect(await page.locator('#__chair_cursor svg path').count()).toBe(1)
    expect(errors).toEqual([])
})

it('mark restores the original outline', async () => {
    await page.locator('#add').evaluate((el) => {
        ;(el as HTMLElement).style.outline = 'green dotted 1px'
    })
    const h = createHelpers(page, log, pacing)
    await h.mark(page.locator('#add'))
    expect(await page.locator('#add').evaluate((el) => (el as HTMLElement).style.outline)).toBe('green dotted 1px')
    await h.mark(page.locator('#count'))
    expect(await page.locator('#count').evaluate((el) => (el as HTMLElement).style.outline)).toBe('')
})

it('cursor survives navigation', async () => {
    const h = createHelpers(page, log, pacing)
    await h.click(page.getByRole('button', { name: 'Add' }))
    await h.goto(fixture('second.html'))
    await h.click(page.getByRole('button', { name: 'Back' }))
    await page.waitForURL(/index\.html/)
    expect(await page.locator('#__chair_cursor').count()).toBe(1)
})

it('camera delivers frames while running', async () => {
    const dir = resolve('test-output', 'camera', "it's here")
    rmSync(dir, { recursive: true, force: true })
    const frames: Array<Frame> = []
    const camera = new Camera(
        page,
        dir,
        (f) => frames.push(f),
        () => true,
    )
    await camera.start()
    const h = createHelpers(page, log, pacing)
    await h.click(page.getByRole('button', { name: 'Add' }))
    await h.click(page.getByRole('button', { name: 'Add' }))
    await camera.stop()
    expect(readdirSync(dir).filter((f) => f.endsWith('.jpg')).length).toBeGreaterThanOrEqual(1)
    expect(frames.length).toBeGreaterThanOrEqual(1)
    expect(frames.every((f) => existsSync(f.file))).toBe(true)
    const snap = await camera.snapshotFrame()
    expect(existsSync(snap.file)).toBe(true)
    expect(frames.at(-1)).toEqual(snap)
})
