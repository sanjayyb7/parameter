import { createContext, useContext } from 'react'

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

export function filletPath(cx: number, cy: number, quads: Quadrant[] = ALL, f = 3.5, h = 0.5) {
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
