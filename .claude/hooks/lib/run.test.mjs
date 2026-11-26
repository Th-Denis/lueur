/**
 * Tests de l'exécution des outils et de la lecture d'entrée (lib/run.mjs, lib/hook-io.mjs).
 */
import path from 'node:path';
import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { readHookInput } from './hook-io.mjs';
import { resolvePackageBin, runPackageBin, runPnpm, truncateOutput } from './run.mjs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

describe('truncateOutput', () => {
  it('garde une sortie courte intacte', () => {
    expect(truncateOutput('ok')).toBe('ok');
  });

  it('garde la fin d’une sortie trop longue', () => {
    const output = `${'a'.repeat(9000)}FIN`;
    const truncated = truncateOutput(output);
    expect(truncated.startsWith('[…sortie tronquée…]')).toBe(true);
    expect(truncated.endsWith('FIN')).toBe(true);
    expect(truncated.length).toBeLessThan(8100);
  });
});

describe('resolvePackageBin et runPackageBin', () => {
  it('trouve l’exécutable de Prettier installé à la racine', () => {
    expect(resolvePackageBin(PROJECT_ROOT, 'prettier')).toMatch(/prettier/);
  });

  it('échoue explicitement pour un paquet absent', () => {
    expect(() => resolvePackageBin(PROJECT_ROOT, 'paquet-qui-n-existe-pas')).toThrow();
  });

  it('exécute un outil et rapporte son succès', () => {
    const result = runPackageBin(PROJECT_ROOT, 'prettier', ['--version']);
    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('runPnpm', () => {
  it('exécute une commande pnpm sûre', () => {
    const result = runPnpm(PROJECT_ROOT, ['--version']);
    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(['a b', 'x;rm', '$(id)', 'a&b', '"q"', '%PATH%'])(
    'refuse l’argument %j, interprétable par un shell',
    (arg) => {
      expect(() => runPnpm(PROJECT_ROOT, ['run', arg])).toThrow('argument pnpm refusé');
    },
  );
});

describe('readHookInput', () => {
  it('analyse un objet JSON reçu en plusieurs morceaux', async () => {
    const stream = Readable.from(['{"tool_name":', '"Read"}']);
    await expect(readHookInput(stream)).resolves.toEqual({ tool_name: 'Read' });
  });

  it.each(['', '   ', 'null', '[1]', '"texte"'])('rejette l’entrée %j', async (raw) => {
    await expect(readHookInput(Readable.from([raw]))).rejects.toThrow();
  });
});
