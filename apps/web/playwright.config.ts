/**
 * Configuration Playwright (tests end-to-end de l'app web).
 *
 * Pourquoi tester un build de production (`next build && next start`) et non
 * le serveur de développement : la CSP de production est plus stricte, c'est
 * elle que les utilisateurs reçoivent et qu'il faut vérifier.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${String(PORT)}`;
const isCi = process.env['CI'] === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
