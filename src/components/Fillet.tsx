import { createContext, useContext, useLayoutEffect, useRef } from 'react'

/**
 * Filled fillets for structural UI lines (sidebar edge, top bar, tabs, toolbar, table
 * header). Where two 1px rules meet, each inside corner is filled with a concave
 * quarter-curve so the lines flow into each other instead of meeting square.
 *
 * The joint's centre always lands on a half pixel (the middle of a 1px line), so the SVG
 * box is sized to an odd number of pixels and positioned on whole pixels: the curve then
 * rasterises crisply and sits flush against both lines instead of blurring half a pixel off.
 */

export type Quadrant = 'tl' | 'tr' | 'bl' | 'br'
const ALL: Quadrant[] = ['tl', 'tr', 'bl', 'br']
const LINE = '#ebebeb'

/** Fillet radius in px. */
export const FilletRadius = createContext(8)

// h is where each curve starts, measured from the line's centre. -0.5 starts it on the far edge of
// the 1px line, so the fillet overlaps the line it meets instead of butting against it: browsers
// snap borders to whole screen pixels but draw the curve where it falls, and at display scales
// like 1.25× or 1.5× that left a hairline gap. Same colour, so the overlap is invisible.
export function filletPath(cx: number, cy: number, quads: Quadrant[] = ALL, f = 3.5, h = -0.5) {
  if (f <= 0) return ''
  const p: Record<Quadrant, string> = {
    tl: `M${cx - h},${cy - h}L${cx - h},${cy - h - f}A${f},${f} 0 0 1 ${cx - h - f},${cy - h}Z`,
    tr: `M${cx + h},${cy - h}L${cx + h + f},${cy - h}A${f},${f} 0 0 1 ${cx + h},${cy - h - f}Z`,
    br: `M${cx + h},${cy + h}L${cx + h},${cy + h + f}A${f},${f} 0 0 1 ${cx + h + f},${cy + h}Z`,
    bl: `M${cx - h},${cy + h}L${cx - h - f},${cy + h}A${f},${f} 0 0 1 ${cx - h},${cy + h + f}Z`,
  }
  return quads.map((q) => p[q]).join('')
}

/** Odd-sized box (px) big enough for the radius, plus the offset of its centre. */
function box(f: number) {
  const size = 2 * Math.ceil(f + 1) + 1
  return { size, c: size / 2 } // c is always n + 0.5
}

function Svg({ quads, place }: { quads: Quadrant[]; place: (c: number) => React.CSSProperties }) {
  const f = useContext(FilletRadius)
  const { size, c } = box(f)
  return (
    <svg aria-hidden width={size} height={size} className="pointer-events-none absolute z-10 overflow-visible" style={place(c)}>
      <path d={filletPath(c, c, quads, f)} fill={LINE} shapeRendering="geometricPrecision" />
    </svg>
  )
}

/** Joint centred on (x, y) inside a `relative` parent. x and y should be n + 0.5 (a line's centre). */
export function Joint({ x, y, quads = ALL }: { x: number; y: number; quads?: Quadrant[] }) {
  return <Svg quads={quads} place={(c) => ({ left: Math.round(x - c), top: Math.round(y - c) })} />
}

/**
 * Joint where this element's own top/bottom border meets the vertical rule just outside
 * its left edge (the sidebar's right border) or on its right edge (its own border-r).
 * Parent must be `relative`.
 */
export function EdgeJoint({ edge, line, quads }: { edge: 'left' | 'right'; line: 'top' | 'bottom'; quads: Quadrant[] }) {
  // A 1px line sits on the element's first/last pixel row, so its centre is 0.5px inside.
  return (
    <Svg
      quads={quads}
      place={(c) => ({
        ...(edge === 'left' ? { left: -0.5 - c } : { right: 0.5 - c }),
        ...(line === 'top' ? { top: 0.5 - c } : { bottom: 0.5 - c }),
      })}
    />
  )
}

/**
 * Whole-pixel columns for tile grids that sit on the line colour with 1px gaps. `fr` columns
 * land on fractional pixels, which smears each 1px gap into two faint half-lines that the
 * fillets no longer meet. This sizes each column in whole pixels (weights like [3, 2] act as
 * 3fr 2fr), handing the leftover pixels to the first columns. Attach the ref to a `grid`.
 */
export function usePixelColumns<T extends HTMLElement>(weights: number[]) {
  const ref = useRef<T>(null)
  const key = weights.join(',')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = key.split(',').map(Number)
    const fit = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0
      const free = Math.floor(el.clientWidth - gap * (w.length - 1))
      const total = w.reduce((a, b) => a + b, 0)
      const cols = w.map((x) => Math.floor((free * x) / total))
      let rest = free - cols.reduce((a, b) => a + b, 0)
      for (let i = 0; rest > 0; i = (i + 1) % cols.length, rest--) cols[i]++
      el.style.gridTemplateColumns = cols.map((c) => `${c}px`).join(' ')
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [key])
  return ref
}
