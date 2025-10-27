"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SphereScriptHoverProvider = void 0;
// sphereScriptHoverProvider.ts (ou hoverProvider.ts)
const vscode = __importStar(require("vscode"));
const autocompleteData_1 = require("./autocompleteData");
const symbolProvider_1 = require("./symbolProvider");
class SphereScriptHoverProvider {
    provideHover(document, position, token) {
        // Regex IDENTIQUE à celle du definition provider pour garantir la cohérence
        // Capture :
        // - Les mots avec underscores (i_shield_chaos, t_equipitem, c_dragon)
        // - Les IDs hexadécimaux avec 0x (0x1bc3)
        // - Les IDs hexadécimaux/décimaux courts sans 0x (01bc3, 02859, a1b2)
        // - Les triggers (@PickUp Ground)
        // - Les propriétés d'objets (SRC.DEX, NEW.P)
        const wordRange = document.getWordRangeAtPosition(position, /([a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*)|(0x[0-9a-fA-F]+)|(\b[0-9a-fA-F]{4,}\b)|(@[a-zA-Z0-9_() ]+)/);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        let description;
        let lookupKey;
        console.log(`[SphereScriptHoverProvider] Hovering over: '${word}'`);
        // 1. Vérifie si c'est un Trigger (commence par '@')
        if (word.startsWith('@')) {
            lookupKey = word.substring(1)
                .toUpperCase()
                .replace(/ /g, '_')
                .replace(/\(|\)/g, '');
            description = autocompleteData_1.autocompleteData.trigger_descriptions[lookupKey];
            if (description) {
                console.log(`[SphereScriptHoverProvider] Found trigger description for: ${lookupKey}`);
                return new vscode.Hover(new vscode.MarkdownString(`**@${lookupKey}**\n\n${description}`), wordRange);
            }
        }
        // 2. Vérifie si c'est une propriété d'objet (ex: SRC.DEX, NEW.P)
        const objectPropertyMatch = word.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (objectPropertyMatch) {
            const objectPrefix = objectPropertyMatch[1].toUpperCase();
            const propertyName = objectPropertyMatch[2].toUpperCase();
            description = autocompleteData_1.autocompleteData.property_descriptions[propertyName];
            if (description) {
                console.log(`[SphereScriptHoverProvider] Found property description for: ${objectPrefix}.${propertyName}`);
                return new vscode.Hover(new vscode.MarkdownString(`**${objectPrefix}.${propertyName}**\n\n${description}`), wordRange);
            }
        }
        // 3. Vérifie si c'est un mot-clé de section (ex: ITEMDEF, FUNCTION)
        lookupKey = word.toUpperCase();
        description = autocompleteData_1.autocompleteData.section_keywords_descriptions[lookupKey];
        if (description) {
            console.log(`[SphereScriptHoverProvider] Found section keyword description for: ${lookupKey}`);
            return new vscode.Hover(new vscode.MarkdownString(`**[${lookupKey}]**\n\n${description}`), wordRange);
        }
        // 4. Vérifie si c'est une propriété générale (ex: ID, TAG, MORE)
        description = autocompleteData_1.autocompleteData.property_descriptions[lookupKey];
        if (description) {
            console.log(`[SphereScriptHoverProvider] Found property description for: ${lookupKey}`);
            return new vscode.Hover(new vscode.MarkdownString(`**${lookupKey}**\n\n${description}`), wordRange);
        }
        // 5. Vérifie si c'est un symbole défini par l'utilisateur (DEFNAME, ID hexadécimal, etc.)
        // Cela inclut maintenant TOUS les symboles : i_*, c_*, t_*, etc.
        const symbolLocation = symbolProvider_1.SphereScriptSymbolProvider.getSymbolLocation(lookupKey);
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
exports.SphereScriptHoverProvider = SphereScriptHoverProvider;
//# sourceMappingURL=hoverProvider.js.map