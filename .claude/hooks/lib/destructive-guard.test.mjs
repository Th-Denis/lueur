/**
 * Tests de la détection des commandes destructrices (lib/destructive-guard.mjs).
 */
import { describe, expect, it } from 'vitest';

import { findDestructiveReason, isImplicitGitPush } from './destructive-guard.mjs';

describe('findDestructiveReason', () => {
  it.each([
    'rm -rf node_modules',
    'rm -fr dist',
    'rm -Rf build',
    'rm -r -f coverage',
    'Remove-Item -Recurse -Force .next',
    'Remove-Item .turbo -Force -Recurse',
    'git push origin main',
    'git push origin HEAD:main',
    'git push origin refs/heads/master',
    'git push --force origin feat/x',
    'git push -f',
    'git push --force-with-lease',
    'git reset --hard HEAD~1',
    'git clean -fd',
    'supabase db reset --linked',
    'supabase db reset --db-url postgres://host/db',
    'supabase db reset --remote',
    'supabase db reset --remote=abcdefgh',
    'pnpm exec supabase db dump --remote -f dump.sql',
    'supabase test db --remote',
    'supabase db push',
    'supabase link --project-ref abc',
    'supabase functions deploy reveal',
    'psql -c "DROP TABLE items"',
    'psql -c "drop schema private cascade"',
    'psql -c "TRUNCATE audit.audit_log"',
    'terraform apply',
    'terraform destroy -auto-approve',
    'scw instance server delete 123',
  ])('demande une confirmation pour « %s »', (command) => {
    expect(findDestructiveReason(command)).not.toBeNull();
  });

  it.each([
    'pnpm test',
    'rm dist/index.js',
    'rm -r build',
    'Remove-Item dist -Recurse',
    'git push',
    'git push -u origin chore/claude-agents',
    'git push origin feat/maintenance',
    'git reset --soft HEAD~1',
    'supabase db reset',
    'supabase start',
    'terraform plan',
    'scw rdb engine list',
    'git log --grep drop',
    '',
  ])('laisse passer « %s »', (command) => {
    expect(findDestructiveReason(command)).toBeNull();
  });

  it('ignore une commande absente', () => {
    expect(findDestructiveReason(undefined)).toBeNull();
  });
});

describe('isImplicitGitPush', () => {
  it.each(['git push', 'git push origin', 'git push -u origin', 'git push -q && echo ok'])(
    'considère « %s » comme un push de la branche courante',
    (command) => {
      expect(isImplicitGitPush(command)).toBe(true);
    },
  );

  it.each(['git push origin feat/x', 'git pull', 'git status', ''])(
    'ne considère pas « %s » comme implicite',
    (command) => {
      expect(isImplicitGitPush(command)).toBe(false);
    },
  );

  it('ignore une commande absente', () => {
    expect(isImplicitGitPush(undefined)).toBe(false);
  });
});
