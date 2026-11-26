/**
 * Détection des commandes destructrices ou touchant la production.
 *
 * Rôle : fonctions pures utilisées par le hook PreToolUse `pre-tool-guard.mjs`
 * pour exiger l'accord explicite de Thibaut avant une commande listée dans la
 * section « Permissions » du CLAUDE.md : push sur main, `rm -rf`,
 * `supabase db reset` hors local, `drop`, accès à la production.
 *
 * Pourquoi « demander » et non « interdire » : le CLAUDE.md dit « interdits
 * sans accord explicite ». Le hook renvoie donc la décision `ask`, qui affiche
 * une demande de confirmation à l'humain, au lieu de bloquer définitivement.
 *
 * Pourquoi un hook en plus des règles `ask` de settings.json : ces règles
 * reconnaissent un préfixe de commande, alors qu'une commande dangereuse peut
 * être écrite de nombreuses façons (`rm -fr`, `rm -r -f`, `git push origin
 * HEAD:main`, `psql -c "DROP TABLE …"`).
 *
 * Limite assumée : analyse heuristique destinée à éviter les accidents.
 */

/**
 * Une règle : une expression régulière et la raison affichée à l'humain.
 * @typedef {{ pattern: RegExp, reason: string }} DestructiveRule
 */

/** @type {DestructiveRule[]} */
const DESTRUCTIVE_RULES = [
  {
    // rm avec suppression récursive ET forcée, quel que soit l'ordre des options.
    pattern:
      /\brm\s+(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|(?:-[a-z]+\s+)*-[rf]\s+(?:-[a-z]+\s+)*-[rf])\b/i,
    reason: 'suppression récursive forcée (rm -rf)',
  },
  {
    pattern: /\bRemove-Item\b(?=.*-Recurse)(?=.*-Force)/i,
    reason: 'suppression récursive forcée (Remove-Item -Recurse -Force)',
  },
  {
    // Cible main ou master, y compris sous la forme HEAD:main ou refs/heads/main.
    pattern: /\bgit\s+push\b.*(?:\s|:|refs\/heads\/)(?:main|master)(?=$|[\s;|&])/i,
    reason: 'push sur la branche principale',
  },
  {
    pattern: /\bgit\s+push\b.*\s(?:--force(?:-with-lease)?|-f)(?=$|[\s;|&=])/i,
    reason: 'push forcé (réécriture de l’historique distant)',
  },
  {
    pattern: /\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f)/i,
    reason: 'perte de modifications locales (git reset --hard ou git clean -f)',
  },
  {
    // CLI Supabase 3 : `--remote` ; versions antérieures : `--linked` et `--db-url`.
    // Toute commande visant une base distante est concernée (reset, push, test, dump…).
    pattern: /\bsupabase\b.*\s--(?:remote|linked|db-url)\b/i,
    reason: 'commande Supabase visant une base distante (dont supabase db reset hors local)',
  },
  {
    pattern:
      /\bsupabase\s+(?:db\s+push|link|projects\s+delete|secrets\s+set|functions\s+deploy)\b/i,
    reason: 'action sur un projet Supabase distant',
  },
  {
    pattern:
      /\b(?:drop\s+(?:table|schema|database|function|policy|view|type|index|role|trigger|extension|owned)|truncate(?:\s+table)?\s+\w)/i,
    reason: 'suppression de données ou d’objets en base (DROP, TRUNCATE)',
  },
  {
    pattern: /\bterraform\s+(?:apply|destroy|import|state\s+(?:rm|mv|push))\b/i,
    reason: 'modification d’une infrastructure (Terraform)',
  },
  {
    pattern: /\bscw\s+(?!.*\b(?:list|get|engine)\b)\S/i,
    reason: 'commande Scaleway pouvant modifier une ressource distante',
  },
];

/**
 * Cherche la première règle destructrice déclenchée par une commande.
 *
 * @param {string | undefined | null} command Commande Bash ou PowerShell.
 * @returns {string | null} La raison de la demande de confirmation, ou `null`
 *   si la commande n'est pas jugée destructrice.
 * @example
 * findDestructiveReason('git push origin main'); // 'push sur la branche principale'
 * findDestructiveReason('pnpm test'); // null
 */
export function findDestructiveReason(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return null;
  }
  const rule = DESTRUCTIVE_RULES.find(({ pattern }) => pattern.test(command));
  return rule === undefined ? null : rule.reason;
}

/**
 * Indique si une commande est un `git push` sans destination explicite.
 *
 * Pourquoi : `git push` seul pousse la branche courante ; si c'est `main`,
 * c'est un push sur main que l'expression régulière ne peut pas voir.
 *
 * @param {string | undefined | null} command Commande à analyser.
 * @returns {boolean} `true` pour `git push` ou `git push origin` sans refspec.
 */
export function isImplicitGitPush(command) {
  if (typeof command !== 'string') {
    return false;
  }
  return /\bgit\s+push(?:\s+(?:-u|--set-upstream|-q|--quiet|-v|--verbose))*(?:\s+origin)?\s*(?:$|[;|&])/i.test(
    command,
  );
}
