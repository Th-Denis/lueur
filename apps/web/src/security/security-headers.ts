/**
 * En-têtes HTTP de sécurité statiques, appliqués à toutes les réponses.
 *
 * Rôle : compléter la CSP (générée à chaque requête dans `src/proxy.ts`) par
 * des en-têtes fixes, conformes aux recommandations OWASP (ASVS V14.4,
 * OWASP Secure Headers Project).
 *
 * Utilisés par `next.config.ts`.
 */

/** Un en-tête HTTP, au format attendu par `headers()` de Next.js. */
export interface HttpHeader {
  readonly key: string;
  readonly value: string;
}

/**
 * Durée HSTS : deux ans, valeur recommandée pour l'inscription à la liste de
 * préchargement des navigateurs.
 * Pourquoi pas encore « preload » : cette inscription est difficile à annuler ;
 * elle sera ajoutée une fois le nom de domaine définitif choisi.
 */
const HSTS_MAX_AGE_SECONDS = 63_072_000;

/**
 * Liste des en-têtes de sécurité statiques.
 *
 * @example
 * ```ts
 * // next.config.ts
 * headers: async () => [{ source: '/:path*', headers: [...SECURITY_HEADERS] }]
 * ```
 */
export const SECURITY_HEADERS: readonly HttpHeader[] = [
  // Force HTTPS pendant deux ans, sous-domaines compris.
  {
    key: 'Strict-Transport-Security',
    value: `max-age=${String(HSTS_MAX_AGE_SECONDS)}; includeSubDomains`,
  },
  // Interdit au navigateur de deviner le type d'un fichier (ex. exécuter une image comme script).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Doublon de frame-ancestors pour les anciens navigateurs.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Aucune URL de notre site n'est transmise aux sites externes.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  // Désactive les fonctions du navigateur dont nous n'avons pas besoin.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  // Isole notre fenêtre des fenêtres ouvertes par d'autres sites.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Empêche d'autres sites d'intégrer nos ressources.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Isole notre origine dans son propre processus quand le navigateur le permet.
  { key: 'Origin-Agent-Cluster', value: '?1' },
  // Pas de résolution DNS anticipée des liens, qui révèle la navigation.
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];
