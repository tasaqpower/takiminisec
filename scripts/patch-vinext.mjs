import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

// 1. Ensure public/_next never exists as it conflicts with Next.js/vinext build
const publicNextDir = path.join(projectRoot, 'public', '_next');
if (existsSync(publicNextDir)) {
  console.log('[patch-vinext] Removing conflicting public/_next directory...');
  rmSync(publicNextDir, { recursive: true, force: true });
}

// 2. Patch vinext file-matcher.js for Node < 22 compatibility (node:fs/promises glob)
const fileMatcherPath = path.join(projectRoot, 'node_modules', 'vinext', 'dist', 'routing', 'file-matcher.js');
if (existsSync(fileMatcherPath)) {
  let content = readFileSync(fileMatcherPath, 'utf8');
  if (content.includes('import { glob } from "node:fs/promises";')) {
    console.log('[patch-vinext] Patching vinext file-matcher.js for Node compatibility...');
    content = content.replace(
      'import { glob } from "node:fs/promises";',
      `import * as _fsPromises from "node:fs/promises";`
    );
    const targetFn = `async function* scanWithExtensions(stem, cwd, extensions, exclude) {
	const pattern = includeDotDirectoryMatches(buildExtensionGlob(stem, extensions));
	for await (const file of glob(pattern, {
		cwd,
		...exclude ? { exclude } : {}
	})) yield toSlash(file);
}`;
    const replacementFn = `async function* scanWithExtensions(stem, cwd, extensions, exclude) {
	if (_fsPromises.glob) {
		const pattern = includeDotDirectoryMatches(buildExtensionGlob(stem, extensions));
		for await (const file of _fsPromises.glob(pattern, {
			cwd,
			...exclude ? { exclude } : {}
		})) yield toSlash(file);
		return;
	}
	const baseStem = stem.replace(/^\\*\\*\\//, "");
	function* walk(dir, relDir) {
		let entries = [];
		try { entries = readdirSync(dir, { withFileTypes: true }); } catch {}
		for (const e of entries) {
			if (e.isDirectory()) {
				if (exclude && exclude(e.name)) continue;
				if (!e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
					yield* walk(path.join(dir, e.name), relDir ? \`\${relDir}/\${e.name}\` : e.name);
				}
			} else if (e.isFile()) {
				const ext = path.extname(e.name).replace(/^\\./, "");
				const nameWithoutExt = path.basename(e.name, path.extname(e.name));
				if (extensions.includes(ext) && (baseStem === "*" || nameWithoutExt === baseStem)) {
					const relPath = relDir ? \`\${relDir}/\${e.name}\` : e.name;
					yield toSlash(relPath);
				}
			}
		}
	}
	for (const f of walk(cwd, "")) {
		yield f;
	}
}`;
    if (content.includes(targetFn)) {
      content = content.replace(targetFn, replacementFn);
    }
    if (!content.includes('readdirSync')) {
      content = content.replace('import { existsSync } from "node:fs";', 'import { existsSync, readdirSync } from "node:fs";');
    }
    writeFileSync(fileMatcherPath, content, 'utf8');
    console.log('[patch-vinext] Successfully patched vinext file-matcher.js');
  }
}

// 3. Prepare document assets (PDFium WASM, fonts, workers)
try {
  await import('./prepare-document-assets.mjs');
  console.log('[patch-vinext] Document assets prepared successfully.');
} catch (assetErr) {
  console.warn('[patch-vinext] Warning preparing document assets:', assetErr.message);
}

