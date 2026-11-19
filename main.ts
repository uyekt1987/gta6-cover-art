// Vice Cover Studio — the entry program (Node 22, standard library only).
//
// It hands the app in: it copies this repository's app/ and screenshots/
// into the output directory and writes output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. The grader runs it twice
// and both runs must write the same bytes; copying files and building the
// dossier from them is deterministic, so they do.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Where this file lives, and where the entry goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the kit's gate: the app is plain files under
// app/ (at most 993 entries and 48 MiB in all, index.html at most 1 MiB) and
// screenshots/ holds at most 4 images of at most 256 KiB each. The dossier
// text is capped at 160 KiB. buildDossier refuses anything over them.
const dossierOptions = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyEntry() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
  const shotsOut = join(outputDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(repoRoot, 'screenshots');
  if (existsSync(shotsIn)) {
    cpSync(shotsIn, shotsOut, { recursive: true });
  }
}

copyEntry();
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, dossierOptions),
);
