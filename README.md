# Portable Folds

Heading fold state travels with the note — across devices, restarts, and edits.

[中文文档](README.zh-CN.md)

## Why

Obsidian stores fold state as absolute line numbers, in `localStorage`. Edit anything above a heading and those numbers stop matching — folds land on the wrong sections, or are dropped wholesale. The state never leaves the machine it was made on either.

## How it works

When you fold a heading, the plugin writes a marker on the line directly below it:

```markdown
## Weekly notes
%% fold %%

Everything under here is collapsed.
```

Reopening the note collapses every heading that declares itself folded. Unfolding removes the marker. Nothing is manual — the fold itself is the save.

`%% %%` is Obsidian's comment syntax, so the marker is invisible in reading view.

A marker whose heading was deleted resolves to nothing and is ignored, rather than adopting whatever heading happens to follow it.

## Why the marker sits on its own line

Putting the marker on the heading line would be simpler to implement, and it silently breaks links.

A heading's text *is* its anchor identifier, and Obsidian matches it literally, comments included. Append a marker and the identifier changes every time you fold:

```markdown
folded    ## Weekly notes %% fold %%
unfolded  ## Weekly notes
```

A link is a fixed string, so it only works in the fold state it was written in — an intermittent failure, the hardest kind to trace. On its own line the marker leaves heading text untouched, and anchors stay stable.

## Compared to Creases

[Creases](https://github.com/liamcain/obsidian-creases) established the `%% fold %%` marker. The difference is *when* it gets written.

Creases never records a fold on its own. You fold a heading and nothing is saved — you have to run a command, which means deciding in advance which folds are worth keeping. Skip it and you are back on line numbers, which fail as soon as they shift.

Portable Folds writes the marker the moment you fold. No command, no decision, no fold worth less than any other. Every click is kept.

## Install

Not yet in the community directory. To install manually, copy `main.js` and `manifest.json` from a release into:

```
<vault>/.obsidian/plugins/portable-folds/
```

Then enable **Portable Folds** under Settings → Community plugins.

## Caveats

- Folding writes to the note. Version-controlled vaults will see `%% fold %%` lines in diffs. This is the cost of state that survives; `.gitignore` cannot filter individual lines.
- Only headings are handled. Folded lists, code blocks, and frontmatter are left alone.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # typecheck + production bundle
npm test       # unit tests
```

## License

MIT
