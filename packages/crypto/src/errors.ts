/**
 * Erreurs typées de la couche cryptographique.
 *
 * Rôle : donner à chaque échec cryptographique un nom et un code stables, que
 * l'appelant peut traiter sans analyser un message texte.
 *
 * Règle de sécurité (règle 5 du CLAUDE.md) : un message d'erreur crypto ne
 * contient JAMAIS de clé, de donnée en clair ni de valeur aléatoire générée.
 * Il décrit uniquement la nature du problème.
 */

/** Codes d'erreur possibles de la couche cryptographique. */
export type CryptoErrorCode = 'RANDOM_SOURCE_UNAVAILABLE';

/**
 * Erreur levée par toute fonction de `@lueur/crypto`.
 *
 * @example
 * ```ts
 * try {
 *   generateCspNonce();
 * } catch (error) {
 *   if (error instanceof CryptoError && error.code === 'RANDOM_SOURCE_UNAVAILABLE') {
 *     // Environnement incompatible : on refuse de servir la page.
 *   }
 * }
 * ```
 */
export class CryptoError extends Error {
  /** Code stable, utilisable pour décider du traitement de l'erreur. */
  public readonly code: CryptoErrorCode;

  /**
   * @param code - Code stable de l'erreur.
   * @param message - Description lisible, sans aucune donnée sensible.
   */
  public constructor(code: CryptoErrorCode, message: string) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
  }
}
