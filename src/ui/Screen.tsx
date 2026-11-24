// 128×64 1-bit OLED. Text is rasterised and thresholded to on/off pixels,
// then tinted like the real panel (bicolor SSD1306: yellow header, blue body).

import { useEffect, useRef, useState } from 'react'
import type { ScreenModel } from '../core/view'

export type PanelColor = 'yellow-blue' | 'white' | 'blue'

const W = 128
const H = 64
const HEADER_H = 16
const FONT = '"Press Start 2P"'

const PANEL: Record<PanelColor, { head: string; body: string }> = {
  'yellow-blue': { head: '#FFD23F', body: '#4FC3FF' },
  white: { head: '#EAF2FF', body: '#EAF2FF' },
  blue: { head: '#4FC3FF', body: '#4FC3FF' },
}

/** Draws the screen as 1-bit pixels into a W×H mask (true = lit). */
function rasterize(ctx: CanvasRenderingContext2D, m: ScreenModel): boolean[] {
  ctx.clearRect(0, 0, W, H)
  ctx.textBaseline = 'top'

  // Inverted text: lit box, text cut out of it.
  const text = (s: string, x: number, y: number, size: number, inverted: boolean, align: 'left' | 'right') => {
    ctx.font = `${size}px ${FONT}`
    const w = Math.ceil(ctx.measureText(s).width)
    const left = align === 'left' ? x : x - w
    if (inverted) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(left - 1, y - 2, w + 2, size + 3)
      ctx.globalCompositeOperation = 'destination-out'
    }
    ctx.fillStyle = '#fff'
    ctx.fillText(s, left, y)
    ctx.globalCompositeOperation = 'source-over'
  }

  // Header (16 px): BPM left, FRZ right.
  text(m.bpmText, 2, 4, 8, false, 'left')
  text('FRZ', W - 3, 4, 8, m.frzActive, 'right')
  // Content (48 px): bank left, preset right.
  const y = HEADER_H + (H - HEADER_H - 16) / 2
  text(m.bankText, 4, y, 16, m.bankPending, 'left')
  text(m.presetText, W - 3, y, 16, false, 'right')

  const data = ctx.getImageData(0, 0, W, H).data
  const mask = new Array<boolean>(W * H)
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] >= 128
  return mask
}

export function Screen({ model, panel, scale = 4 }: { model: ScreenModel; panel: PanelColor; scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scratch = useRef<CanvasRenderingContext2D | null>(null)
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    document.fonts.load(`8px ${FONT}`).then(() => setFontReady(true))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!scratch.current) {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      scratch.current = c.getContext('2d', { willReadFrequently: true })
    }
    const sctx = scratch.current
    const ctx = canvas.getContext('2d')
    if (!sctx || !ctx) return

    const mask = rasterize(sctx, model)
    const colors = PANEL[panel]
    const img = ctx.createImageData(W, H)
    const head = hex(colors.head)
    const body = hex(colors.body)
    for (let y = 0; y < H; y++) {
      const c = y < HEADER_H ? head : body
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const o = i * 4
        if (mask[i]) {
          img.data[o] = c[0]
          img.data[o + 1] = c[1]
          img.data[o + 2] = c[2]
        }
        img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [model, panel, fontReady])

  return (
    <canvas
      ref={canvasRef}
      className="oled"
      width={W}
      height={H}
      style={{ width: W * scale, height: H * scale }}
      role="img"
      aria-label={`${model.bpmText}${model.frzActive ? ', freeze on' : ''}. Bank ${model.bankText}${model.bankPending ? ' (pending)' : ''}, preset ${model.presetText}`}
    />
  )
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
