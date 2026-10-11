import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const source = JSON.parse(await readFile('public/manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.deepEqual(manifest, source, 'Built manifest differs from source');
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.incognito, 'not_allowed');
assert.ok(manifest.description.length <= 132);
assert.equal(manifest.background.service_worker, 'background.js');
assert.ok(!manifest.background.scripts && !manifest.background.persistent);
assert.ok(!manifest.key && !manifest.update_url);
assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'; base-uri 'none'");
const assets = [
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...manifest.content_scripts.flatMap(entry => entry.js),
  ...manifest.web_accessible_resources.flatMap(entry => entry.resources), 'privacy.html',
];
for (const asset of assets) {
  assert.ok(!asset.includes('..') && !asset.includes('://'), `Non-local asset: ${asset}`);
  await access(`dist/${asset}`);
}
for (const name of await readdir('dist')) {
  if (name.endsWith('.html')) {
    const html = await readFile(`dist/${name}`, 'utf8');
    for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
      const src = tag[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
      assert.ok(src && !src.includes(':') && !src.startsWith('//'), `Non-local/inline script in ${name}`);
      await access(`dist/${src}`);
    }
  }
}
console.log(`Verified MV3 release ${manifest.version}: manifests, packaged assets, CSP and local HTML scripts. This is not a legal/policy certification.`);
