/**
 * Fold state is expressed inside the note itself: a heading is folded when the
 * row immediately beneath it holds nothing but a fold mark.
 *
 *     ## Weekly notes
 *     %% fold %%
 *
 * Keeping the mark on its own row leaves heading text untouched, so anchors
 * and `[[note#heading]]` links keep resolving.
 */
export const FOLD_MARK = "%% fold %%";

const MARK_ONLY = /^\s*%%\s*fold\s*%%\s*$/;
const HEADING = /^#{1,6}\s/;

export function isFoldMark(row: string): boolean {
  return MARK_ONLY.test(row);
}

export function isHeadingRow(row: string): boolean {
  return HEADING.test(row);
}

/**
 * Resolves which heading a mark belongs to.
 *
 * Ownership deliberately points backwards. A mark left behind by a deleted
 * heading therefore resolves to nothing instead of adopting whatever heading
 * happens to follow it, so stale marks fade out rather than fold the wrong
 * section.
 */
export function ownerOf(rows: string[], markRow: number): number {
  if (!isFoldMark(rows[markRow] ?? "")) return -1;
  const above = markRow - 1;
  return above >= 0 && isHeadingRow(rows[above] ?? "") ? above : -1;
}

/** Every heading row that currently declares itself folded. */
export function markedHeadings(rows: string[]): number[] {
  const headings: number[] = [];
  rows.forEach((_, index) => {
    const owner = ownerOf(rows, index);
    if (owner !== -1) headings.push(owner);
  });
  return headings;
}

/** The mark row belonging to a heading, or -1 when it carries none. */
export function markOf(rows: string[], headingRow: number): number {
  const below = headingRow + 1;
  return ownerOf(rows, below) === headingRow ? below : -1;
}
