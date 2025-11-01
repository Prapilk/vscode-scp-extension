// completion.ts
import * as vscode from 'vscode';
import { autocompleteData } from './autocompleteData';

export class SphereScriptCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const line = document.lineAt(position.line).text;
        const textBeforeCursor = line.substring(0, position.character);

        // Helper pour créer une plage de remplacement
        const createReplacementRange = (startChar: number) => {
            return new vscode.Range(position.line, startChar, position.line, position.character);
        };

        // Gère les mots-clés de section comme [ITEMDEF
        const sectionMatch = textBeforeCursor.match(/\b\[([a-zA-Z0-9_]*)$/);
        if (sectionMatch) {
            const partialKeyword = sectionMatch[1].toUpperCase();
            const filteredKeywords = autocompleteData.section_keywords.filter((kw: string) => kw.startsWith(partialKeyword));

            const replacementStartChar = textBeforeCursor.lastIndexOf('[') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);

            const completionItems = filteredKeywords.map((keyword: string) => {
                const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                item.insertText = `${keyword} `;
                item.documentation = new vscode.MarkdownString(`Section de définition: 
[${keyword}]`);
                item.range = replacementRange; // Remplace le mot partiel
                return item;
            });
            return new vscode.CompletionList(completionItems, true);
        }

        // Gère les propriétés/fonctions d'objets (par exemple, i.damage, src.tag, serv.speedscalefactor, new.p, argo.speed)
        const objectPropertyMatch = textBeforeCursor.match(/(\w+)\.(\w*)$/);
        if (objectPropertyMatch) {
            const objectPrefix = objectPropertyMatch[1].toLowerCase();
            const partialProperty = objectPropertyMatch[2].toUpperCase();
            let suggestions: string[] = [];
            let kind: vscode.CompletionItemKind = vscode.CompletionItemKind.Property;

            if (objectPrefix === 'i') {
                suggestions = autocompleteData.item_properties;
            } else if (objectPrefix === 'src') {
                suggestions = autocompleteData.char_properties.concat(autocompleteData.triggers); // Les triggers peuvent aussi être des propriétés pour SRC
                kind = vscode.CompletionItemKind.Variable;
            } else if (objectPrefix === 'serv') {
                suggestions = autocompleteData.serv_properties;
                kind = vscode.CompletionItemKind.Variable;
            } else if (objectPrefix === 'new') {
                suggestions = autocompleteData.new_properties; // Utilise la liste spécifique pour 'new'
                kind = vscode.CompletionItemKind.Variable;
            } else if (objectPrefix === 'argo') { // Ajouté : Gestion de l'objet 'argo' basé sur la base de connaissances (<ARGO.SPEED>)
                suggestions = autocompleteData.argo_properties;
                kind = vscode.CompletionItemKind.Property;
            }
            // Ajoutez d'autres préfixes d'objets si nécessaire (par exemple, c., r., etc.)

            const filteredSuggestions = suggestions.filter((s: string) => s.toUpperCase().startsWith(partialProperty));

            const replacementStartChar = textBeforeCursor.lastIndexOf('.') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);

            const completionItems = filteredSuggestions.map((s: string) => {
                const item = new vscode.CompletionItem(s, kind);
                item.insertText = s;
                item.range = replacementRange; // Remplace le mot partiel
                return item;
            });
            return new vscode.CompletionList(completionItems, true);
        }

        // Gère les triggers (par exemple, @create)
        const triggerMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
        if (triggerMatch) {
            const partialTrigger = triggerMatch[1].toUpperCase();
            // Utilise la liste exhaustive des triggers de autocompleteData
            const filteredTriggers = autocompleteData.triggers.filter((t: string) => t.toUpperCase().startsWith(partialTrigger));

            const replacementStartChar = textBeforeCursor.lastIndexOf('@') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);

            const completionItems = filteredTriggers.map((trigger: string) => {
                const item = new vscode.CompletionItem(trigger, vscode.CompletionItemKind.Event);
                item.insertText = trigger;
                item.range = replacementRange; // Remplace le mot partiel
                return item;
            });
            return new vscode.CompletionList(completionItems, true);
        }

        // Gère les commandes (par exemple, .add)
        const commandMatch = textBeforeCursor.match(/\.(\w*)$/);
        if (commandMatch) {
            const partialCommand = commandMatch[1].toUpperCase();
            // Utilise la liste des commandes de autocompleteData
            const filteredCommands = autocompleteData.commands.filter((c: string) => c.toUpperCase().startsWith(partialCommand));

            const replacementStartChar = textBeforeCursor.lastIndexOf('.') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);

            const completionItems = filteredCommands.map((command: string) => {
                const item = new vscode.CompletionItem(command, vscode.CompletionItemKind.Method);
                item.insertText = command;
                item.range = replacementRange; // Remplace le mot partiel
                return item;
            });
            return new vscode.CompletionList(completionItems, true);
        }

        // Gère les symboles généraux (propriétés, fonctions, etc.) comme fallback
        const generalWordMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (generalWordMatch) {
            const partialWord = generalWordMatch[1].toUpperCase();
            
            // Crée une liste complète de tous les symboles pour la suggestion globale
            const allSymbols = [
                ...autocompleteData.item_properties,
                ...autocompleteData.char_properties,
                ...autocompleteData.serv_properties,
                ...autocompleteData.triggers,
                ...autocompleteData.section_keywords,
                ...autocompleteData.statements
            ];
            const uniqueSymbols = [...new Set(allSymbols)];

            const filteredSymbols = uniqueSymbols.filter((s: string) => s.toUpperCase().startsWith(partialWord));

            const replacementStartChar = position.character - partialWord.length;
            const replacementRange = createReplacementRange(replacementStartChar);

            const completionItems = filteredSymbols.map((s: string) => {
                let kind = vscode.CompletionItemKind.Text;
                if (autocompleteData.item_properties.includes(s) || autocompleteData.char_properties.includes(s) || autocompleteData.serv_properties.includes(s)) {
                    kind = vscode.CompletionItemKind.Property;
                } else if (autocompleteData.triggers.includes(s)) {
                    kind = vscode.CompletionItemKind.Event;
                } else if (autocompleteData.section_keywords.includes(s) || autocompleteData.statements.includes(s)) {
                    kind = vscode.CompletionItemKind.Keyword;
                }

                const item = new vscode.CompletionItem(s, kind);
                item.insertText = s;
                item.range = replacementRange;
                return item;
            });

            return new vscode.CompletionList(completionItems, false);
        }

        return undefined;
    }
}