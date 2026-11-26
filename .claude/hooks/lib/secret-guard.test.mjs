/**
 * Tests de la détection des fichiers de secrets (lib/secret-guard.mjs).
 */
import { describe, expect, it } from 'vitest';

import { collectToolPaths, findSecretReferenceInCommand, isSecretPath } from './secret-guard.mjs';

describe('isSecretPath', () => {
  it.each([
    '.env',
    'apps/web/.env.local',
    'C:\\CODE\\Perso\\lueur\\supabase\\.env',
    '/home/dev/project/.env.production',
    'certs/server.pem',
    'android/app/release.keystore',
    'keys/signing.KEY',
    '~/.ssh/id_ed25519',
    'config/credentials.json',
    'infra/secrets/terraform.tfvars',
  ])('considère « %s » comme un secret', (filePath) => {
    expect(isSecretPath(filePath)).toBe(true);
  });

  it.each([
    '.env.example',
    'apps/web/.env.local.example',
    'packages/crypto/src/csp-nonce.ts',
    'docs/SECURITY.md',
    'src/environment.ts',
    'secrets.md',
    'packages/core/src/keyboard.ts',
    '',
  ])('ne considère pas « %s » comme un secret', (filePath) => {
    expect(isSecretPath(filePath)).toBe(false);
  });

  it('ignore une valeur qui n’est pas une chaîne', () => {
    expect(isSecretPath(undefined)).toBe(false);
    expect(isSecretPath(null)).toBe(false);
  });
});

describe('findSecretReferenceInCommand', () => {
  it.each([
    ['cat .env', '.env'],
    ['cat apps/web/.env.local', '.env.local'],
    ['cp .env.example .env.local', '.env.local'],
    ['Get-Content "supabase\\.env"', '.env'],
    ['type .env.production|more', '.env.production'],
    ['openssl rsa -in server.pem -text', 'server.pem'],
    ['cat ~/.ssh/id_rsa', 'id_rsa'],
    ['ls infra/secrets/', 'secrets/'],
  ])('repère un secret dans « %s »', (command, expected) => {
    expect(findSecretReferenceInCommand(command)).toBe(expected);
  });

  it.each([
    'pnpm test',
    'cat .env.example',
    'node -e "console.log(process.env.NODE_ENV)"',
    'grep -rn import.meta.env src',
    'git status',
    '',
  ])('laisse passer « %s »', (command) => {
    expect(findSecretReferenceInCommand(command)).toBeNull();
  });

  it('ignore une commande absente', () => {
    expect(findSecretReferenceInCommand(undefined)).toBeNull();
  });
});

describe('collectToolPaths', () => {
  it('récupère les chemins de tous les outils connus', () => {
    // Arrange
    const toolInput = {
      file_path: 'a.ts',
      notebook_path: 'b.ipynb',
      path: 'src',
      glob: '*.ts',
      pattern: 'x',
    };

    // Act
    const paths = collectToolPaths(toolInput);

    // Assert
    expect(paths).toEqual(['a.ts', 'b.ipynb', 'src', '*.ts']);
  });

  it('renvoie une liste vide sans entrée exploitable', () => {
    expect(collectToolPaths(undefined)).toEqual([]);
    expect(collectToolPaths(null)).toEqual([]);
    expect(collectToolPaths({ file_path: 42, path: '' })).toEqual([]);
  });
});
