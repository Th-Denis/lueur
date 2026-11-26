/**
 * Fonctions pures du vérificateur de retours arrière (check-rollbacks.mjs).
 *
 * Rôle : apparier chaque migration Supabase à son script de retour arrière et
 * lire l'identifiant du projet local, sans dépendre de Docker, pour pouvoir
 * tester cette logique unitairement.
 *
 * Convention (ADR 0003 et agent data-architect) : toute migration
 * `supabase/migrations/<version>_<nom>.sql` a un retour arrière
 * `supabase/rollbacks/<version>_<nom>.sql` portant exactement le même nom.
 */

/** Nom de fichier de migration Supabase : version de 14 chiffres, puis nom. */
const MIGRATION_FILE_NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

/**
 * Erreur levée quand migrations et retours arrière ne correspondent pas.
 */
export class RollbackPairingError extends Error {
  /**
   * @param {string[]} problems Liste des écarts constatés, un par fichier.
   */
  constructor(problems) {
    super(`Migrations et retours arrière ne correspondent pas :\n- ${problems.join('\n- ')}`);
    this.name = 'RollbackPairingError';
    /** @type {string[]} */
    this.problems = problems;
  }
}

/**
 * Apparie les migrations et leurs retours arrière, triés par version.
 *
 * @param {string[]} migrationFiles Noms des fichiers de `supabase/migrations`.
 * @param {string[]} rollbackFiles Noms des fichiers de `supabase/rollbacks`.
 * @returns {string[]} Les noms de migration appariés, du plus ancien au plus récent.
 * @throws {RollbackPairingError} Si un nom est invalide, si une migration n'a
 *   pas de retour arrière ou si un retour arrière n'a pas de migration.
 * @example
 * pairMigrations(['20261126131836_base.sql'], ['20261126131836_base.sql']);
 * // ['20261126131836_base.sql']
 */
export function pairMigrations(migrationFiles, rollbackFiles) {
  const migrations = migrationFiles.filter((name) => name.endsWith('.sql'));
  const rollbacks = new Set(rollbackFiles.filter((name) => name.endsWith('.sql')));
  const problems = [];

  for (const name of migrations) {
    if (!MIGRATION_FILE_NAME.test(name)) {
      problems.push(`${name} : nom invalide (attendu <14 chiffres>_<nom_snake_case>.sql)`);
    }
    if (!rollbacks.has(name)) {
      problems.push(`${name} : aucun retour arrière dans supabase/rollbacks/`);
    }
  }
  for (const name of rollbacks) {
    if (!migrations.includes(name)) {
      problems.push(`${name} : retour arrière sans migration correspondante`);
    }
  }
  if (problems.length > 0) {
    throw new RollbackPairingError(problems);
  }
  // Les versions ont toutes 14 chiffres : l'ordre alphabétique est chronologique.
  return [...migrations].sort();
}

/**
 * Lit `project_id` dans le fichier supabase/config.jsonc.
 *
 * Pourquoi une expression régulière : le fichier est du JSON avec commentaires
 * et virgules finales, que `JSON.parse` refuse ; seule cette clé est utile.
 *
 * @param {string} configText Contenu de config.jsonc.
 * @returns {string} L'identifiant du projet, par exemple `lueur`.
 * @throws {Error} Si la clé est absente ou contient des caractères inattendus.
 */
export function readProjectId(configText) {
  const match = /^\s*"project_id"\s*:\s*"([a-z0-9_-]+)"/m.exec(configText);
  if (match?.[1] === undefined) {
    throw new Error('project_id introuvable ou invalide dans supabase/config.jsonc');
  }
  return match[1];
}

/**
 * Retire d'un export pg_dump les lignes qui changent à chaque exécution.
 *
 * Pourquoi : depuis Postgres 17.6, pg_dump encadre l'export de `\restrict` /
 * `\unrestrict` suivis d'une clé aléatoire (protection contre l'injection de
 * méta-commandes psql). Deux exports identiques différeraient sinon toujours.
 *
 * @param {string} dump Export brut.
 * @returns {string} Export sans ces lignes, fins de ligne normalisées.
 */
export function normalizeSchemaDump(dump) {
  return dump
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict\b/.test(line))
    .join('\n');
}

/**
 * Compare deux exports de schéma et décrit la première différence.
 *
 * @param {string} before Export après la première application des migrations.
 * @param {string} after Export après retour arrière puis nouvelle application.
 * @returns {string | null} `null` si identiques, sinon la première ligne qui diffère.
 */
export function describeSchemaDifference(before, after) {
  if (before === after) {
    return null;
  }
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const length = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < length; index += 1) {
    if (beforeLines[index] !== afterLines[index]) {
      return `ligne ${String(index + 1)} : attendu ${JSON.stringify(beforeLines[index] ?? '')}, obtenu ${JSON.stringify(afterLines[index] ?? '')}`;
    }
  }
  return 'contenus différents (fins de ligne)';
}
