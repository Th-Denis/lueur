/**
 * Tests de bout en bout du hook PreToolUse (pre-tool-guard.mjs).
 *
 * Pourquoi lancer le script dans un vrai processus : c'est ainsi que Claude
 * Code l'exécute ; on vérifie donc le contrat réel (entrée standard, code de
 * sortie, JSON écrit sur la sortie standard).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const HOOK_PATH = path.join(import.meta.dirname, 'pre-tool-guard.mjs');

/**
 * Exécute le hook avec une entrée donnée.
 *
 * @param {unknown} input Objet transmis en JSON, ou chaîne brute.
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
function runHook(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  const result = spawnSync(process.execPath, [HOOK_PATH], { input: raw, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('pre-tool-guard', () => {
  it('refuse la lecture d’un fichier .env', () => {
    const result = runHook({ tool_name: 'Read', tool_input: { file_path: 'apps/web/.env.local' } });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('fichier de secrets');
  });

  it('refuse une commande shell qui lit un fichier .env', () => {
    const result = runHook({ tool_name: 'Bash', tool_input: { command: 'cat supabase/.env' } });
    expect(result.status).toBe(2);
  });

  it('refuse une commande PowerShell qui lit une clé privée', () => {
    const result = runHook({
      tool_name: 'PowerShell',
      tool_input: { command: 'Get-Content certs/server.pem' },
    });
    expect(result.status).toBe(2);
  });

  it('demande une confirmation avant un rm -rf', () => {
    // Act
    const result = runHook({ tool_name: 'Bash', tool_input: { command: 'rm -rf dist' } });

    // Assert
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain('rm -rf');
  });

  it('laisse passer une commande ordinaire sans rien écrire', () => {
    const result = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      cwd: process.cwd(),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('laisse passer la lecture de .env.example', () => {
    const result = runHook({ tool_name: 'Read', tool_input: { file_path: '.env.example' } });
    expect(result.status).toBe(0);
  });

  it('n’analyse pas comme une commande l’entrée d’un outil non shell', () => {
    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: 'down.sql', content: 'drop table x;' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.each(['', 'pas du json', '[]'])('refuse par prudence une entrée illisible (%j)', (raw) => {
    const result = runHook(raw);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('refusé par prudence');
  });
});
