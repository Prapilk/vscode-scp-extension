import * as vscode from 'vscode';
import { KNOWLEDGE_BASE } from './rules';

export class SphereScriptCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const codeActions: vscode.CodeAction[] = [];

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
    private fixEvent(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const fixes: vscode.CodeAction[] = [];
        const eventMatch = diagnostic.message.match(/@([a-zA-Z0-9_]+)/);
        
        if (eventMatch) {
            const incorrectEvent = eventMatch[1];
            
            // Chercher d'abord une correspondance exacte avec casse différente
            let correctEvent = this.findCorrectEvent(incorrectEvent);
            
            if (correctEvent && correctEvent !== incorrectEvent) {
                const fix = new vscode.CodeAction(
                    `Corriger en '@${correctEvent}'`,
                    vscode.CodeActionKind.QuickFix
                );
                fix.edit = new vscode.WorkspaceEdit();
                fix.edit.replace(document.uri, diagnostic.range, correctEvent);
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;
                fixes.push(fix);
            } else if (!correctEvent) {
                // Si pas de correspondance exacte, chercher des événements similaires
                const suggestions = this.findSimilarEvents(incorrectEvent, 3);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(
                        `Corriger en '@${suggestion}'`,
                        vscode.CodeActionKind.QuickFix
                    );
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
    private fixSectionKeyword(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const fixes: vscode.CodeAction[] = [];
        const keywordMatch = diagnostic.message.match(/\[([a-zA-Z0-9_]+)\]/);
        
        if (keywordMatch) {
            const incorrectKeyword = keywordMatch[1];
            
            // Chercher d'abord une correspondance exacte avec casse différente
            let correctKeyword = this.findCorrectKeyword(incorrectKeyword);
            
            // Si pas trouvé, chercher des mots similaires (fautes de frappe)
            if (!correctKeyword) {
                const suggestions = this.findSimilarKeywords(incorrectKeyword, 3);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(
                        `Corriger en '[${suggestion}]'`,
                        vscode.CodeActionKind.QuickFix
                    );
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0) {
                        fix.isPreferred = true; // Premier choix préféré
                    }
                    fixes.push(fix);
                }
            } else if (correctKeyword !== incorrectKeyword) {
                const fix = new vscode.CodeAction(
                    `Corriger en '[${correctKeyword}]'`,
                    vscode.CodeActionKind.QuickFix
                );
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
    private fixFunctionOrProperty(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const fixes: vscode.CodeAction[] = [];
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
            } else if (!correctFunction) {
                const suggestions = this.findSimilarFunctions(text);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0) fix.isPreferred = true;
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
            } else if (!correctProperty) {
                const suggestions = this.findSimilarProperties(text);
                for (const suggestion of suggestions) {
                    const fix = new vscode.CodeAction(`Corriger en '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, suggestion);
                    fix.diagnostics = [diagnostic];
                    if (fixes.length === 0) fix.isPreferred = true;
                    fixes.push(fix);
                }
            }
        }
        
        return fixes;
    }

    private findCorrectEvent(incorrectEvent: string): string | null {
        const incorrectUpper = incorrectEvent.toUpperCase();
        
        for (const event of KNOWLEDGE_BASE.events) {
            if (event.toUpperCase() === incorrectUpper) {
                return event;
            }
        }
        
        return null;
    }

    private findCorrectKeyword(incorrectKeyword: string): string | null {
        const incorrectUpper = incorrectKeyword.toUpperCase();
        
        for (const keyword of KNOWLEDGE_BASE.keywords) {
            if (keyword.toUpperCase() === incorrectUpper) {
                return keyword;
            }
        }
        
        return null;
    }

    private findCorrectFunction(incorrectFunction: string): string | null {
        const incorrectUpper = incorrectFunction.toUpperCase();
        
        for (const func of KNOWLEDGE_BASE.functions) {
            if (func.toUpperCase() === incorrectUpper) {
                return func;
            }
        }
        
        return null;
    }

    private findCorrectProperty(incorrectProperty: string): string | null {
        const incorrectUpper = incorrectProperty.toUpperCase();
        
        for (const prop of KNOWLEDGE_BASE.properties) {
            if (prop.toUpperCase() === incorrectUpper) {
                return prop;
            }
        }
        
        return null;
    }

    /**
     * Calcule la distance de Levenshtein entre deux chaînes
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix: number[][] = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1].toUpperCase() === str2[j - 1].toUpperCase() ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Trouve les mots-clés similaires (pour détecter les fautes de frappe)
     */
    private findSimilarKeywords(incorrectKeyword: string, maxDistance: number = 3): string[] {
        const suggestions: Array<{keyword: string, distance: number}> = [];
        
        for (const keyword of KNOWLEDGE_BASE.keywords) {
            const distance = this.levenshteinDistance(incorrectKeyword, keyword);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({keyword, distance});
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
    private findSimilarEvents(incorrectEvent: string, maxDistance: number = 3): string[] {
        const suggestions: Array<{event: string, distance: number}> = [];
        
        for (const event of KNOWLEDGE_BASE.events) {
            const distance = this.levenshteinDistance(incorrectEvent, event);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({event, distance});
            }
        }
        
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.event);
    }

    /**
     * Trouve les propriétés similaires (pour détecter les fautes de frappe)
     */
    private findSimilarProperties(incorrectProperty: string, maxDistance: number = 2): string[] {
        const suggestions: Array<{property: string, distance: number}> = [];
        
        for (const property of KNOWLEDGE_BASE.properties) {
            const distance = this.levenshteinDistance(incorrectProperty, property);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({property, distance});
            }
        }
        
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.property);
    }

    /**
     * Trouve les fonctions similaires (pour détecter les fautes de frappe)
     */
    private findSimilarFunctions(incorrectFunction: string, maxDistance: number = 2): string[] {
        const suggestions: Array<{func: string, distance: number}> = [];
        
        for (const func of KNOWLEDGE_BASE.functions) {
            const distance = this.levenshteinDistance(incorrectFunction, func);
            if (distance <= maxDistance && distance > 0) {
                suggestions.push({func, distance});
            }
        }
        
        suggestions.sort((a, b) => a.distance - b.distance);
        return suggestions.slice(0, 3).map(s => s.func);
    }

    private addDefname(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction | undefined {
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        const match = lineText.match(/^\s*\[(ITEMDEF|CHARDEF)/i);

        if (match) {
            const defType = match[1].toUpperCase();
            const defnamePrefix = defType === 'ITEMDEF' ? 'i_' : 'c_';

            const fix = new vscode.CodeAction(
                `Ajouter la propriété DEFNAME`,
                vscode.CodeActionKind.QuickFix
            );
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