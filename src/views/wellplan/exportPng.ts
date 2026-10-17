// PNG of the pressure plot (M4.4): title lines on top, the plot (the live SVG, drawn again on a canvas), the legend below.
// Browser only (canvas). The picture size is fixed (it does not follow the screen's pixel ratio or the page zoom), so
// the file is the same at 100 % and 150 % display scaling. Nothing is fetched: the SVG goes in as a data: URL.

export interface LegendItem {
  label: string
  colour: string
  /** SVG dash pattern of a line item; leave out for a solid line. */
  dash?: string
  /** A shaded box instead of a line. */
  box?: boolean
}

const SCALE = 2 // the plot's viewBox is 640 x 420; the file shows it at 1280 x 840
const PAD = 24
const FONT = 'Arial, Helvetica, sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(t).width > maxWidth) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The plot picture could not be drawn.'))
    img.src = src
  })
}

/** Draw title, plot and legend on a canvas and return it as PNG bytes. Throws if the file would be empty. */
export async function plotPng(svg: SVGSVGElement, title: string[], legend: LegendItem[]): Promise<Blob> {
  const vb = svg.viewBox.baseVal
  const w = Math.round(vb.width * SCALE)
  const h = Math.round(vb.height * SCALE)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('font-family', FONT) // an SVG drawn as an image does not see the page's CSS
  clone.removeAttribute('style')
  const markup = new XMLSerializer().serializeToString(clone)
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup))

  const width = w + 2 * PAD
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('This browser cannot draw the picture.')
  probe.font = `bold 20px ${FONT}`
  const titleRows = title.flatMap((t) => wrap(probe, t, width - 2 * PAD))
  const titleH = titleRows.length * 28 + 12
  probe.font = `18px ${FONT}`
  // legend: items flow left to right and wrap
  const itemW = (it: LegendItem): number => 50 + probe.measureText(it.label).width + 26
  const rows: LegendItem[][] = [[]]
  let used = 0
  for (const it of legend) {
    if (used + itemW(it) > width - 2 * PAD && rows[rows.length - 1].length) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1].push(it)
    used += itemW(it)
  }
  const legendH = rows.length * 30 + 12

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = PAD + titleH + h + legendH + PAD
  const c = canvas.getContext('2d')
  if (!c) throw new Error('This browser cannot draw the picture.')
  c.fillStyle = '#fff'
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.fillStyle = '#111'
  c.textBaseline = 'alphabetic'
  titleRows.forEach((t, i) => {
    c.font = i === 0 ? `bold 22px ${FONT}` : `18px ${FONT}`
    c.fillText(t, PAD, PAD + 22 + i * 28)
  })
  c.drawImage(img, PAD, PAD + titleH, w, h)

  c.font = `18px ${FONT}`
  rows.forEach((row, ri) => {
    let x = PAD
    const y = PAD + titleH + h + 26 + ri * 30
    for (const it of row) {
      if (it.box) {
        c.fillStyle = '#fff'
        c.fillRect(x, y - 14, 44, 16)
        c.fillStyle = it.colour
        c.fillRect(x, y - 14, 44, 16)
        c.strokeStyle = '#555'
        c.lineWidth = 1
        c.strokeRect(x, y - 14, 44, 16)
      } else {
        c.strokeStyle = it.colour
        c.lineWidth = 3
        c.setLineDash(it.dash ? it.dash.split(' ').map((d) => Number(d) * 2) : [])
        c.beginPath()
        c.moveTo(x, y - 6)
        c.lineTo(x + 44, y - 6)
        c.stroke()
        c.setLineDash([])
      }
      c.fillStyle = '#111'
      c.fillText(it.label, x + 52, y)
      x += itemW(it)
    }
  })
  c.strokeStyle = '#bbb'
  c.lineWidth = 1
  c.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob || blob.size < 1000) throw new Error('The PNG came out empty, so nothing was saved.')
  return blob
}

/** Hand a file to John (a download). The same route the scenario Save uses. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
