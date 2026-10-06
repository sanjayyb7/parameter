import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Generative background for empty states.
 *
 * A plain grid is always drawn; each cell can be filled with a square or two triangles.
 *
 *   fill         none · square · triangle (cell contents inside the grid)
 *   size         cell size in px
 *   gap          inset of square fills from the grid lines
 *   amplitude    how far each cell's grey drifts from the base tone (0 = flat)
 *   tone         base grey of the fills, 0 = black … 100 = white
 *   fillOpacity  opacity of the fills
 *   gridOpacity  opacity of the grid lines
 *   gridWidth    thickness of the grid lines in px
 *   coverage     share of cells that get a fill
 *   seed         reshuffles which cells get which shade
 *   palette      grey (tone-based only) or colour (grey squares mixed with accent squares)
 *   colour.*     accent colour, share of squares that use it, how strongly it blends
 *                with the grey, and the accent squares' opacity
 *   focus.*      soft radial zone behind the empty-state text: the pattern fades and
 *                blurs towards its centre so copy on top stays readable. No hard edge.
 */
const PATTERN = {
  fill: 'square' as 'none' | 'square' | 'triangle',
  size: 14,
  gap: 0,
  amplitude: 0.07,
  tone: 98,
  fillOpacity: 0.47,
  gridOpacity: 0.15,
  gridWidth: 0.5,
  coverage: 0.12,
  seed: 19,
  palette: 'grey' as 'grey' | 'colour',
  colour: {
    accent: '#1e24ff',
    share: 0.2, // share of filled squares that use the accent; the rest stay grey
    mix: 0.44, // accent strength over the grey: 0 = grey … 1 = pure accent
    opacity: 0.57, // opacity of the accent squares only
  },
  focus: {
    fade: 0.9, // how much the pattern fades at the centre
    blur: 4, // px of blur at the centre
    width: 760,
    height: 520,
    centerY: 32, // % from the top (matches the empty-state message)
  },
}

// Deterministic per-cell noise so the pattern only changes when a dial does.
function rand(i: number, seed: number) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const GRID_LINE = '#e8e8e8'
const grey = (l: number) => `hsl(0 0% ${Math.max(0, Math.min(100, l)).toFixed(1)}%)`

export function PatternBackground() {
  const p = PATTERN
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shapes = useMemo(() => {
    if (p.fill === 'none' || !box.w) return null
    const s = p.size
    const cols = Math.ceil(box.w / s)
    const rows = Math.ceil(box.h / s)
    const jitter = (i: number) => (rand(i, p.seed) * 2 - 1) * p.amplitude
    // Every cell gets its grey from the tone; in colour mode a share of cells are instead
    // tinted with the accent, blended over that same grey (amplitude varies the blend).
    const paint = (i: number): React.CSSProperties => {
      const base = grey(p.tone + jitter(i) * 100)
      if (p.palette !== 'colour' || rand(i + 4441, p.seed) >= p.colour.share) return { fill: base }
      const pct = Math.max(0, Math.min(1, p.colour.mix + jitter(i + 17))) * 100
      return { fill: `color-mix(in oklab, ${p.colour.accent} ${pct.toFixed(1)}%, ${base})`, opacity: p.colour.opacity }
    }
    const drawn = (i: number) => rand(i + 9973, p.seed) < p.coverage
    const out: React.ReactElement[] = []

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const x = c * s
        const y = r * s
        if (p.fill === 'square') {
          if (!drawn(i)) continue
          // Start just past the grid line on the cell's top/left edge.
          const inset = p.gridWidth + p.gap / 2
          const w = Math.max(0, s - p.gridWidth - p.gap)
          out.push(<rect key={i} x={x + inset} y={y + inset} width={w} height={w} style={paint(i)} />)
        } else {
          // Each cell splits along one diagonal into two independently shaded triangles.
          const flip = rand(i + 31, p.seed) < 0.5
          const tris = flip
            ? [
                [x, y, x + s, y, x, y + s],
                [x + s, y, x + s, y + s, x, y + s],
              ]
            : [
                [x, y, x + s, y, x + s, y + s],
                [x, y, x, y + s, x + s, y + s],
              ]
          tris.forEach((t, k) => {
            const j = i * 2 + k
            if (!drawn(j)) return
            out.push(<polygon key={j} points={t.join(',')} style={paint(j)} />)
          })
        }
      }
    }
    return out
  }, [
    p.fill,
    p.size,
    p.gap,
    p.gridWidth,
    p.amplitude,
    p.tone,
    p.coverage,
    p.seed,
    p.palette,
    p.colour.accent,
    p.colour.share,
    p.colour.mix,
    p.colour.opacity,
    box.w,
    box.h,
  ])

  const f = p.focus
  const at = `${f.width / 2}px ${f.height / 2}px at 50% ${f.centerY}%`
  // Pattern opacity eases from (1 - fade) in the middle back to full at the ellipse edge.
  const fadeMask = `radial-gradient(${at}, rgba(0,0,0,${1 - f.fade}) 0%, rgba(0,0,0,${1 - f.fade * 0.75}) 45%, rgba(0,0,0,${1 - f.fade * 0.3}) 75%, #000 100%)`
  // Blur is strongest in the middle and dissolves to nothing before the edge.
  const blurMask = `radial-gradient(${at}, #000 0%, rgba(0,0,0,0.6) 50%, transparent 100%)`

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}>
        {/* Fills sit under the grid so the lines always read cleanly. */}
        <svg width={box.w} height={box.h + 1} className="absolute left-0 -top-px" style={{ opacity: p.fillOpacity }}>
          {shapes}
        </svg>
        <div
          className="absolute inset-x-0 -top-px bottom-0"
          style={{
            opacity: p.gridOpacity,
            backgroundImage: `linear-gradient(to right, ${GRID_LINE} ${p.gridWidth}px, transparent ${p.gridWidth}px), linear-gradient(to bottom, ${GRID_LINE} ${p.gridWidth}px, transparent ${p.gridWidth}px)`,
            backgroundSize: `${p.size}px ${p.size}px`,
          }}
        />
      </div>
      {f.blur > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${f.blur}px)`,
            WebkitBackdropFilter: `blur(${f.blur}px)`,
            maskImage: blurMask,
            WebkitMaskImage: blurMask,
          }}
        />
      )}
    </div>
  )
}
