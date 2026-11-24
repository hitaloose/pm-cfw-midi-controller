// Virtual TM1637 4-digit module: draws the segment bytes from core/display.ts.

import type { DisplaySegments } from '../core/display'

const W = 56 // digit width
const H = 100 // digit height
const T = 10 // segment thickness
const G = 2 // gap between segments
const PITCH = 76 // distance between digits

const X0 = T / 2
const X1 = W - T / 2
const Y0 = T / 2
const YM = H / 2
const Y1 = H - T / 2

const horiz = (y: number) => {
  const a = X0 + G
  const b = X1 - G
  const h = T / 2
  return `${a},${y} ${a + h},${y - h} ${b - h},${y - h} ${b},${y} ${b - h},${y + h} ${a + h},${y + h}`
}
const vert = (x: number, top: number, bottom: number) => {
  const a = top + G
  const b = bottom - G
  const h = T / 2
  return `${x},${a} ${x + h},${a + h} ${x + h},${b - h} ${x},${b} ${x - h},${b - h} ${x - h},${a + h}`
}

// Index = bit: a b c d e f g
const SEGMENTS = [
  horiz(Y0),
  vert(X1, Y0, YM),
  vert(X1, YM, Y1),
  horiz(Y1),
  vert(X0, YM, Y1),
  vert(X0, Y0, YM),
  horiz(YM),
]

export function SevenSegment({ segments, label }: { segments: DisplaySegments; label: string }) {
  const width = PITCH * (segments.length - 1) + W + 24
  return (
    <div className="tm1637">
      <svg viewBox={`-12 -10 ${width} ${H + 20}`} role="img" aria-label={label}>
        {segments.map((byte, i) => (
          <g key={i} transform={`translate(${i * PITCH} 0) skewX(-6)`}>
            {SEGMENTS.map((points, bit) => (
              <polygon key={bit} points={points} className={byte & (1 << bit) ? 'seg on' : 'seg'} />
            ))}
            <circle cx={W + 8} cy={Y1} r={T / 2} className={byte & 0x80 ? 'seg on' : 'seg'} />
          </g>
        ))}
      </svg>
    </div>
  )
}
