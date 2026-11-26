/**
 * Configuration ESLint commune à tout le monorepo (format « flat config »).
 *
 * Rôle : appliquer partout les mêmes règles de qualité et, surtout, des
 * garde-fous de sécurité vérifiés automatiquement plutôt que par relecture :
 * - typescript-eslint en mode strict avec vérification de types ;
 * - aucun `any` non justifié ;
 * - aucun `console.*` (règle 5 du CLAUDE.md : rien de sensible dans les logs) ;
 * - aucune cryptographie hors de `packages/crypto` (règle 2 du CLAUDE.md).
 *
 * Les applications (web, mobile) importent cette configuration et y ajoutent
 * leurs règles propres.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Modules cryptographiques dont l'import est réservé à `packages/crypto`.
 * Pourquoi : centraliser la crypto en un seul endroit testé et relu évite
 * qu'une primitive soit mal utilisée ailleurs dans le code.
 */
const CRYPTO_MODULES = [
  'libsodium-wrappers',
  'libsodium-wrappers-sumo',
  'react-native-libsodium',
  'crypto',
  'node:crypto',
  'tweetnacl',
  'crypto-js',
  'expo-crypto',
];

const CRYPTO_RESTRICTION_MESSAGE =
  'La cryptographie est réservée à packages/crypto (règle 2 du CLAUDE.md) : importe @lueur/crypto.';

export default tseslint.config(
  {
    // Fichiers générés ou externes : jamais analysés.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
      '**/expo-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.es2023 },
      parserOptions: {
        // Le « project service » trouve automatiquement le tsconfig de chaque
        // fichier, sans liste de projets à maintenir à la main.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Aucun log brut : un futur logger dédié filtrera les données sensibles.
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Garde-fou crypto (règle 2) : imports interdits hors packages/crypto.
      'no-restricted-imports': [
        'error',
        {
          paths: CRYPTO_MODULES.map((name) => ({ name, message: CRYPTO_RESTRICTION_MESSAGE })),
        },
      ],
      // Même garde-fou pour l'API Web Crypto, accessible sans import.
      'no-restricted-globals': ['error', { name: 'crypto', message: CRYPTO_RESTRICTION_MESSAGE }],
      'no-restricted-properties': [
        'error',
        { object: 'globalThis', property: 'crypto', message: CRYPTO_RESTRICTION_MESSAGE },
        { object: 'window', property: 'crypto', message: CRYPTO_RESTRICTION_MESSAGE },
        { object: 'self', property: 'crypto', message: CRYPTO_RESTRICTION_MESSAGE },
      ],
    },
  },

  {
    // Seul packages/crypto a le droit d'utiliser des primitives cryptographiques.
    files: ['packages/crypto/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },

  {
    // Fichiers de configuration en JavaScript : pas d'analyse typée.
    // Pourquoi fusionner languageOptions : un simple remplacement effacerait
    // les parserOptions de disableTypeChecked et réactiverait l'analyse typée.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { ...globals.node },
    },
  },
);
