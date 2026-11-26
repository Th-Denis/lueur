/**
 * Détection des accès aux fichiers de secrets (.env, clés privées, certificats).
 *
 * Rôle : fournir des fonctions pures, testées, utilisées par le hook
 * PreToolUse `pre-tool-guard.mjs` pour bloquer toute lecture ou écriture d'un
 * fichier de secrets par un agent (hook imposé par le CLAUDE.md, section
 * « Hooks »).
 *
 * Pourquoi un blocage par hook en plus des règles `deny` de settings.json :
 * les règles de permission portent sur des chemins de fichiers, mais une
 * commande shell (`cat .env`, `Get-Content .env.local`) les contourne
 * facilement. Le hook analyse aussi le texte des commandes.
 *
 * Pourquoi `.env.example` est autorisé : c'est un modèle versionné, sans aucune
 * valeur secrète, qui documente les variables attendues.
 *
 * Limite assumée : l'analyse d'une commande shell est heuristique. Elle vise à
 * empêcher les accidents, pas à résister à un contournement volontaire ; la
 * vraie protection reste de ne jamais avoir de secret de production sur le
 * poste de développement.
 */

/**
 * Extensions de fichiers contenant typiquement des clés ou certificats privés.
 * Pourquoi ces extensions : ce sont celles déjà ignorées par le .gitignore.
 */
const SECRET_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx', '.keystore', '.jks'];

/**
 * Noms de fichiers sensibles, comparés sans tenir compte de la casse.
 */
const SECRET_BASENAMES = new Set([
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '.netrc',
  '.pgpass',
  'credentials.json',
]);

/**
 * Noms de dossiers dont tout le contenu est considéré comme secret.
 */
const SECRET_DIRECTORIES = new Set(['secrets', '.secrets']);

/**
 * Détecte, dans un texte libre (commande shell), une référence à un fichier
 * .env autre qu'un modèle `.example`.
 * Pourquoi ces délimiteurs : un nom de fichier dans une commande est entouré
 * d'espaces, de guillemets, de séparateurs de chemin ou d'opérateurs shell.
 * Le préfixe `(?<![\w.-])` évite de signaler `process.env` ou `import.meta.env`.
 */
const ENV_FILE_IN_TEXT = /(?<![\w.-])\.env(?:\.[\w.-]+)?(?=$|[\s'"`;|&()<>,\]])/gi;

/**
 * Détecte une clé ou un certificat privé cité dans une commande.
 */
const KEY_FILE_IN_TEXT =
  /[\w./\\-]+\.(?:pem|key|p12|pfx|keystore|jks)(?=$|[\s'"`;|&()<>,\]])|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|(?<![\w-])\.?secrets[/\\]/gi;

/**
 * Indique si un nom de fichier .env est un simple modèle versionnable.
 *
 * @param {string} name Nom de fichier, par exemple `.env.example`.
 * @returns {boolean} `true` pour `.env.example` (ou `.env.local.example`).
 */
function isEnvTemplate(name) {
  return name.toLowerCase().endsWith('.example');
}

/**
 * Découpe un chemin en segments, quel que soit le séparateur (Windows ou POSIX).
 *
 * @param {string} filePath Chemin absolu ou relatif.
 * @returns {string[]} Les segments non vides du chemin.
 */
function splitPath(filePath) {
  return filePath.split(/[/\\]+/).filter((segment) => segment.length > 0);
}

/**
 * Indique si un chemin de fichier désigne un secret.
 *
 * @param {string | undefined | null} filePath Chemin à analyser.
 * @returns {boolean} `true` si le fichier est un .env (hors modèle), une clé,
 *   un certificat privé ou un fichier situé dans un dossier `secrets`.
 * @example
 * isSecretPath('apps/web/.env.local'); // true
 * isSecretPath('apps/web/.env.example'); // false
 */
export function isSecretPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }
  const segments = splitPath(filePath);
  const basename = (segments.at(-1) ?? '').toLowerCase();

  const isEnvFile = basename === '.env' || basename.startsWith('.env.');
  if (isEnvFile) {
    return !isEnvTemplate(basename);
  }
  if (SECRET_BASENAMES.has(basename)) {
    return true;
  }
  if (SECRET_EXTENSIONS.some((extension) => basename.endsWith(extension))) {
    return true;
  }
  // Le dernier segment est le fichier lui-même : seuls les dossiers parents comptent.
  return segments.slice(0, -1).some((segment) => SECRET_DIRECTORIES.has(segment.toLowerCase()));
}

/**
 * Cherche, dans une commande shell, une référence à un fichier de secrets.
 *
 * @param {string | undefined | null} command Commande Bash ou PowerShell.
 * @returns {string | null} La première référence trouvée, ou `null` si aucune.
 * @example
 * findSecretReferenceInCommand('cat apps/web/.env'); // '.env'
 * findSecretReferenceInCommand('cp .env.example .env.local'); // '.env.local'
 */
export function findSecretReferenceInCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return null;
  }
  for (const match of command.matchAll(ENV_FILE_IN_TEXT)) {
    if (!isEnvTemplate(match[0])) {
      return match[0];
    }
  }
  const keyMatch = command.match(KEY_FILE_IN_TEXT);
  return keyMatch === null ? null : keyMatch[0].trim();
}

/**
 * Liste les chemins de fichiers manipulés par un appel d'outil Claude Code.
 *
 * Pourquoi plusieurs champs : chaque outil nomme différemment sa cible
 * (`file_path` pour Read/Edit/Write, `notebook_path` pour NotebookEdit,
 * `path` et `glob` pour Grep/Glob).
 *
 * @param {Record<string, unknown> | undefined} toolInput Le champ `tool_input` du hook.
 * @returns {string[]} Les chemins trouvés (éventuellement aucun).
 */
export function collectToolPaths(toolInput) {
  if (toolInput === undefined || toolInput === null || typeof toolInput !== 'object') {
    return [];
  }
  return ['file_path', 'notebook_path', 'path', 'glob']
    .map((key) => toolInput[key])
    .filter((value) => typeof value === 'string' && value.length > 0);
}
