/**
 * Tests du repérage des paquets du monorepo (lib/workspace.mjs).
 */
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  findPackageDir,
  groupChangedFiles,
  isIgnoredPath,
  packageHasScript,
  relativeToProject,
  toPosix,
} from './workspace.mjs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

describe('relativeToProject', () => {
  it('renvoie le chemin relatif d’un fichier du projet', () => {
    const absolute = path.join(PROJECT_ROOT, 'packages', 'crypto', 'src', 'index.ts');
    expect(relativeToProject(PROJECT_ROOT, absolute)).toBe('packages/crypto/src/index.ts');
  });

  it('accepte un chemin déjà relatif', () => {
    expect(relativeToProject(PROJECT_ROOT, 'apps/web/src/proxy.ts')).toBe('apps/web/src/proxy.ts');
  });

  it('refuse un fichier hors du projet ou la racine elle-même', () => {
    expect(
      relativeToProject(PROJECT_ROOT, path.join(PROJECT_ROOT, '..', 'autre', 'x.ts')),
    ).toBeNull();
    expect(relativeToProject(PROJECT_ROOT, PROJECT_ROOT)).toBeNull();
  });
});

describe('toPosix', () => {
  it('remplace les séparateurs Windows', () => {
    expect(toPosix('apps\\web\\src')).toBe('apps/web/src');
  });
});

describe('isIgnoredPath', () => {
  it.each([
    'node_modules/x/index.js',
    'apps/web/.next/server.js',
    'packages/crypto/coverage/index.html',
  ])('ignore « %s »', (relativePath) => {
    expect(isIgnoredPath(relativePath)).toBe(true);
  });

  it('vérifie un fichier source', () => {
    expect(isIgnoredPath('packages/crypto/src/index.ts')).toBe(false);
  });
});

describe('findPackageDir', () => {
  it.each([
    ['packages/crypto/src/csp-nonce.ts', 'packages/crypto'],
    ['apps/web/next.config.ts', 'apps/web'],
    ['README.md', null],
    ['.claude/hooks/post-edit.mjs', null],
    ['packages/crypto', null],
  ])('« %s » appartient à %s', (relativePath, expected) => {
    expect(findPackageDir(relativePath)).toBe(expected);
  });
});

describe('packageHasScript', () => {
  it('trouve un script déclaré', () => {
    expect(packageHasScript(PROJECT_ROOT, 'packages/crypto', 'typecheck')).toBe(true);
  });

  it('répond non pour un script absent ou un paquet inexistant', () => {
    expect(packageHasScript(PROJECT_ROOT, 'packages/crypto', 'inexistant')).toBe(false);
    expect(packageHasScript(PROJECT_ROOT, 'packages/inexistant', 'test')).toBe(false);
  });
});

describe('groupChangedFiles', () => {
  it('regroupe les fichiers par paquet, sans doublon', () => {
    // Arrange
    const changed = [
      'packages/crypto/src/a.ts',
      'packages/crypto/src/b.ts',
      'apps\\web\\src\\c.ts',
      'README.md',
    ];

    // Act
    const groups = groupChangedFiles(changed);

    // Assert
    expect(groups).toEqual({
      packageDirs: ['apps/web', 'packages/crypto'],
      hooksChanged: false,
      sharedConfigChanged: false,
    });
  });

  it('signale une modification des hooks ou d’une configuration partagée', () => {
    const groups = groupChangedFiles([
      '.claude/hooks/lib/run.mjs',
      'tsconfig.base.json',
      'node_modules/x/y.js',
    ]);
    expect(groups).toEqual({ packageDirs: [], hooksChanged: true, sharedConfigChanged: true });
  });
});
