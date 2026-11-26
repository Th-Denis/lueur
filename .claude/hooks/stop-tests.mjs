#!/usr/bin/env node
/**
 * Hook Stop : tests unitaires des paquets concernés avant la fin d'une tâche.
 *
 * Rôle (section « Hooks » du CLAUDE.md) : quand l'agent s'apprête à rendre la
 * main, on lance les tests unitaires des paquets modifiés sur la branche
 * (et de ceux qui en dépendent). En cas d'échec, l'agent est relancé avec la
 * sortie des tests pour corriger avant de déclarer la tâche terminée.
 *
 * « Modifiés » = différence entre la branche et main (commits, modifications
 * en cours et fichiers non suivis). Une configuration partagée modifiée
 * déclenche tous les tests.
 *
 * Pourquoi Turborepo : son cache rend quasi instantané un nouveau passage sans
 * changement, et `...paquet` inclut les paquets qui en dépendent.
 *
 * Pourquoi sortir sans bloquer si `stop_hook_active` est vrai : l'agent a déjà
 * été relancé une fois par ce hook ; le bloquer encore risquerait une boucle
 * sur un test qu'il ne parvient pas à corriger. Il doit alors le signaler.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readHookInput } from './lib/hook-io.mjs';
import { runPnpm } from './lib/run.mjs';
import { groupChangedFiles } from './lib/workspace.mjs';

/** Nom de paquet npm acceptable, vérifié avant de le passer à pnpm. */
const SAFE_PACKAGE_NAME = /^@?[a-z0-9][\w.-]*(?:\/[\w.-]+)?$/i;

/**
 * Exécute une commande git et renvoie ses lignes de sortie non vides.
 *
 * @param {string} cwd Racine du dépôt.
 * @param {string[]} args Arguments de git.
 * @returns {string[]}
 */
function gitLines(cwd, args) {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Liste les fichiers modifiés sur la branche courante par rapport à main.
 *
 * @param {string} projectRoot Racine du dépôt.
 * @returns {string[]} Chemins relatifs, sans doublon.
 */
function listChangedFiles(projectRoot) {
  const [mergeBase] = gitLines(projectRoot, ['merge-base', 'HEAD', 'origin/main']);
  const committed =
    mergeBase === undefined
      ? []
      : gitLines(projectRoot, ['diff', '--name-only', mergeBase, 'HEAD']);
  const uncommitted = gitLines(projectRoot, ['diff', '--name-only', 'HEAD']);
  const untracked = gitLines(projectRoot, ['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...committed, ...uncommitted, ...untracked])];
}

/**
 * Lit le nom npm d'un paquet du monorepo.
 *
 * @param {string} projectRoot Racine du dépôt.
 * @param {string} packageDir Dossier du paquet, par exemple `packages/crypto`.
 * @returns {string | null} Le nom s'il est sûr, `null` sinon.
 */
function readPackageName(projectRoot, packageDir) {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(projectRoot, packageDir, 'package.json'), 'utf8'),
    );
    return typeof manifest.name === 'string' && SAFE_PACKAGE_NAME.test(manifest.name)
      ? manifest.name
      : null;
  } catch {
    // Paquet supprimé sur la branche : plus rien à tester.
    return null;
  }
}

try {
  const input = await readHookInput();
  if (input.stop_hook_active === true) {
    process.exit(0);
  }
  const projectRoot = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const { packageDirs, hooksChanged, sharedConfigChanged } = groupChangedFiles(
    listChangedFiles(projectRoot),
  );

  const failures = [];
  if (sharedConfigChanged || packageDirs.length > 0) {
    const filters = sharedConfigChanged
      ? []
      : packageDirs
          .map((packageDir) => readPackageName(projectRoot, packageDir))
          .filter((name) => name !== null)
          .map((name) => `--filter=...${name}`);
    if (sharedConfigChanged || filters.length > 0) {
      const tests = runPnpm(projectRoot, [
        'exec',
        'turbo',
        'run',
        'test',
        '--output-logs=errors-only',
        ...filters,
      ]);
      if (!tests.ok) {
        failures.push(tests.output);
      }
    }
  }
  if (hooksChanged) {
    const hookTests = runPnpm(projectRoot, ['run', '--silent', 'test:hooks']);
    if (!hookTests.ok) {
      failures.push(hookTests.output);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Tests unitaires en échec : corrige-les avant de terminer la tâche (CLAUDE.md, Hooks).\n\n${failures.join('\n\n')}\n`,
    );
    process.exit(2);
  }
} catch (error) {
  process.stderr.write(`Hook stop-tests en erreur : ${String(error)}\n`);
  process.exit(2);
}
