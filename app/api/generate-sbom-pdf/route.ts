/**
 * POST /api/generate-sbom-pdf
 *
 * Accepts endpoint + release vulnerability data and returns a landscape PDF
 * in the "Federated Component Evidence Details" style (matching sbom.pdf).
 *
 * Pure Node.js — no Python, no native deps.
 * Add to package.json:  "pdfkit": "^0.15.x"
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
// @ts-ignore – pdfkit ships its own types via @types/pdfkit
import PDFDocument from 'pdfkit'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VulnRow {
  cve_id: string
  severity_rating: string
  severity_score: number
  package: string
  affected_version: string
  fixed_in?: string[]
}

interface ReleaseForPDF {
  release_name: string
  release_version: string
  vulnerabilities: VulnRow[]
}

interface EndpointPDFData {
  endpoint_name: string
  endpoint_type: string
  environment: string
  last_sync: string
  releases: ReleaseForPDF[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W = 792  // landscape letter
const PAGE_H = 612
const MARGIN = 18

// Column definitions for Severity Tables (must sum to ≤ PAGE_W − 2*MARGIN = 756)
const COLS = [
  { label: 'Release',     w: 125 }, 
  { label: 'Version',     w: 110 }, 
  { label: 'Package',     w: 155 }, 
  { label: 'Pkg Version', w:  75 },
  { label: 'CVE',         w: 145 }, 
  { label: 'Severity',    w:  60 },
  { label: 'Score',       w:  36 },
  { label: 'Fixed In',    w:  50 }, 
]

// ── Contextual Severity Palette Themes ────────────────────────────────────────
const SEV_THEMES: Record<string, { header: string; stroke: string; bg1: string; bg2: string; text: string }> = {
  CRITICAL: { header: '#DC2626', stroke: '#991B1B', bg1: '#FEF2F2', bg2: '#FEE2E2', text: '#DC2626' }, // Crimson Red
  HIGH:     { header: '#F97316', stroke: '#C2410C', bg1: '#FFF7ED', bg2: '#FFEDD5', text: '#F97316' }, // Safety Orange
  MEDIUM:   { header: '#EAB308', stroke: '#B45309', bg1: '#FEFCE8', bg2: '#FEF9C3', text: '#CA8A04' }, // Vibrant Amber Gold
  LOW:      { header: '#2563EB', stroke: '#1D4ED8', bg1: '#EFF6FF', bg2: '#DBEAFE', text: '#2563EB' }, // High-Legibility Blue
  CLEAN:    { header: '#10B981', stroke: '#047857', bg1: '#ECFDF5', bg2: '#D1FAE5', text: '#10B981' }, // Compliant Emerald Green
}

const HDR_H = 20
const ROW_H = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function trunc(s: string | undefined | null, n = 28): string {
  const str = String(s ?? '')
  return str.length > n ? str.slice(0, n - 1) + '\u2026' : str
}

function pkgShort(pkg: string): string {
  if (!pkg) return '—'
  if (pkg.startsWith('pkg:')) {
    return pkg.split(':').pop()!.split('@')[0].replace(/%40/g, '@')
  }
  if (pkg.includes('/')) return pkg.split('/').pop()!
  return pkg
}

function sevTheme(rating: string) {
  return SEV_THEMES[(rating ?? '').toUpperCase()] ?? { header: '#666666', stroke: '#444444', bg1: '#FFFFFF', bg2: '#F9F9F9', text: '#666666' }
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number, severityKey: string): number {
  const theme = sevTheme(severityKey)
  let x = MARGIN
  for (const col of COLS) {
    doc.rect(x, y, col.w, HDR_H).fillAndStroke(theme.header, theme.stroke)
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
       .text(col.label, x + 3, y + 6, { width: col.w - 6, height: HDR_H - 6, ellipsis: true })
    x += col.w
  }
  return y + HDR_H
}

interface FullRow extends VulnRow {
  release_name: string
  release_version: string
}

function drawDataRow(doc: InstanceType<typeof PDFDocument>, row: FullRow, y: number, isAlt: boolean, severityKey: string): number {
  const theme = sevTheme(severityKey)
  const bg = isAlt ? theme.bg2 : theme.bg1
  let x = MARGIN

  const cells: string[] = [
    trunc(row.release_name, 22),
    trunc(row.release_version, 24),
    trunc(pkgShort(row.package), 28), 
    trunc(row.affected_version, 12),
    trunc(row.cve_id, 28),             
    (row.severity_rating ?? '').toUpperCase(),
    row.severity_score ? row.severity_score.toFixed(1) : '—',
    trunc((row.fixed_in ?? []).join(', ') || '—', 8), 
  ]

  for (let i = 0; i < COLS.length; i++) {
    doc.rect(x, y, COLS[i].w, ROW_H).fillAndStroke(bg, '#E5E7EB')

    const textOpts: any = {
      width: COLS[i].w - 6,
      height: ROW_H - 6,
      ellipsis: true
    }

    if (i === 4 && row.cve_id && row.cve_id !== '—') {
      textOpts.link = `https://osv.dev/vulnerability/${row.cve_id}`
      doc.font('Helvetica').fontSize(7).fillColor('#2563EB')
         .text(cells[i], x + 3, y + 6, textOpts)
    } else if (i === 5) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(theme.text)
         .text(cells[i], x + 3, y + 6, textOpts)
    } else {
      doc.font('Helvetica').fontSize(7).fillColor('#1F2937')
         .text(cells[i], x + 3, y + 6, textOpts)
    }
    x += COLS[i].w
  }
  return y + ROW_H
}

function maybeNewPage(doc: InstanceType<typeof PDFDocument>, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage({ size: [PAGE_W, PAGE_H] })
    return MARGIN
  }
  return y
}

// ── Custom Title Page ─────────────────────────────────────────────────────────

function drawTitlePage(doc: InstanceType<typeof PDFDocument>, data: EndpointPDFData) {
  const cLightGray = '#C8C9CA'
  const cDarkGray = '#4C4F51'
  const cOrange = '#F39C12'

  // --- Left Geometric Shapes ---
  
  // 1. Light Gray Polygon (Top Left)
  doc.polygon([0, 0], [310, 0], [200, 290], [0, 290])
  doc.fill(cLightGray)

  // 2. Dark Gray Diagonal Stripe (Middle Left)
  doc.polygon([310, 0], [420, 0], [300, 290], [200, 290])
  doc.fill(cDarkGray)

  // 3. Orange Polygon (Bottom Left)
  doc.polygon([0, 290], [200, 290], [360, 600], [0, 600])
  doc.fill(cOrange)

  // 4. Dark Gray Diagonal Stripe (Bottom Left)
  doc.polygon([200, 290], [240, 290], [390, 600], [360, 600])
  doc.fill(cDarkGray)

  // --- Bottom Edge Ribbon ---
  doc.rect(0, 600, PAGE_W, 12).fill(cDarkGray)

  // --- Top Right Geometric Shapes ---

  // 1. Dark Gray Logo Block
  doc.polygon([580, 0], [PAGE_W, 0], [PAGE_W, 110], [610, 110])
  doc.fill(cDarkGray)

  // 2. Orange Accent Line
  doc.polygon([610, 110], [PAGE_W, 110], [PAGE_W, 120], [620, 120])
  doc.fill(cOrange)

  // --- Bottom Right Geometric Ribbon ---

  // 1. Dark Gray Ribbon
  doc.polygon([550, 540], [PAGE_W, 540], [PAGE_W, 570], [565, 570])
  doc.fill(cDarkGray)

  // 2. Tiny Orange Accent Tab
  doc.polygon([545, 540], [550, 540], [565, 570], [560, 570])
  doc.fill(cOrange)

  // --- Logo Image ---
  try {
    const logoPath = path.join(process.cwd(), 'public', 'pdf-logo.png')
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 670, 15, { width: 80 })
    }
  } catch (e) {
    console.warn('Could not load pdf-logo.png for PDF title page:', e)
  }

  // --- Typography ---

  // Large Right-Aligned Title
  const titleX = 350
  let titleY = 220
  
  doc.font('Helvetica-Bold').fontSize(54)
  doc.fillColor(cDarkGray).text('SBOM', titleX, titleY, { width: 400, align: 'right' })
  titleY += 58
  doc.text('WORKING', titleX, titleY, { width: 400, align: 'right' })
  titleY += 58
  doc.fillColor(cOrange).text('REPORT', titleX, titleY, { width: 400, align: 'right' })

  // Endpoint Details (Bottom Left on Orange)
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
  doc.text(`Environment`, 20, 520)
  doc.font('Helvetica').text(`${data.environment || 'N/A'}`, 20, 533)
  
  doc.font('Helvetica-Bold').text(`Endpoint`, 20, 555)
  doc.font('Helvetica').text(`${data.endpoint_name || 'N/A'}`, 20, 568)

  // Generated Date (Bottom Right on Ribbon)
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'long', day: '2-digit', year: 'numeric'
  }) + ' at ' + now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  })

  doc.font('Helvetica').fontSize(9).fillColor('#FFFFFF')
  doc.text(formattedDate, 570, 550, { width: 210, align: 'center' })
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildPDF(data: EndpointPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_W, PAGE_H],
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      autoFirstPage: true,
      info: {
        Title: `SBOM — ${data.endpoint_name}`,
        Author: 'Ortelius',
        Subject: 'Federated Component Evidence Details',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // 1. Draw the Custom Title Page
    drawTitlePage(doc, data)

    // 2. Add a fresh page for the main report content
    doc.addPage({ size: [PAGE_W, PAGE_H] })
    let y = MARGIN

    // ── Document Sub-Title / Header ─────────────────────────────────────────
    try {
      const logoPath = path.join(process.cwd(), 'public', 'pdf-logo.png')
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, MARGIN, y, { width: 50 })
        y += 60 
      }
    } catch (e) {
      console.warn('Could not load pdf-logo.png for PDF header:', e)
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
       .text('Federated Component Evidence Details', MARGIN, y)
    y += 22

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111')
       .text(`Endpoint: ${data.endpoint_name}`, MARGIN, y)
    y += 18

    // ── Metadata block ─────────────────────────────────────────────────────
    const metaRows = [
      ['Environment', data.environment,                                  'Type',     data.endpoint_type],
      ['Last Sync',   data.last_sync.slice(0, 19).replace('T', ' '),    'Releases', String(data.releases.length)],
    ]
    const metaCols = [80, 160, 55, 100]
    const META_H = 16
    for (const row of metaRows) {
      let x = MARGIN
      for (let i = 0; i < row.length; i++) {
        doc.rect(x, y, metaCols[i], META_H).fillAndStroke('#F5F5F5', '#CCCCCC')
        doc.font(i % 2 === 0 ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(8).fillColor('#000')
           .text(row[i], x + 4, y + 4, { width: metaCols[i] - 6, lineBreak: false })
        x += metaCols[i]
      }
      y += META_H
    }
    y += 10

    // ── Summary bar ────────────────────────────────────────────────────────
    const total = data.releases.reduce((s, r) => s + r.vulnerabilities.length, 0)
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, CLEAN: 0 }
    for (const r of data.releases) {
      for (const v of r.vulnerabilities) {
        const k = (v.severity_rating ?? '').toUpperCase()
        if (k in counts) counts[k]++
      }
    }

    const sumCols = [
      { label: 'Total CVEs', val: String(total),            color: '#000000' },
      { label: 'Critical',   val: String(counts.CRITICAL),  color: '#DC2626' },
      { label: 'High',       val: String(counts.HIGH),      color: '#F97316' },
      { label: 'Medium',     val: String(counts.MEDIUM),    color: '#CA8A04' },
      { label: 'Low',        val: String(counts.LOW),       color: '#2563EB' },
    ]
    const SUM_W = 100, SUM_H = 24
    let sx = MARGIN
    for (const s of sumCols) {
      doc.rect(sx, y, SUM_W, SUM_H).fillAndStroke('#F0F0F0', '#CCCCCC')
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#555555')
         .text(s.label, sx + 4, y + 4, { width: SUM_W - 8, lineBreak: false })
      doc.font('Helvetica-Bold').fontSize(11).fillColor(s.color)
         .text(s.val, sx + 4, y + 13, { width: SUM_W - 8, lineBreak: false })
      sx += SUM_W
    }
    y += SUM_H + 20

    // ── Release Versions Table (NEW) ───────────────────────────────────────
    // Prevent orphaned 'Release Versions' heading
    const relSpaceNeeded = 35 + HDR_H + (data.releases.length > 0 ? ROW_H : 0)
    y = maybeNewPage(doc, y, relSpaceNeeded)
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
       .text('Release Versions', MARGIN, y)
    y += 16

    const relCols = [
      { label: 'Release Name',   w: 300 },
      { label: 'Version',        w: 256 },
      { label: 'CVE Count',      w: 200 },
    ]

    // Draw Release Table Header
    y = maybeNewPage(doc, y, HDR_H)
    let rx = MARGIN
    for (const col of relCols) {
      doc.rect(rx, y, col.w, HDR_H).fillAndStroke('#4B5563', '#374151') 
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
         .text(col.label, rx + 4, y + 6, { width: col.w - 8, height: HDR_H - 6, ellipsis: true })
      rx += col.w
    }
    y += HDR_H

    // Stream Release Rows
    for (let i = 0; i < data.releases.length; i++) {
      const rel = data.releases[i]
      y = maybeNewPage(doc, y, ROW_H)
      
      if (y === MARGIN) {
        let rxx = MARGIN
        for (const col of relCols) {
          doc.rect(rxx, y, col.w, HDR_H).fillAndStroke('#4B5563', '#374151')
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
             .text(col.label, rxx + 4, y + 6, { width: col.w - 8, height: HDR_H - 6, ellipsis: true })
          rxx += col.w
        }
        y += HDR_H
      }

      const bg = i % 2 === 0 ? '#F9FAFB' : '#F3F4F6'
      let rxx = MARGIN

      doc.rect(rxx, y, relCols[0].w, ROW_H).fillAndStroke(bg, '#E5E7EB')
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937')
         .text(trunc(rel.release_name, 45), rxx + 4, y + 6, { width: relCols[0].w - 8, height: ROW_H - 6, ellipsis: true })
      rxx += relCols[0].w

      doc.rect(rxx, y, relCols[1].w, ROW_H).fillAndStroke(bg, '#E5E7EB')
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937')
         .text(trunc(rel.release_version, 35), rxx + 4, y + 6, { width: relCols[1].w - 8, height: ROW_H - 6, ellipsis: true })
      rxx += relCols[1].w

      doc.rect(rxx, y, relCols[2].w, ROW_H).fillAndStroke(bg, '#E5E7EB')
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937')
         .text(String(rel.vulnerabilities?.length || 0), rxx + 4, y + 6, { width: relCols[2].w - 8, height: ROW_H - 6, ellipsis: true })

      y += ROW_H
    }
    y += 20

    // ── Per-Severity Sections ──────────────────────────────────────────────
    const SECTIONS = [
      { key: 'CRITICAL', label: 'Critical Risk Packages' },
      { key: 'HIGH',     label: 'High Risk Packages' },
      { key: 'MEDIUM',   label: 'Medium Risk Packages' },
      { key: 'LOW',      label: 'Low Risk Packages' },
      { key: 'CLEAN',    label: 'No Risk Packages' },
    ]

    for (const sec of SECTIONS) {
      const matchingRows: FullRow[] = []
      for (const release of data.releases) {
        for (const v of release.vulnerabilities) {
          if ((v.severity_rating ?? '').toUpperCase() === sec.key) {
            matchingRows.push({
              ...v,
              release_name: release.release_name,
              release_version: release.release_version,
            })
          }
        }
      }

      const spaceNeeded = matchingRows.length === 0 
          ? 35 + 18 
          : 35 + HDR_H + ROW_H

      y = maybeNewPage(doc, y, spaceNeeded)
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
         .text(sec.label, MARGIN, y)
      y += 16

      if (matchingRows.length === 0) {
        doc.font('Helvetica').fontSize(8).fillColor('#10B981')
           .text(`✓ No ${sec.key.toLowerCase()} risk packages found for this endpoint.`, MARGIN + 4, y)
        y += 18
        continue
      }

      matchingRows.sort((a, b) => {
        const scoreA = Number(a.severity_score) || 0
        const scoreB = Number(b.severity_score) || 0
        if (scoreB !== scoreA) return scoreB - scoreA

        const pkgA = String(a.package ?? '')
        const pkgB = String(b.package ?? '')
        const pkgComp = pkgA.localeCompare(pkgB)
        if (pkgComp !== 0) return pkgComp

        return String(a.release_name ?? '').localeCompare(String(b.release_name ?? ''))
      })

      y = maybeNewPage(doc, y, HDR_H)
      y = drawTableHeader(doc, y, sec.key)

      for (let i = 0; i < matchingRows.length; i++) {
        y = maybeNewPage(doc, y, ROW_H)
        if (y === MARGIN) {
          y = drawTableHeader(doc, y, sec.key)
        }
        y = drawDataRow(doc, matchingRows[i], y, i % 2 === 0, sec.key)
      }
      y += 14
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    y = maybeNewPage(doc, y, 20)
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ')
    doc.font('Helvetica').fontSize(7).fillColor('#999999')
       .text(`Generated by Ortelius · ${ts} UTC`, MARGIN, y + 8, {
         width: PAGE_W - MARGIN * 2,
         align: 'center',
       })

    doc.end()
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const data: EndpointPDFData = await req.json()
    const pdf = await buildPDF(data)
    const filename = `${(data.endpoint_name ?? 'endpoint').replace(/[^a-z0-9_-]/gi, '_')}-sbom-${new Date().toISOString().split('T')[0]}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new NextResponse(msg, { status: 500 })
  }
}