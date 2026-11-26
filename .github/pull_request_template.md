## Résumé

<!-- Quoi et pourquoi, en quelques lignes. Une fonctionnalité = une PR. -->

## Modifications sensibles (règle 6)

- [ ] Aucune modification de `packages/crypto` ni d'une politique RLS
- [ ] OU modification signalée ci-dessous, avec la relecture `security-reviewer` :

<!-- Détailler ici toute modification de la cryptographie, d'une politique RLS, de l'authentification, du stockage ou d'une Edge Function. -->

## Dépendances (règle 9)

| Dépendance      | Version | Justification |
| --------------- | ------- | ------------- |
| <!-- aucune --> |         |               |

## Tests

- [ ] Tests unitaires
- [ ] Au moins un test end-to-end pour une fonctionnalité
- [ ] Tests de sécurité pour chaque nouvelle route ou table (règle 14) : sans session, autre utilisateur, avant et après `reveal_local`
- [ ] Nouvelle migration : retour arrière dans `supabase/rollbacks/`, `COMMENT ON`, `docs/DATA_MODEL.md` à jour

## Relectures des sous-agents

- **data-architect** : <!-- résumé ou « sans objet » -->
- **test-writer** : <!-- résumé -->
- **security-reviewer** : <!-- verdict BLOQUANT / NON BLOQUANT et résumé, ou « sans objet » -->
- **doc-writer** : <!-- résumé -->

## OWASP Top 10 (2021)

<!-- A01 à A10 : conforme / sans objet / détail. -->

## Documentation

- [ ] README, ARCHITECTURE.md, SECURITY.md à jour si nécessaire
- [ ] ADR pour toute décision structurante (`docs/adr/`)
