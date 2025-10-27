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
exports.SphereScriptCompletionItemProvider = void 0;
// completion.ts
const vscode = __importStar(require("vscode"));
const autocompleteData_1 = require("./autocompleteData");
class SphereScriptCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position.line).text;
        const textBeforeCursor = line.substring(0, position.character);
        // Helper pour créer une plage de remplacement
        const createReplacementRange = (startChar) => {
            return new vscode.Range(position.line, startChar, position.line, position.character);
        };
        // Gère les mots-clés de section comme [ITEMDEF
        const sectionMatch = textBeforeCursor.match(/\b\[([a-zA-Z0-9_]*)$/);
        if (sectionMatch) {
            const partialKeyword = sectionMatch[1].toUpperCase();
            const filteredKeywords = autocompleteData_1.autocompleteData.section_keywords.filter((kw) => kw.startsWith(partialKeyword));
            const replacementStartChar = textBeforeCursor.lastIndexOf('[') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);
            const completionItems = filteredKeywords.map((keyword) => {
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
            let suggestions = [];
            let kind = vscode.CompletionItemKind.Property;
            if (objectPrefix === 'i') {
                suggestions = autocompleteData_1.autocompleteData.item_properties;
            }
            else if (objectPrefix === 'src') {
                suggestions = autocompleteData_1.autocompleteData.char_properties.concat(autocompleteData_1.autocompleteData.triggers); // Les triggers peuvent aussi être des propriétés pour SRC
                kind = vscode.CompletionItemKind.Variable;
            }
            else if (objectPrefix === 'serv') {
                suggestions = autocompleteData_1.autocompleteData.serv_properties;
                kind = vscode.CompletionItemKind.Variable;
            }
            else if (objectPrefix === 'new') {
                suggestions = autocompleteData_1.autocompleteData.new_properties; // Utilise la liste spécifique pour 'new'
                kind = vscode.CompletionItemKind.Variable;
            }
            else if (objectPrefix === 'argo') { // Ajouté : Gestion de l'objet 'argo' basé sur la base de connaissances (<ARGO.SPEED>)
                suggestions = autocompleteData_1.autocompleteData.argo_properties;
                kind = vscode.CompletionItemKind.Property;
            }
            // Ajoutez d'autres préfixes d'objets si nécessaire (par exemple, c., r., etc.)
            const filteredSuggestions = suggestions.filter((s) => s.toUpperCase().startsWith(partialProperty));
            const replacementStartChar = textBeforeCursor.lastIndexOf('.') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);
            const completionItems = filteredSuggestions.map((s) => {
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
            const filteredTriggers = autocompleteData_1.autocompleteData.triggers.filter((t) => t.toUpperCase().startsWith(partialTrigger));
            const replacementStartChar = textBeforeCursor.lastIndexOf('@') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);
            const completionItems = filteredTriggers.map((trigger) => {
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
            const filteredCommands = autocompleteData_1.autocompleteData.commands.filter((c) => c.toUpperCase().startsWith(partialCommand));
            const replacementStartChar = textBeforeCursor.lastIndexOf('.') + 1;
            const replacementRange = createReplacementRange(replacementStartChar);
            const completionItems = filteredCommands.map((command) => {
                const item = new vscode.CompletionItem(command, vscode.CompletionItemKind.Method);
                item.insertText = command;
                item.range = replacementRange; // Remplace le mot partiel
                return item;
            });
            return new vscode.CompletionList(completionItems, true);
        }
        return undefined;
    }
}
exports.SphereScriptCompletionItemProvider = SphereScriptCompletionItemProvider;
//# sourceMappingURL=completion.js.map