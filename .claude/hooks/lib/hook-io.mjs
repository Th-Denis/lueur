/**
 * Lecture de l'entrée JSON transmise par Claude Code à un hook.
 *
 * Rôle : centraliser la lecture de l'entrée standard pour que chaque hook
 * traite de la même façon une entrée vide ou mal formée.
 */

/**
 * Lit et analyse l'entrée JSON du hook depuis l'entrée standard.
 *
 * @param {NodeJS.ReadableStream} [stream] Flux à lire (l'entrée standard par défaut).
 * @returns {Promise<Record<string, any>>} L'objet transmis par Claude Code.
 * @throws {Error} Si l'entrée est vide ou n'est pas un objet JSON.
 */
export async function readHookInput(stream = process.stdin) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) {
    throw new Error('entrée du hook vide');
  }
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('entrée du hook invalide : objet JSON attendu');
  }
  return parsed;
}
