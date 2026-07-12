import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["index.html", "flow.html", "dashboard.html", "story.html"];
const pageRequirements = {
  "index.html": /<nav class="tabs" aria-label="Dossier views">/,
  "flow.html": /class="node" data-node="sensor" aria-pressed="false" type="button"/,
  "dashboard.html": /class="button" data-copy="#status" type="button"/,
  "story.html": /class="button story-control" data-direction="next" type="button"/,
};

for (const page of pages) {
  const source = await readFile(new URL(`./${page}`, import.meta.url), "utf8");
  assert.match(source, /styles\.css/, `${page} loads the local stylesheet`);
  assert.match(source, /dossier\.js/, `${page} loads the local interaction script`);
  assert.match(source, /MEASURED 2026-07-11|PROPOSED/, `${page} labels its data state`);
  assert.match(source, pageRequirements[page], `${page} preserves its required controls`);
}

const script = await readFile(new URL("./dossier.js", import.meta.url), "utf8");
assert.match(script, /prefers-reduced-motion/, "interactions respect reduced motion");
assert.match(script, /navigator\.clipboard/, "command cards can copy safely");
assert.doesNotMatch(script, /role=tablist/, "page links retain native navigation semantics");
