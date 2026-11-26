#!/usr/bin/env node
/**
 * Hook PreToolUse : garde-fou exécuté avant chaque appel d'outil d'un agent.
 *
 * Rôle (section « Hooks » et « Permissions » du CLAUDE.md) :
 * 1. Bloquer toute lecture ou écriture d'un fichier .env ou de secrets
 *    (code de sortie 2 : l'appel est refusé et la raison est renvoyée à l'agent).
 * 2. Demander l'accord explicite de l'humain avant une commande destructrice
 *    ou touchant la production (décision `ask`).
 *
 * Entrée : le JSON du hook sur l'entrée standard (`tool_name`, `tool_input`, `cwd`).
 * Sortie : code 0 sans rien écrire pour laisser le circuit de permissions
 * normal s'appliquer ; JSON `permissionDecision: "ask"` pour une confirmation ;
 * code 2 avec un message sur la sortie d'erreur pour un refus.
 *
 * Pourquoi échouer fermé (refus) si l'entrée est illisible : un garde-fou qui
 * laisse passer en cas d'erreur ne protège rien.
 */
import { execFileSync } from 'node:child_process';

import { findDestructiveReason, isImplicitGitPush } from './lib/destructive-guard.mjs';
import { readHookInput } from './lib/hook-io.mjs';
import {
  collectToolPaths,
  findSecretReferenceInCommand,
  isSecretPath,
} from './lib/secret-guard.mjs';

/** Outils dont l'entrée contient une commande shell à analyser. */
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/**
 * Refuse l'appel d'outil et explique pourquoi à l'agent.
 *
 * @param {string} message Explication renvoyée à l'agent.
 * @returns {never}
 */
function deny(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/**
 * Demande une confirmation explicite à l'humain avant l'appel d'outil.
 *
 * @param {string} reason Raison affichée dans la demande de confirmation.
 * @returns {never}
 */
function ask(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Accord explicite requis (CLAUDE.md, Permissions) : ${reason}.`,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

/**
 * Renvoie le nom de la branche git courante, ou `null` si inconnu.
 *
 * @param {string} cwd Dossier de travail de la session.
 * @returns {string | null}
 */
function currentGitBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Hors dépôt git : aucune branche, donc aucun push implicite sur main.
    return null;
  }
}

/**
 * Analyse un appel d'outil et décide : refus, confirmation ou circuit normal.
 *
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input
 * @returns {void}
 */
function guard(input) {
  const toolName = input.tool_name ?? '';
  const toolInput = input.tool_input ?? {};

  const secretPath = collectToolPaths(toolInput).find((path) => isSecretPath(path));
  if (secretPath !== undefined) {
    deny(
      `Accès refusé : « ${secretPath} » est un fichier de secrets (CLAUDE.md, Hooks). ` +
        'Utilise .env.example pour documenter une variable.',
    );
  }

  if (!SHELL_TOOLS.has(toolName)) {
    return;
  }
  const command = typeof toolInput.command === 'string' ? toolInput.command : '';

  const secretReference = findSecretReferenceInCommand(command);
  if (secretReference !== null) {
    deny(
      `Commande refusée : elle cite « ${secretReference} », un fichier de secrets (CLAUDE.md, Hooks).`,
    );
  }

  const destructiveReason = findDestructiveReason(command);
  if (destructiveReason !== null) {
    ask(destructiveReason);
  }

  if (isImplicitGitPush(command)) {
    const branch = currentGitBranch(input.cwd ?? process.cwd());
    if (branch === 'main' || branch === 'master') {
      ask('push sur la branche principale');
    }
  }
}

try {
  guard(await readHookInput());
} catch (error) {
  deny(`Garde-fou indisponible, appel refusé par prudence : ${String(error)}`);
}
