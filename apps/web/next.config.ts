/**
 * Configuration Next.js de l'app web.
 *
 * Rôle : en-têtes de sécurité statiques, suppression des en-têtes qui
 * trahissent la technologie utilisée, et compilation des paquets internes du
 * monorepo (publiés en TypeScript source).
 */
import type { NextConfig } from 'next';

import { SECURITY_HEADERS } from './src/security/security-headers';

const nextConfig: NextConfig = {
  // N'annonce pas « X-Powered-By: Next.js » : inutile de renseigner un attaquant.
  poweredByHeader: false,
  reactStrictMode: true,
  // Les paquets internes sont livrés en TypeScript : Next.js les compile.
  transpilePackages: ['@lueur/core', '@lueur/crypto'],
  // Aucune source map exposée en production : elles révèlent le code source.
  productionBrowserSourceMaps: false,
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS],
      },
    ]),
};

export default nextConfig;
