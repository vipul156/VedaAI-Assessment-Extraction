/**
 * Generates synthetic fixture documents:
 *  - questionPaper.pdf (born-digital, text layer) via pdf-lib
 *  - answerSheet-1.png / -2.png via sharp (handwriting simulated with SVG text)
 * Written under fixtures/ for integration tests and manual E2E.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const FIXTURES = path.join(process.cwd(), "fixtures");

export async function makeQuestionPaperPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const write = (text: string, size = 11) => {
    page.drawText(text, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 10;
  };

  write("Class 10 Mathematics - Unit Test", 14);
  write("Time: 1 hour        Max Marks: 20", 10);
  y -= 6;
  const questions = [
    "1. Solve for x: 2x + 3 = 11. [2]",
    "2. Find the area of a circle with radius 7 cm. (3 marks)",
    "3 (a) Differentiate f(x) = x^2 with respect to x. [2]",
    "(b) Hence evaluate f'(3). [1]",
    "4. A train travels 60 km in 45 minutes. What is its speed in km/h? [4]",
    "5. State the Pythagoras theorem. [2]",
    "6 (a) Factorise x^2 - 9. [1]",
    "(b) Solve x^2 - 9 = 0. [2]",
    "7. Simplify (3x + 2)(x - 5). [3]",
  ];
  for (const q of questions) write(q);
  y -= 10;
  write("Instructions: Attempt all questions.", 10);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function answerSheetSvg(blocks: { label: string | null; text: string; y: number }[]): Buffer {
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000">`);
  parts.push(`<rect width="700" height="1000" fill="#ffffff"/>`);
  parts.push(
    `<text x="350" y="60" font-family="cursive" font-size="22" fill="#111" text-anchor="middle">Answer Sheet - Student 1</text>`,
  );
  for (const b of blocks) {
    const label = b.label ? `${b.label}` : "";
    parts.push(
      `<text x="50" y="${b.y}" font-family="cursive" font-size="26" fill="#1a1a8e" font-weight="bold">${label}</text>`,
    );
    parts.push(
      `<text x="120" y="${b.y}" font-family="cursive" font-size="24" fill="#111">${escapeXml(b.text)}</text>`,
    );
  }
  parts.push(`</svg>`);
  return Buffer.from(parts.join(""));
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function makeAnswerSheetPng(): Promise<Buffer> {
  const svg = answerSheetSvg([
    { label: "2", text: "Area = pi r^2 = 22/7 * 49 = 154 sq cm", y: 160 },
    { label: "5", text: "In a right triangle a^2 + b^2 = c^2", y: 300 },
    { label: "7", text: "3x^2 - 15x + 2x - 10 = 3x^2 - 13x - 10", y: 440 },
    { label: "1", text: "2x = 8 so x = 4", y: 580 },
    { label: "4", text: "Speed = 60 / (45/60) = 80 km/h", y: 720 },
    { label: "14", text: "Extra work not matching any question", y: 860 },
  ]);
  return sharp(svg).png().toBuffer();
}

export async function writeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const pdf = await makeQuestionPaperPdf();
  const png = await makeAnswerSheetPng();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(FIXTURES, "questionPaper.pdf"), pdf);
  await writeFile(path.join(FIXTURES, "answerSheet.png"), png);
}

if (process.argv[1] && process.argv[1].endsWith("makeFixtures.ts")) {
  writeFixtures()
    .then(() => console.log("fixtures written to", FIXTURES))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
