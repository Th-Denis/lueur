/**
 * Configuration ESLint de l'app web.
 *
 * Rôle : reprend la configuration commune du monorepo (sécurité, TypeScript
 * strict) et y ajoute les règles officielles de Next.js (Core Web Vitals).
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

import rootConfig from '../../eslint.config.mjs';

const webConfig = [...nextCoreWebVitals, ...rootConfig];

export default webConfig;
