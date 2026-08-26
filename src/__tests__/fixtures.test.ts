import { describe, expect, it, beforeAll } from "vitest";
import { writeFixtures } from "../../fixtures/makeFixtures";
import { existsSync } from "node:fs";
import path from "node:path";

describe("fixtures", () => {
  beforeAll(async () => {
    await writeFixtures();
  });

  it("writes question paper PDF and answer sheet PNG", () => {
    expect(existsSync(path.join(process.cwd(), "fixtures/questionPaper.pdf"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "fixtures/answerSheet.png"))).toBe(true);
  });
});
