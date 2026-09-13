import { MarkdownView, Plugin, TFile } from "obsidian";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { ChangeSpec, EditorState } from "@codemirror/state";
import {
  ensureSyntaxTree,
  foldEffect,
  foldable,
  foldedRanges,
} from "@codemirror/language";
import {
  FOLD_MARK,
  isHeadingRow,
  markOf,
  markedHeadings,
} from "./fold-marks";

/** Rows where a collapsed region begins, as CodeMirror currently sees them. */
function collapsedRows(state: EditorState): Set<number> {
  const rows = new Set<number>();
  const regions = foldedRanges(state);
  if (!regions) return rows;
  const walk = regions.iter();
  while (walk.value !== null) {
    rows.add(state.doc.lineAt(walk.from).number - 1);
    walk.next();
  }
  return rows;
}

export default class PortableFoldsPlugin extends Plugin {
  /**
   * Writing a mark is itself an edit, which the watcher below would report
   * straight back to us. This latch breaks that loop. It is lowered in a
   * microtask so it outlasts every callback the write queues up.
   */
  private writing = false;

  onload() {
    this.registerEditorExtension(this.watcher());

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf || !(leaf.view instanceof MarkdownView)) return;
        void this.restore(leaf.view.file).catch((cause) =>
          this.record("restore", cause)
        );
      })
    );
  }

  /**
   * Reports which rows gained or lost a collapsed region. CodeMirror rejects
   * transactions dispatched from inside update(), hence the microtask hop.
   */
  private watcher() {
    const plugin = this;
    return ViewPlugin.fromClass(
      class {
        private seen = new Set<number>();

        update(update: ViewUpdate) {
          const now = collapsedRows(update.state);
          const opened = [...this.seen].filter((row) => !now.has(row));
          const closed = [...now].filter((row) => !this.seen.has(row));
          if (!opened.length && !closed.length) return;
          this.seen = now;
          queueMicrotask(() => {
            try {
              plugin.rewriteMarks(closed, opened);
            } catch (cause) {
              void plugin.record("rewriteMarks", cause);
            }
          });
        }
      }
    );
  }

  private surface(file?: TFile | null): EditorView | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    if (file && view.file?.path !== file.path) return null;
    return (view.editor as unknown as { cm?: EditorView }).cm ?? null;
  }

  /** Brings the marks in the note back in line with what the user just did. */
  private rewriteMarks(closed: number[], opened: number[]) {
    if (this.writing) return;
    const cm = this.surface();
    if (!cm) return;

    const doc = cm.state.doc;
    const rows = doc.toString().split("\n");
    const edits: ChangeSpec[] = [];

    for (const row of closed) {
      // Anything that is not a heading — frontmatter fences, list items, code
      // blocks — is left alone even when some other plugin collapses it.
      if (!isHeadingRow(rows[row] ?? "")) continue;
      if (markOf(rows, row) !== -1) continue;
      edits.push({ from: doc.line(row + 1).to, insert: `\n${FOLD_MARK}` });
    }

    for (const row of opened) {
      const mark = markOf(rows, row);
      if (mark === -1) continue;
      const markRow = doc.line(mark + 1);
      // Swallow the newline in front of the mark, otherwise a blank row stays.
      edits.push({ from: markRow.from - 1, to: markRow.to });
    }

    if (!edits.length) return;

    this.writing = true;
    cm.dispatch({ changes: edits });
    // An edit expands every region it touches, so the collapse the user asked
    // for has to be laid down again once the mark is in place.
    this.collapseMarked(cm);
    queueMicrotask(() => (this.writing = false));
  }

  /** Collapses each heading the note declares as folded. */
  private collapseMarked(cm: EditorView) {
    const wanted = markedHeadings(cm.state.doc.toString().split("\n"));
    const already = collapsedRows(cm.state);
    const effects = [];

    for (const row of wanted) {
      if (already.has(row)) continue;
      const line = cm.state.doc.line(row + 1);
      const region = foldable(cm.state, line.from, line.to);
      if (region) effects.push(foldEffect.of(region));
    }

    if (!effects.length) return;
    this.writing = true;
    cm.dispatch({ effects });
    queueMicrotask(() => (this.writing = false));
  }

  private async restore(file: TFile | null) {
    if (!file || file.extension !== "md") return;
    const text = await this.app.vault.cachedRead(file);
    if (!markedHeadings(text.split("\n")).length) return;

    // The leaf reports itself before its editor is usable; yield once.
    await new Promise<void>((done) => setTimeout(done, 0));
    const cm = this.surface(file);
    if (!cm) return;

    // Without a parsed tree foldable() finds nothing to collapse.
    ensureSyntaxTree(cm.state, cm.state.doc.length, 5000);
    this.collapseMarked(cm);
  }

  /**
   * Failures inside a plugin reach nothing but the developer console, so they
   * are mirrored into a file that lives with the vault.
   */
  private async record(where: string, cause: unknown) {
    console.error(`[portable-folds] ${where}`, cause);
    const text =
      cause instanceof Error ? `${cause.message}\n${cause.stack}` : String(cause);
    const path = `${this.manifest.dir}/error.log`;
    try {
      const store = this.app.vault.adapter;
      const kept = (await store.exists(path)) ? await store.read(path) : "";
      await store.write(path, `${kept}[${new Date().toISOString()}] ${where}: ${text}\n`);
    } catch {
      // Never let the reporter take down the feature it reports on.
    }
  }
}
