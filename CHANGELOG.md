# Change Log

All notable changes to the "sperecriptvisx" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1] - 2025-11-01

### Ajouté
- **Validation des chevrons et parenthèses** : Intégration d'un analyseur (tokenizer) pour détecter les parenthèses `()` et les chevrons `<>` non fermés ou en surplus.
- **Validation des sections** : Avertissement pour les espaces superflus avant ou à l'intérieur des déclarations de section (ex: ` [ITEMDEF ...]` ou `[ ITEMDEF ... ]`).
- **Validation de `DEFNAME`** : Erreur si la valeur d'une propriété `DEFNAME` ne correspond pas au nom symbolique de sa section (ex: `[ITEMDEF i_nom]` avec `DEFNAME=i_autre_nom`).
- **Enrichissement de la base de connaissances** : Ajout des propriétés `HEALING`, `TESTIF`, `TEST`, `MAKEITEM`, et `SKILLMENU` pour éliminer les faux positifs.

### Corrigé
- **Stabilité de l'analyseur** : Résolution d'un bug de gestion d'état qui provoquait des erreurs de diagnostic incohérentes sur des blocs de code identiques.
- **Distinction Opérateur/Tag** : Amélioration de la logique pour différencier correctement un opérateur de comparaison (`>`) d'un chevron fermant un tag.

## [Unreleased]

* Initial release
* 27 10 2025
  Première release depuis la Fork du VSIX de NOLOK.
  Mon programme est complètement différent mais suit les couleurs du VSIX de NOLOK, donc ce sera plus cohérent.
  

  
