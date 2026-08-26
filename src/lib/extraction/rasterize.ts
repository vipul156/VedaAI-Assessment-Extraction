import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { createCanvas } from "canvas";
import { AppError } from "@/lib/errors";

export const TMP_ROOT = path.join(os.tmpdir(), "vedaai");

export function jobDir(jobId: string): string {
  return path.join(TMP_ROOT, jobId);
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = jobDir(jobId);
  await mkdir(path.join(dir, "uploads"), { recursive: true });
  await mkdir(path.join(dir, "pages"), { recursive: true });
  return dir;
}

export async function removeJobDir(jobId: string): Promise<void> {
  await rm(jobDir(jobId), { recursive: true, force: true }).catch(() => undefined);
}

export function sniffMime(buf: Buffer, filename: string): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "image/webp";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(c: { canvas: import("canvas").Canvas; context: CanvasRenderingContext2D }, width: number, height: number) {
    c.canvas.width = width;
    c.canvas.height = height;
  }
  destroy() {
    /* noop */
  }
}

/**
 * Rasterize a document (PDF pages or images) into normalized page PNGs under
 * pages/{doc}/page-N.png via pdfjs-dist + sharp (both open-source).
 * Returns page descriptors and — for PDFs — the embedded text layer when present.
 */
export async function rasterizeDocument(
  jobId: string,
  doc: "question_paper" | "answer_sheet",
  files: { name: string; buf: Buffer; mime: string }[],
  maxPages = 30,
): Promise<{
  pages: { page: number; width: number; height: number; file: string }[];
  textLines: string[] | null;
}> {
  const dir = jobDir(jobId);
  const outDir = path.join(dir, "pages", doc);
  await mkdir(outDir, { recursive: true });

  const pages: { page: number; width: number; height: number; file: string }[] = [];
  let textLines: string[] | null = null;

  const images = files.filter((f) => f.mime.startsWith("image/"));
  const pdfs = files.filter((f) => f.mime === "application/pdf");

  let pageIndex = 0;
  for (const img of images) {
    if (pageIndex >= maxPages) break;
    pageIndex += 1;
    const out = path.join(outDir, `page-${pageIndex}.png`);
    const meta = await sharp(img.buf)
      .rotate()
      .resize({ width: 1400, height: 2000, fit: "inside" })
      .png()
      .toFile(out);
    pages.push({ page: pageIndex, width: meta.width, height: meta.height, file: `page-${pageIndex}.png` });
  }

  for (const pdf of pdfs) {
    if (pageIndex >= maxPages) break;
    const safeName = pdf.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "upload";
    const pdfPath = path.join(dir, "uploads", `${doc}-${safeName}`);
    await writeFile(pdfPath, pdf.buf);
    const result = await rasterizePdf(pdfPath, outDir, pageIndex, maxPages - pageIndex);
    pages.push(...result.pages);
    pageIndex = pages.length;
    if (result.textLines && result.textLines.length > 0) textLines = result.textLines;
  }

  if (pages.length === 0) {
    throw new AppError("bad_request", "Could not read any pages from the uploaded document.");
  }
  return { pages, textLines };
}

async function rasterizePdf(
  pdfPath: string,
  outDir: string,
  startPage: number,
  maxPages: number,
): Promise<{
  pages: { page: number; width: number; height: number; file: string }[];
  textLines: string[] | null;
}> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(pdfPath));
  let docApi;
  try {
    docApi = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  } catch {
    throw new AppError("bad_request", "The uploaded PDF could not be read (corrupt or protected).");
  }
  const pages: { page: number; width: number; height: number; file: string }[] = [];
  const textLines: string[] = [];
  let hasText = false;
  const count = Math.min(docApi.numPages, maxPages);
  for (let i = 1; i <= count; i++) {
    const page = await docApi.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 });
    const factory = new NodeCanvasFactory();
    const ctxAndCanvas = factory.create(viewport.width, viewport.height);
    const renderParams = {
      canvasContext: ctxAndCanvas.context as unknown as CanvasRenderingContext2D,
      viewport,
      canvasFactory: factory,
    } as unknown as Parameters<typeof page.render>[0];
    await page.render(renderParams).promise;
    const raw = ctxAndCanvas.canvas.toBuffer("image/png");
    const pngBuf = await sharp(raw)
      .resize({ width: 1400, height: 2000, fit: "inside" })
      .png()
      .toBuffer();
    const pageNum = startPage + i;
    const file = `page-${pageNum}.png`;
    await writeFile(path.join(outDir, file), pngBuf);

    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let line = "";
    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const it = item as { str: string; hasEOL?: boolean; transform: number[] };
      const y = Math.round(it.transform[5]);
      if (lastY === null || Math.abs(y - lastY) <= 2) {
        line += it.str + (it.hasEOL ? " " : "");
      } else {
        if (line.trim()) lines.push(line.trim());
        line = it.str;
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.some((l) => l.replace(/\W/g, "").length > 3)) hasText = true;
    textLines.push(...lines);

    const meta = await sharp(pngBuf).metadata();
    pages.push({ page: pageNum, width: meta.width ?? 0, height: meta.height ?? 0, file });
    page.cleanup();
  }
  await docApi.destroy();
  return { pages, textLines: hasText ? textLines : null };
}
