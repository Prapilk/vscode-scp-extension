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
exports.SphereScriptCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
const rules_1 = require("./rules");
class SphereScriptCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        const codeActions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source === 'Sphere Script Linter') {
                // 1. Correction des événements (@Create, @Timer, etc.)
                if (diagnostic.message.includes("L'événement")) {
                    const fixes = this.fixEvent(document, diagnostic);
                    codeActions.push(...fixes);
                }
                // 2. Correction des mots-clés de section ([ITEMDEF], [CHARDEF], etc.)
                if (diagnostic.message.includes("mot-clé de section")) {
                    const fixes = this.fixSectionKeyword(document, diagnostic);
                    codeActions.push(...fixes);
                }
                // 3. Correction des fonctions/propriétés
                if (diagnostic.message.includes("fonction") || diagnostic.message.includes("propriété")) {
                    const fixes = this.fixFunctionOrProperty(document, diagnostic);
                    codeActions.push(...fixes);
                }
                // 4. Suggestion pour ajouter DEFNAME
                if (diagnostic.message.includes("propriété DEFNAME est manquante")) {
                    const fix = this.addDefname(document, diagnostic);
                    if (fix) {
                        codeActions.push(fix);
                    }
                }
            }
        }
        return codeActions;
    }
    /**
     * Correction des événements (@create → @Create, @creat → @Create)
     */
    fixEvent(document, diagnostic) {
        const fixes = [];
        const eventMatch = diagnostic.message.match(/@([a-zA-Z0-9_]+)/);
        if (eventMatch) {
            const incorrectEvent = eventMatch[1];
            // Chercher d'abord une correspondance exacte avec casse différente
            let correctEvent = this.findCorrectEvent(incorrectEvent);
            if (correctEvent && correctEvent !== incorrectEvent) {
                const fix = new vscode.CodeAction(`Corriger en '@${correctEvent}'`, vscode.CodeActionKind.QuickFix);
                fix.edit = new vscode.WorkspaceEdit();
                fix.edit.replace(document.uri, diagnostic.range, correctEvent);
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;
                fixes.push(fix);
            }
            else if (!correctEvent) {
                // Si pas de correspondance exacte, chercher des événements similaires
                const suggestions = this.findSimilarEvents(incorrectEvent, 3);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '@${suggestion}'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0) {
                        fix.isPreferred = true;
                    }
                    fixes.push(fix);
                }
            }
        }
        return fixes;
    }
    /**
     * Correction des mots-clés de section ([itemdef] → [ITEMDEF], [ITEMDF] → [ITEMDEF])
     */
    fixSectionKeyword(document, diagnostic) {
        const fixes = [];
        const keywordMatch = diagnostic.message.match(/\[([a-zA-Z0-9_]+)\]/);
        if (keywordMatch) {
            const incorrectKeyword = keywordMatch[1];
            // Chercher d'abord une correspondance exacte avec casse différente
            let correctKeyword = this.findCorrectKeyword(incorrectKeyword);
            // Si pas trouvé, chercher des mots similaires (fautes de frappe)
            if (!correctKeyword) {
                const suggestions = this.findSimilarKeywords(incorrectKeyword, 3);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '[${suggestion}]'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0) {
                        fix.isPreferred = true; // Premier choix préféré
                    }
                    fixes.push(fix);
                }
            }
            else if (correctKeyword !== incorrectKeyword) {
                const fix = new vscode.CodeAction(`Corriger en '[${correctKeyword}]'`, vscode.CodeActionKind.QuickFix);
                fix.edit = new vscode.WorkspaceEdit();
                fix.edit.replace(document.uri, diagnostic.range, correctKeyword);
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;
                fixes.push(fix);
            }
        }
        return fixes;
    }
    /**
     * Correction des fonctions et propriétés
     */
    fixFunctionOrProperty(document, diagnostic) {
        const fixes = [];
        const text = document.getText(diagnostic.range);
        const isFunction = diagnostic.message.includes("fonction");
        const isProperty = diagnostic.message.includes("propriété");
        if (isFunction) {
            const correctFunction = this.findCorrectFunction(text);
            if (correctFunction && correctFunction !== text) {
                const fix = new vscode.CodeAction(`Corriger en '${correctFunction}'`, vscode.CodeActionKind.QuickFix);
                fix.edit = new vscode.WorkspaceEdit();
                fix.edit.replace(document.uri, diagnostic.range, correctFunction);
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;
                fixes.push(fix);
            }
            else if (!correctFunction) {
                const suggestions = this.findSimilarFunctions(text);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0)
                        fix.isPreferred = true;
                    fixes.push(fix);
                }
            }
        }
        if (isProperty) {
            const correctProperty = this.findCorrectProperty(text);
            if (correctProperty && correctProperty !== text) {
                const fix = new vscode.CodeAction(`Corriger en '${correctProperty}'`, vscode.CodeActionKind.QuickFix);
                fix.edit = new vscode.WorkspaceEdit();
                fix.edit.replace(document.uri, diagnostic.range, correctProperty);
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;
                fixes.push(fix);
            }
            else if (!correctProperty) {
                const suggestions = this.findSimilarProperties(text);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0)
                        fix.isPreferred = true;
                    fixes.push(fix);
                }
            }
        }
        return fixes;
    }
    findCorrectEvent(incorrectEvent) {
        const incorrectUpper = incorrectEvent.toUpperCase();
        for (const event of rules_1.KNOWLEDGE_BASE.events) {
            if (event.toUpperCase() === incorrectUpper) {
                return event;
            }
        }
        return null;
    }
    findCorrectKeyword(incorrectKeyword) {
        const incorrectUpper = incorrectKeyword.toUpperCase();
        for (const keyword of rules_1.KNOWLEDGE_BASE.keywords) {
            if (keyword.toUpperCase() === incorrectUpper) {
                return keyword;
            }
        }
        return null;
    }
    findCorrectFunction(incorrectFunction) {
        const incorrectUpper = incorrectFunction.toUpperCase();
        for (const func of rules_1.KNOWLEDGE_BASE.functions) {
            if (func.toUpperCase() === incorrectUpper) {
                return func;
            }
        }
        return null;
    }
    findCorrectProperty(incorrectProperty) {
        const incorrectUpper = incorrectProperty.toUpperCase();
        for (const prop of rules_1.KNOWLEDGE_BASE.properties) {
            if (prop.toUpperCase() === incorrectUpper) {
                return prop;
            }
        }
        return null;
    }
    /**
     * Calcule la distance de Levenshtein entre deux chaînes
     */
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1].toUpperCase() === str2[j - 1].toUpperCase() ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        return matrix[len1][len2];
    }
    /**
     * Trouve les mots-clés similaires (pour détecter les fautes de frappe)
     */
    findSimilarKeywords(incorrectKeyword, maxDistance = 3) {
        const suggestions = [];
        for (const keyword of rules_1.KNOWLEDGE_BASE.keywords) {
            const distance = this.levenshteinDistance(incorrectKeyword, keyword);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({ keyword, distance });
            }
        }
        // Trier par distance (les plus proches en premier)
        suggestions.sort((a, b) => a.distance - b.distance);
        // Retourner maximum 3 suggestions
        return suggestions.slice(0, 3).map(s => s.keyword);
    }
    /**
     * Trouve les événements similaires
     */
    findSimilarEvents(incorrectEvent, maxDistance = 3) {
        const suggestions = [];
        for (const event of rules_1.KNOWLEDGE_BASE.events) {
            const distance = this.levenshteinDistance(incorrectEvent, event);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({ event, distance });
            }
        }
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.event);
    }
    /**
     * Trouve les propriétés similaires (pour détecter les fautes de frappe)
     */
    findSimilarProperties(incorrectProperty, maxDistance = 2) {
        const suggestions = [];
        for (const property of rules_1.KNOWLEDGE_BASE.properties) {
            const distance = this.levenshteinDistance(incorrectProperty, property);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({ property, distance });
            }
        }
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.property);
    }
    /**
     * Trouve les fonctions similaires (pour détecter les fautes de frappe)
     */
    findSimilarFunctions(incorrectFunction, maxDistance = 2) {
        const suggestions = [];
        for (const func of rules_1.KNOWLEDGE_BASE.functions) {
            const distance = this.levenshteinDistance(incorrectFunction, func);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({ func, distance });
            }
        }
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.func);
    }
    addDefname(document, diagnostic) {
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        const match = lineText.match(/^\s*\[(ITEMDEF|CHARDEF)/i);
        if (match) {
            const defType = match[1].toUpperCase();
            const defnamePrefix = defType === 'ITEMDEF' ? 'i_' : 'c_';
            const fix = new vscode.CodeAction(`Ajouter la propriété DEFNAME`, vscode.CodeActionKind.QuickFix);
            fix.edit = new vscode.WorkspaceEdit();
            const insertPosition = new vscode.Position(line.lineNumber + 1, 0);
            const textToInsert = `DEFNAME=${defnamePrefix}new_${defType.toLowerCase()}\n`;
            fix.edit.insert(document.uri, insertPosition, textToInsert);
            fix.diagnostics = [diagnostic];
            fix.isPreferred = true;
            return fix;
        }
        return undefined;
    }
}
exports.SphereScriptCodeActionProvider = SphereScriptCodeActionProvider;
//# sourceMappingURL=codeActions.js.map