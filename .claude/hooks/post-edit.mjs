#!/usr/bin/env node
/**
 * Hook PostToolUse : format, lint et typecheck après chaque modification de fichier.
 *
 * Rôle (section « Hooks » du CLAUDE.md) : après chaque Edit ou Write d'un
 * agent, le fichier modifié est formaté par Prettier, analysé par ESLint et,
 * pour un fichier TypeScript, son paquet est vérifié par le compilateur.
 *
 * Sortie : code 0 si tout est conforme ; code 2 avec les erreurs sur la sortie
 * d'erreur sinon, ce qui les renvoie à l'agent pour qu'il les corrige
 * immédiatement (la modification, elle, est déjà faite).
 *
 * Pourquoi ESLint depuis le dossier du paquet : ESLint 9 cherche sa
 * configuration à partir du dossier courant ; chaque application a la sienne
 * (règles Next.js pour le web, par exemple).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { readHookInput } from './lib/hook-io.mjs';
import { runPackageBin, runPnpm } from './lib/run.mjs';
import {
  LINTABLE_EXTENSIONS,
  TYPED_EXTENSIONS,
  findPackageDir,
  isIgnoredPath,
  packageHasScript,
  relativeToProject,
} from './lib/workspace.mjs';

/**
 * Vérifie un fichier modifié et renvoie la liste des problèmes trouvés.
 *
 * @param {string} projectRoot Racine absolue du dépôt.
 * @param {string} relativePath Fichier modifié, relatif au projet.
 * @returns {string[]} Un message par vérification en échec.
 */
function checkFile(projectRoot, relativePath) {
  const problems = [];
  const absolutePath = path.join(projectRoot, relativePath);
  const extension = path.extname(relativePath).toLowerCase();
  const packageDir = findPackageDir(relativePath);
  const toolDir = packageDir === null ? projectRoot : path.join(projectRoot, packageDir);

  // --ignore-unknown : les fichiers sans formateur (images, SQL…) sont ignorés.
  const format = runPackageBin(projectRoot, 'prettier', [
    '--write',
    '--ignore-unknown',
    '--log-level=warn',
    absolutePath,
  ]);
  if (!format.ok) {
    problems.push(`Prettier a échoué :\n${format.output}`);
  }

  if (LINTABLE_EXTENSIONS.has(extension)) {
    // --no-warn-ignored : pas d'avertissement pour un fichier volontairement ignoré.
    const lint = runPackageBin(toolDir, 'eslint', [
      '--no-warn-ignored',
      '--max-warnings=0',
      absolutePath,
    ]);
    if (!lint.ok) {
      problems.push(`ESLint signale des erreurs :\n${lint.output}`);
    }
  }

  if (
    TYPED_EXTENSIONS.has(extension) &&
    packageDir !== null &&
    packageHasScript(projectRoot, packageDir, 'typecheck')
  ) {
    const typecheck = runPnpm(toolDir, ['run', '--silent', 'typecheck']);
    if (!typecheck.ok) {
      problems.push(`Le typecheck de ${packageDir} échoue :\n${typecheck.output}`);
    }
  }
  return problems;
}

try {
  const input = await readHookInput();
  const projectRoot = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const relativePath =
    typeof filePath === 'string' ? relativeToProject(projectRoot, filePath) : null;

  // Hors du projet, dans un dossier généré ou fichier supprimé : rien à vérifier.
  if (
    relativePath === null ||
    isIgnoredPath(relativePath) ||
    !existsSync(path.join(projectRoot, relativePath))
  ) {
    process.exit(0);
  }

  const problems = checkFile(projectRoot, relativePath);
  if (problems.length > 0) {
    process.stderr.write(
      `Vérifications en échec après modification de ${relativePath} :\n\n${problems.join('\n\n')}\n`,
    );
    process.exit(2);
  }
} catch (error) {
  // Une panne du hook ne doit pas passer inaperçue : on la signale à l'agent.
  process.stderr.write(`Hook post-edit en erreur : ${String(error)}\n`);
  process.exit(2);
}
