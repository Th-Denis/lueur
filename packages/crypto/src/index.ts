/**
 * Point d'entrée public de `@lueur/crypto`.
 *
 * Rôle : seul paquet du monorepo autorisé à faire de la cryptographie (règle 2
 * du CLAUDE.md, vérifiée par ESLint). Le chiffrement des photos et la gestion
 * des clés (libsodium) arrivent à l'étape 2 du plan de développement.
 *
 * Toute modification de ce paquet doit être signalée explicitement dans la
 * description de la PR (règle 6 du CLAUDE.md).
 */
export { CryptoError, type CryptoErrorCode } from './errors';
export { CSP_NONCE_BYTE_LENGTH, generateCspNonce } from './csp-nonce';
