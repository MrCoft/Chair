import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)

const paused = new WeakMap<HTMLMediaElement, boolean>()

Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement) {
        return paused.get(this) ?? true
    },
})

HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
    paused.set(this, false)
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
}

HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
    paused.set(this, true)
    this.dispatchEvent(new Event('pause'))
}

window.scrollTo = () => {}

Element.prototype.scrollIntoView = function scrollIntoView() {}
