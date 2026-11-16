// OCR fallback for image-only PDFs (e.g. an eVISA re-exported from Canva, a
// scan, or a screenshot saved as PDF): render each page to a canvas and read
// it with Tesseract.js. Output is shaped like pdf.js text items (PDF points,
// bottom-left origin) so the normal layout/line field extraction can run on it.
//
// tesseract.js is imported lazily: it's only downloaded when a PDF has no text.
// Its worker, WASM core and English language data (~10 MB on first use, then
// browser-cached) load from the tesseract.js CDN defaults.

import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export type OcrTextItem = { str: string; x: number; y: number };

export type OcrBbox = { x0: number; y0: number; x1: number; y1: number };
export type OcrLine = { words: { text: string; bbox: OcrBbox }[] };

export type OcrProgress = {
  /** 1-based page being recognised. */
  page: number;
  pages: number;
  /** 0–1 across the whole job (model load + all pages). */
  progress: number;
  status: string;
};

/** Render scale for OCR; ~180 dpi for an A4 page. */
const OCR_SCALE = 2.5;
/** iOS Safari refuses canvases much above ~16.7M px; stay well under. */
const MAX_CANVAS_PIXELS = 8_000_000;
/** Cap pages so a long scan doesn't lock up an iPad. */
export const OCR_MAX_PAGES = 3;
/** Words further apart than this many line-heights start a new item. */
const SEGMENT_GAP_LINE_HEIGHTS = 1.2;

/**
 * Turn OCR lines (canvas pixels, top-left origin) into pdf.js-like items:
 * each line is split into phrases at wide gaps, so a label ("eVISA Number")
 * and its value end up as separate items on the same baseline.
 */
export function ocrLinesToItems(
  lines: OcrLine[],
  scale: number,
  pageHeightPts: number
): OcrTextItem[] {
  const items: OcrTextItem[] = [];
  for (const line of lines) {
    const words = line.words
      .map((w) => ({ text: w.text.replace(/\s+/g, " ").trim(), bbox: w.bbox }))
      .filter((w) => w.text)
      .sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!words.length) continue;

    const heights = words
      .map((w) => w.bbox.y1 - w.bbox.y0)
      .sort((a, b) => a - b);
    const lineHeight = heights[Math.floor(heights.length / 2)] || 1;
    const maxGap = lineHeight * SEGMENT_GAP_LINE_HEIGHTS;

    let segment = [words[0]];
    const flush = () => {
      const x0 = Math.min(...segment.map((w) => w.bbox.x0));
      const y1 = Math.max(...segment.map((w) => w.bbox.y1));
      items.push({
        str: segment.map((w) => w.text).join(" "),
        x: x0 / scale,
        y: pageHeightPts - y1 / scale,
      });
    };
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
      if (gap > maxGap) {
        flush();
        segment = [words[i]];
      } else {
        segment.push(words[i]);
      }
    }
    flush();
  }
  return items;
}

function renderScale(page: PDFPageProxy): number {
  const base = page.getViewport({ scale: 1 });
  const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height));
  return Math.min(OCR_SCALE, maxScale);
}

async function renderPage(
  page: PDFPageProxy,
  scale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport, background: "#ffffff" }).promise;
  return canvas;
}

export async function ocrPdfPages(
  pages: PDFPageProxy[],
  onProgress?: (p: OcrProgress) => void
): Promise<OcrTextItem[]> {
  const { createWorker } = await import("tesseract.js");
  const total = pages.length;
  let current = 0;
  const report = (status: string, pageFraction: number) => {
    // First 20% is loading the model; the rest is split across pages.
    const progress =
      current === 0
        ? 0.2 * pageFraction
        : 0.2 + (0.8 * (current - 1 + pageFraction)) / total;
    onProgress?.({
      page: Math.max(current, 1),
      pages: total,
      progress: Math.min(1, progress),
      status,
    });
  };

  const worker = await createWorker("eng", 1, {
    logger: (m) => report(m.status, m.progress ?? 0),
  });
  try {
    const items: OcrTextItem[] = [];
    for (const page of pages) {
      current++;
      report("recognizing text", 0);
      const scale = renderScale(page);
      const canvas = await renderPage(page, scale);
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((para) => para.lines)
      );
      const pageHeight = page.getViewport({ scale: 1 }).height;
      items.push(...ocrLinesToItems(lines, scale, pageHeight));
      canvas.width = canvas.height = 0; // free memory early on iOS
    }
    return items;
  } finally {
    await worker.terminate();
  }
}
