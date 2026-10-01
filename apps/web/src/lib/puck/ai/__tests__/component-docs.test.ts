import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

import {COMPONENT_DOCS} from '../component-docs';

const configPath = join(dirname(fileURLToPath(import.meta.url)), '../../config.tsx');

function listedConfigTypes(): string[] {
  const source = readFileSync(configPath, 'utf8');
  const types = new Set<string>();
  for (const block of source.matchAll(/components:\s*\[([^\]]+)\]/g)) {
    const list = block[1] ?? '';
    for (const name of list.matchAll(/'([A-Za-z][A-Za-z0-9]+)'/g)) {
      if (name[1]) {
        types.add(name[1]);
      }
    }
  }
  return [...types];
}

describe('COMPONENT_DOCS', () => {
  it('documents every puckConfig component type', () => {
    const types = listedConfigTypes();
    expect(types.length).toBeGreaterThan(20);
    const missing = types.filter(type => !COMPONENT_DOCS[type]);
    expect(missing).toEqual([]);
  });
});
