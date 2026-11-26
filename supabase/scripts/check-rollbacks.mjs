#!/usr/bin/env node
/**
 * Vérifie que chaque migration est réversible (CLAUDE.md, section « Données »).
 *
 * Déroulé, sur la base Supabase LOCALE uniquement :
 *   1. chaque migration a un retour arrière du même nom (et inversement) ;
 *   2. la base est réinitialisée SANS aucune migration → export E0 ;
 *   3. les migrations 1 à N sont appliquées une à une → exports E1 … EN ;
 *   4. les retours arrière N à 1 sont appliqués un à un ; après le retour
 *      arrière de la migration k, la structure doit être exactement E(k-1) ;
 *   5. la base est réinitialisée normalement (toutes les migrations).
 *
 * Ce que ça prouve : chaque retour arrière remet la base exactement dans
 * l'état d'avant sa migration — ni objet oublié, ni droit mal restauré, ni
 * objet en trop supprimé.
 *
 * Pourquoi ne pas se contenter d'un aller-retour (migration, retour arrière,
 * migration) : la seconde application masquerait un retour arrière incomplet,
 * par exemple un droit par défaut mal restauré puis à nouveau révoqué.
 *
 * Pourquoi `docker exec` : psql et pg_dump sont dans le conteneur de la base,
 * dans la même version que le serveur ; rien à installer sur le poste ni en CI.
 *
 * Usage : pnpm db:check-rollbacks (Supabase local démarré : pnpm db:start).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  describeSchemaDifference,
  normalizeSchemaDump,
  pairMigrations,
  readProjectId,
} from './lib/rollbacks.mjs';

const SUPABASE_DIR = path.resolve(import.meta.dirname, '..');
const PROJECT_ROOT = path.resolve(SUPABASE_DIR, '..');
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, 'migrations');
const ROLLBACKS_DIR = path.join(SUPABASE_DIR, 'rollbacks');

/**
 * Exécute une commande sans shell et s'arrête au premier échec.
 *
 * @param {string} command Exécutable.
 * @param {string[]} args Arguments, jamais interprétés par un shell.
 * @param {{ input?: string }} [options] Entrée standard éventuelle.
 * @returns {string} La sortie standard.
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  });
  if (result.status !== 0 || result.error !== undefined) {
    const details = `${result.stderr ?? ''}${result.error ? String(result.error) : ''}`.trim();
    throw new Error(`échec de « ${command} ${args[0] ?? ''} » :\n${details}`);
  }
  return result.stdout;
}

/**
 * Lance la CLI Supabase installée dans le monorepo (version figée).
 *
 * @param {string[]} args Arguments de la CLI.
 * @returns {string}
 */
function runSupabase(args) {
  const require = createRequire(path.join(PROJECT_ROOT, 'package.json'));
  const bin = require.resolve('supabase/dist/supabase.js');
  return run(process.execPath, [bin, ...args]);
}

/**
 * Exécute un fichier SQL dans la base locale, en une seule transaction.
 *
 * @param {string} container Nom du conteneur de la base.
 * @param {string} sqlFile Chemin du fichier SQL.
 * @returns {void}
 */
function applySqlFile(container, sqlFile) {
  run(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '--single-transaction',
    ],
    { input: readFileSync(sqlFile, 'utf8') },
  );
}

/**
 * Exporte la structure complète de la base locale (sans données).
 *
 * Pourquoi `supabase_admin` : c'est le superutilisateur de l'image Supabase,
 * seul capable de lire les objets internes de tous les schémas.
 *
 * @param {string} container Nom du conteneur de la base.
 * @returns {string} Export normalisé.
 */
function dumpSchema(container) {
  return normalizeSchemaDump(
    run('docker', [
      'exec',
      container,
      'pg_dump',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '--schema-only',
    ]),
  );
}

/**
 * Point d'entrée : enchaîne les vérifications et affiche le résultat.
 *
 * @returns {void}
 */
/**
 * Réinitialise la base locale sans appliquer aucune migration.
 *
 * Pourquoi un dossier temporaire : la CLI applique toujours toutes les
 * migrations de `supabase/migrations`. On lui donne (option --workdir) une
 * copie de la configuration avec un dossier de migrations vide ; le même
 * `project_id` désigne le même conteneur local.
 *
 * @returns {void}
 */
function resetWithoutMigrations() {
  const workdir = mkdtempSync(path.join(tmpdir(), 'lueur-rollbacks-'));
  try {
    mkdirSync(path.join(workdir, 'supabase', 'migrations'), { recursive: true });
    copyFileSync(
      path.join(SUPABASE_DIR, 'config.jsonc'),
      path.join(workdir, 'supabase', 'config.jsonc'),
    );
    runSupabase(['db', 'reset', '--no-seed', '--workdir', workdir]);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

/**
 * Point d'entrée : enchaîne les vérifications et affiche le résultat.
 *
 * @returns {void}
 */
function main() {
  const migrations = pairMigrations(readdirSync(MIGRATIONS_DIR), readdirSync(ROLLBACKS_DIR));
  const container = `supabase_db_${readProjectId(readFileSync(path.join(SUPABASE_DIR, 'config.jsonc'), 'utf8'))}`;
  process.stdout.write(
    `${String(migrations.length)} migration(s) appariée(s) à un retour arrière.\n`,
  );

  // CLI Supabase 3 : sans --remote, chaque commande vise la base locale.
  // Ce script ne doit jamais recevoir ni transmettre --remote.
  try {
    resetWithoutMigrations();
    const schemaBefore = [dumpSchema(container)];
    for (const name of migrations) {
      process.stdout.write(`Migration : ${name}\n`);
      applySqlFile(container, path.join(MIGRATIONS_DIR, name));
      schemaBefore.push(dumpSchema(container));
    }

    for (let index = migrations.length - 1; index >= 0; index -= 1) {
      const name = migrations[index] ?? '';
      process.stdout.write(`Retour arrière : ${name}\n`);
      applySqlFile(container, path.join(ROLLBACKS_DIR, name));
      const difference = describeSchemaDifference(schemaBefore[index] ?? '', dumpSchema(container));
      if (difference !== null) {
        throw new Error(
          `après le retour arrière de ${name}, la base diffère de l'état d'avant sa migration : ${difference}`,
        );
      }
    }
  } finally {
    // Succès ou échec : la base locale retrouve son état normal (toutes les
    // migrations, seed), pour les tests et le développement qui suivent.
    runSupabase(['db', 'reset']);
  }
  process.stdout.write('Retours arrière vérifiés : chacun restaure exactement l’état précédent.\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `Vérification des retours arrière en échec : ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
