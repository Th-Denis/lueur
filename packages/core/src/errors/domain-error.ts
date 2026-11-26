/**
 * Classe de base des erreurs métier.
 *
 * Rôle : toutes les erreurs métier du projet (calendrier introuvable, photo
 * figée, invitation invalide…) héritent de `DomainError`. Chacune porte un
 * code stable, ce qui permet à l'interface de choisir un message traduit sans
 * dépendre du texte technique de l'erreur.
 *
 * Pourquoi une classe abstraite : on interdit les erreurs « génériques » ;
 * chaque cas métier doit être nommé explicitement (CLAUDE.md, style de code).
 *
 * Règle de sécurité (règle 5 du CLAUDE.md) : le message ne contient jamais de
 * donnée sensible (contenu, clé, URL signée, adresse email).
 */

/**
 * Erreur métier nommée, à spécialiser pour chaque cas.
 *
 * @typeParam Code - Union des codes possibles pour la sous-classe.
 *
 * @example
 * ```ts
 * class ItemFrozenError extends DomainError<'ITEM_FROZEN'> {
 *   public constructor() {
 *     super('ITEM_FROZEN', 'Cette photo est déjà ouverte et ne peut plus être modifiée.');
 *   }
 * }
 * ```
 */
export abstract class DomainError<Code extends string = string> extends Error {
  /** Code stable et lisible par une machine (ex. « ITEM_FROZEN »). */
  public readonly code: Code;

  /**
   * @param code - Code stable de l'erreur.
   * @param message - Description lisible, sans aucune donnée sensible.
   */
  protected constructor(code: Code, message: string) {
    super(message);
    // Pourquoi new.target : le nom reflète la sous-classe réelle
    // (ex. « ItemFrozenError »), utile pour le diagnostic.
    this.name = new.target.name;
    this.code = code;
  }
}
