/**
 * Repérage du paquet du monorepo auquel appartient un fichier.
 *
 * Rôle : fonctions utilisées par les hooks `post-edit.mjs` et
 * `stop-tests.mjs` pour savoir quel paquet formater, linter, typer ou tester
 * après une modification.
 *
 * Pourquoi ne pas tout relancer à chaque fois : un typecheck ou une suite de
 * tests complète prend trop de temps pour s'exécuter après chaque
 * modification ; cibler le paquet concerné garde les hooks rapides.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Extensions analysées par ESLint. */
export const LINTABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

/** Extensions vérifiées par le compilateur TypeScript. */
export const TYPED_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

/** Dossiers contenant les paquets du monorepo (voir pnpm-workspace.yaml). */
const WORKSPACE_ROOTS = ['apps', 'packages'];

/**
 * Fichiers de configuration racine dont la modification peut changer le
 * comportement de tous les paquets.
 */
const SHARED_CONFIG_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'eslint.config.mjs',
  'turbo.json',
]);

/**
 * Normalise un chemin en séparateurs POSIX, pour comparer de façon identique
 * sous Windows et sous Linux.
 *
 * @param {string} filePath Chemin à normaliser.
 * @returns {string} Le chemin avec des `/`.
 */
export function toPosix(filePath) {
  return filePath.replaceAll('\\', '/');
}

/**
 * Calcule le chemin d'un fichier relativement à la racine du projet.
 *
 * @param {string} projectRoot Racine absolue du dépôt.
 * @param {string} filePath Chemin absolu ou relatif du fichier.
 * @returns {string | null} Le chemin relatif en séparateurs POSIX, ou `null`
 *   si le fichier est hors du projet.
 */
export function relativeToProject(projectRoot, filePath) {
  const absolute = path.resolve(projectRoot, filePath);
  const relative = toPosix(path.relative(projectRoot, absolute));
  if (
    relative.length === 0 ||
    relative.startsWith('../') ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return relative;
}

/**
 * Indique si un fichier relève d'un dossier jamais vérifié (dépendances, builds).
 *
 * @param {string} relativePath Chemin relatif au projet, en séparateurs POSIX.
 * @returns {boolean}
 */
export function isIgnoredPath(relativePath) {
  return /(?:^|\/)(?:node_modules|\.next|\.expo|\.turbo|dist|build|coverage|\.git)\//.test(
    relativePath,
  );
}

/**
 * Trouve le dossier du paquet (apps/x ou packages/x) contenant un fichier.
 *
 * @param {string} relativePath Chemin relatif au projet, en séparateurs POSIX.
 * @returns {string | null} Par exemple `packages/crypto`, ou `null` si le
 *   fichier est à la racine ou dans `.claude/`.
 * @example
 * findPackageDir('packages/crypto/src/csp-nonce.ts'); // 'packages/crypto'
 */
export function findPackageDir(relativePath) {
  const [root, name, ...rest] = relativePath.split('/');
  if (root === undefined || name === undefined || rest.length === 0) {
    return null;
  }
  return WORKSPACE_ROOTS.includes(root) ? `${root}/${name}` : null;
}

/**
 * Indique si un paquet déclare un script npm donné.
 *
 * @param {string} projectRoot Racine absolue du dépôt.
 * @param {string} packageDir Dossier du paquet, relatif au projet.
 * @param {string} scriptName Nom du script, par exemple `typecheck`.
 * @returns {boolean}
 */
export function packageHasScript(projectRoot, packageDir, scriptName) {
  const manifestPath = path.join(projectRoot, packageDir, 'package.json');
  if (!existsSync(manifestPath)) {
    return false;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return typeof manifest?.scripts?.[scriptName] === 'string';
}

/**
 * Regroupe une liste de fichiers modifiés par cible de test.
 *
 * @param {string[]} relativePaths Fichiers modifiés, relatifs au projet.
 * @returns {{ packageDirs: string[], hooksChanged: boolean, sharedConfigChanged: boolean }}
 *   Les paquets à tester, l'indication que les hooks eux-mêmes ont changé et
 *   celle qu'une configuration partagée a changé (tout doit alors être testé).
 */
export function groupChangedFiles(relativePaths) {
  const packageDirs = new Set();
  let hooksChanged = false;
  let sharedConfigChanged = false;
  for (const relativePath of relativePaths.map(toPosix)) {
    if (isIgnoredPath(relativePath)) {
      continue;
    }
    if (relativePath.startsWith('.claude/hooks/')) {
      hooksChanged = true;
    }
    if (SHARED_CONFIG_FILES.has(relativePath)) {
      sharedConfigChanged = true;
    }
    const packageDir = findPackageDir(relativePath);
    if (packageDir !== null) {
      packageDirs.add(packageDir);
    }
  }
  return { packageDirs: [...packageDirs].sort(), hooksChanged, sharedConfigChanged };
}
