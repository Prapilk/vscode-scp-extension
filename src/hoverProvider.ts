// sphereScriptHoverProvider.ts (ou hoverProvider.ts)
import * as vscode from 'vscode';
import { autocompleteData } from './autocompleteData';
import { SphereScriptSymbolProvider } from './symbolProvider';

export class SphereScriptHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        // Regex IDENTIQUE à celle du definition provider pour garantir la cohérence
        // Capture :
        // - Les mots avec underscores (i_shield_chaos, t_equipitem, c_dragon)
        // - Les IDs hexadécimaux avec 0x (0x1bc3)
        // - Les IDs hexadécimaux/décimaux courts sans 0x (01bc3, 02859, a1b2)
        // - Les triggers (@PickUp Ground)
        // - Les propriétés d'objets (SRC.DEX, NEW.P)
        const wordRange = document.getWordRangeAtPosition(
            position, 
            /([a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*)|(0x[0-9a-fA-F]+)|(\b[0-9a-fA-F]{4,}\b)|(@[a-zA-Z0-9_() ]+)/
        );
        
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        let description: string | undefined;
        let lookupKey: string;

        console.log(`[SphereScriptHoverProvider] Hovering over: '${word}'`);

        // 1. Vérifie si c'est un Trigger (commence par '@')
        if (word.startsWith('@')) {
            lookupKey = word.substring(1)
                            .toUpperCase()
                            .replace(/ /g, '_')
                            .replace(/\(|\)/g, '');
            description = autocompleteData.trigger_descriptions[lookupKey];
            if (description) {
                console.log(`[SphereScriptHoverProvider] Found trigger description for: ${lookupKey}`);
                return new vscode.Hover(
                    new vscode.MarkdownString(`**@${lookupKey}**\n\n${description}`),
                    wordRange
                );
            }
        }

        // 2. Vérifie si c'est une propriété d'objet (ex: SRC.DEX, NEW.P)
        const objectPropertyMatch = word.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (objectPropertyMatch) {
            const objectPrefix = objectPropertyMatch[1].toUpperCase();
            const propertyName = objectPropertyMatch[2].toUpperCase();
            
            description = autocompleteData.property_descriptions[propertyName];
            if (description) {
                console.log(`[SphereScriptHoverProvider] Found property description for: ${objectPrefix}.${propertyName}`);
                return new vscode.Hover(
                    new vscode.MarkdownString(`**${objectPrefix}.${propertyName}**\n\n${description}`),
                    wordRange
                );
            }
        }

        // 3. Vérifie si c'est un mot-clé de section (ex: ITEMDEF, FUNCTION)
        lookupKey = word.toUpperCase();
        description = autocompleteData.section_keywords_descriptions[lookupKey];
        if (description) {
            console.log(`[SphereScriptHoverProvider] Found section keyword description for: ${lookupKey}`);
            return new vscode.Hover(
                new vscode.MarkdownString(`**[${lookupKey}]**\n\n${description}`),
                wordRange
            );
        }

        // 4. Vérifie si c'est une propriété générale (ex: ID, TAG, MORE)
        description = autocompleteData.property_descriptions[lookupKey];
        if (description) {
            console.log(`[SphereScriptHoverProvider] Found property description for: ${lookupKey}`);
            return new vscode.Hover(
                new vscode.MarkdownString(`**${lookupKey}**\n\n${description}`),
                wordRange
            );
        }
        
        // 5. Vérifie si c'est un symbole défini par l'utilisateur (DEFNAME, ID hexadécimal, etc.)
        // Cela inclut maintenant TOUS les symboles : i_*, c_*, t_*, etc.
        const symbolLocation = SphereScriptSymbolProvider.getSymbolLocation(lookupKey);
        if (symbolLocation) {
            console.log(`[SphereScriptHoverProvider] Found symbol location for: ${lookupKey}`);
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Symbol: ${word}**\n\n`);
            markdown.appendMarkdown(`Defined in: \`${symbolLocation.uri.fsPath}\`\n\n`);
            markdown.appendMarkdown(`Line: ${symbolLocation.range.start.line + 1}\n\n`);
            markdown.appendMarkdown('_Click to go to definition (F12 or Ctrl+Click)_');
            
            return new vscode.Hover(markdown, wordRange);
        }

        console.log(`[SphereScriptHoverProvider] No hover information found for: ${word}`);
        return undefined;
    }
}