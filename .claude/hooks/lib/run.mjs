/**
 * Exécution des outils du monorepo (Prettier, ESLint, scripts pnpm) depuis un hook.
 *
 * Rôle : lancer un outil et récupérer son code de sortie et sa sortie, sans
 * jamais passer par un shell quand des arguments variables (chemins de
 * fichiers) sont en jeu.
 *
 * Pourquoi lancer les binaires JavaScript avec Node plutôt que `pnpm exec` :
 * un chemin de fichier transmis à un shell pourrait être interprété (espaces,
 * `$`, guillemets). Avec `execPath` + tableau d'arguments, aucun caractère
 * n'est interprété.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Environnement des outils lancés : sans couleurs ANSI, illisibles pour l'agent.
 */
const TOOL_ENV = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };

/** Taille maximale de sortie renvoyée à l'agent, pour ne pas saturer son contexte. */
const MAX_OUTPUT_LENGTH = 8000;

/**
 * Résultat d'une exécution.
 * @typedef {{ ok: boolean, output: string }} RunResult
 */

/**
 * Tronque une sortie trop longue en gardant la fin, où se trouvent les erreurs.
 *
 * @param {string} output Sortie brute.
 * @returns {string} Sortie d'au plus MAX_OUTPUT_LENGTH caractères.
 */
export function truncateOutput(output) {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }
  return `[…sortie tronquée…]\n${output.slice(-MAX_OUTPUT_LENGTH)}`;
}

/**
 * Convertit le résultat de `spawnSync` en RunResult.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} result
 * @returns {RunResult}
 */
function toRunResult(result) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  return {
    ok: result.status === 0 && result.error === undefined,
    output: truncateOutput(output.trim()),
  };
}

/**
 * Trouve le script exécutable (champ `bin`) d'un paquet npm installé.
 *
 * @param {string} cwd Dossier depuis lequel résoudre le paquet.
 * @param {string} packageName Nom du paquet, par exemple `eslint`.
 * @returns {string} Chemin absolu du script.
 * @throws {Error} Si le paquet n'est pas installé.
 */
export function resolvePackageBin(cwd, packageName) {
  const require = createRequire(path.join(cwd, 'package.json'));
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[packageName];
  if (typeof bin !== 'string') {
    throw new Error(`aucun exécutable déclaré par ${packageName}`);
  }
  return path.join(path.dirname(manifestPath), bin);
}

/**
 * Exécute l'outil en ligne de commande d'un paquet npm avec Node.
 *
 * @param {string} cwd Dossier de travail (détermine la configuration utilisée).
 * @param {string} packageName Paquet de l'outil (`prettier`, `eslint`).
 * @param {string[]} args Arguments, transmis sans interprétation par un shell.
 * @returns {RunResult}
 */
export function runPackageBin(cwd, packageName, args) {
  const bin = resolvePackageBin(cwd, packageName);
  return toRunResult(
    spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: TOOL_ENV }),
  );
}

/**
 * Caractères autorisés dans un argument pnpm : aucun n'a de sens pour un shell
 * (ni espace, ni guillemet, ni `$`, `&`, `|`, `;`, `%`, `^`).
 */
const SHELL_SAFE_ARGUMENT = /^[\w@./=:-]+$/;

/**
 * Exécute une commande pnpm dont les arguments sont sûrs.
 *
 * Pourquoi un shell sous Windows : pnpm y est un fichier `.cmd`, que Node ne
 * peut lancer qu'à travers un shell. Chaque argument est donc vérifié contre
 * une liste blanche de caractères avant d'être assemblé dans la commande.
 *
 * @param {string} cwd Dossier du paquet.
 * @param {string[]} args Arguments sans caractère spécial (jamais un chemin
 *   saisi librement), par exemple `['run', 'typecheck']`.
 * @returns {RunResult}
 * @throws {Error} Si un argument contient un caractère interprétable par un shell.
 */
export function runPnpm(cwd, args) {
  const unsafe = args.find((arg) => !SHELL_SAFE_ARGUMENT.test(arg));
  if (unsafe !== undefined) {
    throw new Error(`argument pnpm refusé : ${JSON.stringify(unsafe)}`);
  }
  const result =
    process.platform === 'win32'
      ? spawnSync(['pnpm', ...args].join(' '), {
          cwd,
          encoding: 'utf8',
          env: TOOL_ENV,
          shell: true,
        })
      : spawnSync('pnpm', args, { cwd, encoding: 'utf8', env: TOOL_ENV });
  return toRunResult(result);
}
