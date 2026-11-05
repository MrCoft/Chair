export const OVERLAY_SCRIPT = `(() => {
  if (window.__chair) return
  const CURSOR_ID = '__chair_cursor'
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const svgElement = (name, attributes) => {
    const el = document.createElementNS(SVG_NS, name)
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value)
    return el
  }
  const arrow = () => {
    const svg = svgElement('svg', { width: '28', height: '28', viewBox: '0 0 28 28' })
    svg.appendChild(
      svgElement('path', {
        d: 'M4 2 L4 22 L9 17.5 L12.5 25 L16 23.5 L12.5 16.5 L19 16.5 Z',
        fill: '#ffffff',
        stroke: '#111111',
        'stroke-width': '1.6',
        'stroke-linejoin': 'round',
      }),
    )
    return svg
  }
  const place = (el, x, y) => {
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)'
  }
  const cursor = () => {
    let el = document.getElementById(CURSOR_ID)
    if (el) return el
    el = document.createElement('div')
    el.id = CURSOR_ID
    el.appendChild(arrow())
    el.style.cssText =
      'position:fixed;left:0;top:0;width:28px;height:28px;margin:0;padding:0;' +
      'pointer-events:none;z-index:2147483647;'
    place(el, window.innerWidth / 2, window.innerHeight / 2)
    ;(document.body || document.documentElement).appendChild(el)
    return el
  }
  const ensure = () => {
    if (document.body) cursor()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure)
  else ensure()
  window.__chair = {
    move(fromX, fromY, toX, toY, ms) {
      const el = cursor()
      place(el, fromX, fromY)
      if (!(ms > 0)) {
        place(el, toX, toY)
        return Promise.resolve()
      }
      const anim = el.animate(
        [
          { transform: 'translate(' + fromX + 'px,' + fromY + 'px)' },
          { transform: 'translate(' + toX + 'px,' + toY + 'px)' },
        ],
        { duration: ms, easing: 'ease-in-out' },
      )
      place(el, toX, toY)
      return anim.finished.then(() => undefined)
    },
    ripple(x, y) {
      const dot = document.createElement('div')
      dot.style.cssText =
        'position:fixed;left:' + (x - 6) + 'px;top:' + (y - 6) + 'px;width:12px;height:12px;' +
        'border-radius:50%;border:3px solid #ff4081;box-sizing:border-box;' +
        'pointer-events:none;z-index:2147483646;'
      ;(document.body || document.documentElement).appendChild(dot)
      const anim = dot.animate(
        [
          { transform: 'scale(1)', opacity: 0.9 },
          { transform: 'scale(4)', opacity: 0 },
        ],
        { duration: 500, easing: 'ease-out' },
      )
      anim.finished.then(() => dot.remove(), () => dot.remove())
    },
  }
})()`
