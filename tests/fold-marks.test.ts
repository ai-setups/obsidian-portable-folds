import { describe, expect, it } from "vitest";
import {
  isFoldMark,
  isHeadingRow,
  markOf,
  markedHeadings,
  ownerOf,
} from "../src/fold-marks";

const rows = (text: string) => text.split("\n");

describe("isFoldMark", () => {
  it("accepts a row holding only the mark", () => {
    expect(isFoldMark("%% fold %%")).toBe(true);
    expect(isFoldMark("  %%fold%%  ")).toBe(true);
  });

  it("rejects a mark sharing its row with other text", () => {
    expect(isFoldMark("## Heading %% fold %%")).toBe(false);
    expect(isFoldMark("before %% fold %% after")).toBe(false);
  });
});

describe("isHeadingRow", () => {
  it("spans H1 through H6", () => {
    expect(isHeadingRow("# a")).toBe(true);
    expect(isHeadingRow("###### a")).toBe(true);
  });

  it("turns down look-alikes", () => {
    expect(isHeadingRow("####### a")).toBe(false);
    expect(isHeadingRow("#tag")).toBe(false);
    expect(isHeadingRow("---")).toBe(false);
    expect(isHeadingRow("plain text")).toBe(false);
  });
});

describe("ownerOf", () => {
  it("points at the heading directly above", () => {
    expect(ownerOf(rows("## A\n%% fold %%"), 1)).toBe(0);
  });

  it("refuses to adopt the heading below it", () => {
    const doc = rows("%% fold %%\n\n## B");
    expect(ownerOf(doc, 0)).toBe(-1);
    expect(markedHeadings(doc)).toEqual([]);
  });

  it("refuses body text and frontmatter fences as owners", () => {
    expect(ownerOf(rows("text\n%% fold %%"), 1)).toBe(-1);
    expect(ownerOf(rows("---\n%% fold %%"), 1)).toBe(-1);
  });
});

describe("markedHeadings", () => {
  it("lists only headings carrying a mark", () => {
    const doc = rows("# A\n%% fold %%\n\n## B\n\n### C\n%% fold %%\n");
    expect(markedHeadings(doc)).toEqual([0, 5]);
  });

  it("is empty for a note without marks", () => {
    expect(markedHeadings(rows("# A\n\n## B"))).toEqual([]);
  });
});

describe("markOf", () => {
  it("finds the mark a heading owns", () => {
    expect(markOf(rows("## A\n%% fold %%"), 0)).toBe(1);
  });

  it("reports -1 when the heading has none", () => {
    expect(markOf(rows("## A\n\ntext"), 0)).toBe(-1);
  });

  it("reports -1 at the end of the note", () => {
    expect(markOf(rows("## A"), 0)).toBe(-1);
  });
});
