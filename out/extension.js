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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const rules_1 = require("./rules");
const codeActions_1 = require("./codeActions");
const structureValidator_1 = require("./structureValidator");
const formatting_1 = require("./formatting");
const completion_1 = require("./completion");
const symbolProvider_1 = require("./symbolProvider");
const hoverProvider_1 = require("./hoverProvider");
const autocompleteData_1 = require("./autocompleteData");
let diagnosticCollection;
let isScanningWorkspace = false; // Drapeau pour indiquer si un scan complet est en cours
let debounceTimer; // Pour le debounce des diagnostics en temps réel
function activate(context) {
    console.log('L\'extension SphereScript est activée.');
    diagnosticCollection = vscode.languages.createDiagnosticCollection('sphereScriptLinter');
    context.subscriptions.push(diagnosticCollection);
    // Enregistrer le Completion Item Provider
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('scp', new completion_1.SphereScriptCompletionItemProvider(), '[', '.', '@' // Caractères déclencheurs
    ));
    // Enregistrer le Code Action Provider
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('scp', new codeActions_1.SphereScriptCodeActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }));
    // Enregistrer le Document Formatting Edit Provider
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('scp', new formatting_1.SphereScriptDocumentFormattingEditProvider()));
    // Initialise le fournisseur de symboles.
    symbolProvider_1.SphereScriptSymbolProvider.initialize(context).then(() => {
        // Une fois que la table de symboles est construite, lance le scan complet des diagnostics.
        scanAllWorkspaceForDiagnostics(context);
    });
    // Enregistrer le Definition Provider
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('scp', new symbolProvider_1.SphereScriptDefinitionProvider()));
    // Enregistrer le Hover Provider
    context.subscriptions.push(vscode.languages.registerHoverProvider('scp', new hoverProvider_1.SphereScriptHoverProvider()));
    // --- Gestion des diagnostics pour les fichiers ouverts et modifiés ---
    const updateDiagnosticsTrigger = (document) => {
        // N'exécute pas les diagnostics en temps réel si un scan complet est en cours
        if (document.languageId === 'scp' && !isScanningWorkspace) {
            updateDiagnostics(document);
        }
    };
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
        // Ajout d'un délai pour éviter les conflits de rafraîchissement de l'interface.
        setTimeout(() => {
            updateDiagnosticsTrigger(document);
        }, 100);
    }));
    // Utilise un debounce pour onDidChangeTextDocument afin d'éviter les appels trop fréquents
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            updateDiagnosticsTrigger(event.document);
        }, 300); // Délai de 300ms
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(updateDiagnosticsTrigger));
    // CORRECTION ICI : L'écouteur onDidCloseTextDocument ne supprime les diagnostics
    // que si un scan complet n'est PAS en cours.
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        if (document.languageId === 'scp' && !isScanningWorkspace) {
            diagnosticCollection.delete(document.uri);
        }
    }));
    // La ligne suivante est supprimée car le scan complet des diagnostics gérera tous les fichiers.
    // vscode.workspace.textDocuments.forEach(doc => updateDiagnosticsTrigger(doc));
}
/**
 * Scanne tous les fichiers .scp de l'espace de travail pour les diagnostics
 * et affiche une barre de progression.
 */
async function scanAllWorkspaceForDiagnostics(context) {
    if (isScanningWorkspace) {
        vscode.window.showInformationMessage('[Extension] Full workspace diagnostic scan already in progress. Skipping.');
        return;
    }
    isScanningWorkspace = true; // Active le drapeau de scan en cours
    vscode.window.showInformationMessage('[Extension] Starting full workspace diagnostic scan...');
    // Efface tous les diagnostics existants avant de commencer un nouveau scan complet
    diagnosticCollection.clear();
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Scanning SphereScript for diagnostics...",
        cancellable: false
    }, async (progress) => {
        const allScpFiles = await vscode.workspace.findFiles('**/*.scp', '**/node_modules/**');
        let processedCount = 0;
        const totalFiles = allScpFiles.length;
        // Map pour collecter tous les diagnostics avant de les appliquer en une seule fois
        const allWorkspaceDiagnostics = new Map();
        for (const fileUri of allScpFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileDiagnostics = [];
                validateSymbols(document, fileDiagnostics);
                (0, structureValidator_1.validateCodeStructure)(document, fileDiagnostics);
                validateWithRegexRules(document, fileDiagnostics);
                validateSectionDefnames(document, fileDiagnostics);
                validateBrackets(document, fileDiagnostics);
                diagnosticCollection.set(document.uri, fileDiagnostics);
            }
            catch (error) {
                vscode.window.showErrorMessage(`[Extension] Error processing diagnostics for ${fileUri.fsPath}: ${error.message}`);
            }
            finally {
                processedCount++;
                progress.report({ message: `Processed ${processedCount}/${totalFiles} files.`, increment: (100 / totalFiles) });
            }
        }
        vscode.window.showInformationMessage(`[Extension] Finished full workspace diagnostic scan. Processed ${processedCount} files.`);
    });
    isScanningWorkspace = false; // Désactive le drapeau une fois le scan terminé
}
function updateDiagnostics(document) {
    vscode.window.showInformationMessage(`Updating diagnostics for: ${document.uri.fsPath}`);
    const diagnostics = [];
    validateSymbols(document, diagnostics);
    (0, structureValidator_1.validateCodeStructure)(document, diagnostics);
    validateWithRegexRules(document, diagnostics);
    validateSectionDefnames(document, diagnostics);
    validateBrackets(document, diagnostics);
    diagnosticCollection.set(document.uri, diagnostics);
}
function levenshteinDistance(str1, str2) {
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
function validateSymbols(document, diagnostics) {
    const lineCount = document.lineCount;
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        // Règle : Vérifier les espaces avant les déclarations de section comme [ITEMDEF]
        const leadingWhitespaceMatch = line.text.match(/^(\s+)\[/);
        if (leadingWhitespaceMatch) {
            const range = new vscode.Range(lineIndex, 0, lineIndex, leadingWhitespaceMatch[1].length);
            const diagnostic = new vscode.Diagnostic(range, 'Les déclarations de section (ex: [ITEMDEF]) ne doivent pas être précédées par des espaces ou des tabulations.', vscode.DiagnosticSeverity.Warning);
            diagnostic.source = 'Sphere Script Linter';
            diagnostic.code = 'leading-whitespace-section';
            diagnostics.push(diagnostic);
        }
        // Règle : Vérifier les espaces après le crochet d'ouverture '['
        const insideWhitespaceMatch = line.text.match(/^\s*\[(\s+)/);
        if (insideWhitespaceMatch) {
            const trimmedText = line.text.trim();
            const range = new vscode.Range(lineIndex, line.text.indexOf('[') + 1, lineIndex, line.text.indexOf('[') + 1 + insideWhitespaceMatch[1].length);
            const diagnostic = new vscode.Diagnostic(range, 'Aucun espace n\'est autorisé entre le crochet  et le mot-clé de la section.', vscode.DiagnosticSeverity.Warning);
            diagnostic.source = 'Sphere Script Linter';
            diagnostic.code = 'inner-whitespace-section';
            diagnostics.push(diagnostic);
        }
        const text = line.text.trim();
        if (text.length === 0 || text.startsWith('//'))
            continue;
        // Valider les sections comme [ITEMDEF ...]
        let match = text.match(/^\s*\[([a-zA-Z0-9_]+)/);
        if (match) {
            const keyword = match[1];
            const upperKeyword = keyword.toUpperCase();
            if (!rules_1.KNOWLEDGE_BASE.keywords.has(upperKeyword) && upperKeyword !== 'EOF' && !symbolProvider_1.SphereScriptSymbolProvider.getSymbolLocation(upperKeyword)) {
                const bracketPos = line.text.indexOf('[');
                const keywordStartPos = bracketPos + 1;
                const range = new vscode.Range(lineIndex, keywordStartPos, lineIndex, keywordStartPos + keyword.length);
                const diagnostic = new vscode.Diagnostic(range, `Le mot-clé de section '[${keyword}]' est inconnu ou non défini dans l'espace de travail.`, vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'unknown-section-keyword';
                diagnostics.push(diagnostic);
            }
            continue;
        }
        // Valider les propriétés qui pourraient être des fautes de frappe ou des références à des DEFNAMEs
        const propMatch = text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/);
        if (propMatch && !text.includes('.')) {
            const propertyName = propMatch[1];
            const upperProp = propertyName.toUpperCase();
            if (upperProp !== 'ON' && !rules_1.KNOWLEDGE_BASE.properties.has(upperProp) && !rules_1.KNOWLEDGE_BASE.functions.has(upperProp) && !symbolProvider_1.SphereScriptSymbolProvider.getSymbolLocation(upperProp)) {
                if (!/\d$/.test(upperProp)) {
                    let bestMatch = null;
                    let minDistance = 3;
                    for (const prop of rules_1.KNOWLEDGE_BASE.properties) {
                        const distance = levenshteinDistance(upperProp, prop);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = prop;
                        }
                    }
                    if (bestMatch) {
                        const propertyStartPos = line.text.indexOf(propertyName);
                        const range = new vscode.Range(lineIndex, propertyStartPos, lineIndex, propertyStartPos + propertyName.length);
                        const diagnostic = new vscode.Diagnostic(range, `La propriété '${propertyName}' est inconnue ou non définie. Suggestion: '${bestMatch}'`, vscode.DiagnosticSeverity.Error);
                        diagnostic.source = 'Sphere Script Linter';
                        diagnostic.code = 'unknown-property';
                        diagnostics.push(diagnostic);
                        continue;
                    }
                }
            }
        }
        // Ignorer les lignes de définition de messages
        if (text.match(/^[a-z_][a-z0-9_]*\s+/i) && !text.includes('=')) {
            continue;
        }
        // --- SECTION DE VALIDATION DES ÉVÉNEMENTS ON=@ SUPPRIMÉE ---
        // Valider les appels de fonction/propriété d'objets (ex: SRC.DEX, SERV.NEWITEM)
        const objectPropertyOrFunctionCallRegex = /\b([A-Z_][A-Z0-9_]*)\.([A-Z_][A-Z0-9_]*)\b/gi;
        while ((match = objectPropertyOrFunctionCallRegex.exec(line.text)) !== null) {
            if (match.index === undefined)
                continue;
            const objectPrefix = match[1];
            const memberName = match[2];
            const commentIndex = line.text.indexOf('//');
            if (commentIndex !== -1 && match.index > commentIndex)
                continue;
            const textBefore = line.text.substring(0, match.index);
            const quoteCount = (textBefore.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0)
                continue;
            const upperMember = memberName.toUpperCase();
            let isKnown = false;
            switch (objectPrefix.toUpperCase()) {
                case 'I':
                    isKnown = autocompleteData_1.autocompleteData.item_properties.includes(upperMember);
                    break;
                case 'SRC':
                    isKnown = autocompleteData_1.autocompleteData.char_properties.includes(upperMember) || autocompleteData_1.autocompleteData.triggers.includes(upperMember);
                    break;
                case 'SERV':
                    isKnown = autocompleteData_1.autocompleteData.serv_properties.includes(upperMember);
                    break;
                case 'NEW':
                    isKnown = autocompleteData_1.autocompleteData.new_properties.includes(upperMember);
                    break;
                case 'ARGO':
                    isKnown = autocompleteData_1.autocompleteData.argo_properties.includes(upperMember);
                    break;
                default:
                    isKnown = rules_1.KNOWLEDGE_BASE.properties.has(upperMember) || rules_1.KNOWLEDGE_BASE.functions.has(upperMember) || !!symbolProvider_1.SphereScriptSymbolProvider.getSymbolLocation(upperMember);
                    break;
            }
            if (!isKnown) {
                const startCol = match.index + objectPrefix.length + 1;
                const range = new vscode.Range(lineIndex, startCol, lineIndex, startCol + memberName.length);
                const diagnostic = new vscode.Diagnostic(range, `La propriété/fonction '${memberName}' de l'objet '${objectPrefix}' est potentiellement inconnue ou non définie.`, vscode.DiagnosticSeverity.Hint);
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'unknown-object-member';
                diagnostics.push(diagnostic);
            }
        }
    }
}
function findCorrectCase(knowledgeSet, value) {
    const lowerValue = value.toLowerCase();
    for (const item of knowledgeSet) {
        if (item.toLowerCase() === lowerValue) {
            return item;
        }
    }
    return null;
}
function validateWithRegexRules(document, diagnostics) {
    const text = document.getText();
    rules_1.DISCOVERED_RULES.forEach(rule => {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(text)) !== null) {
            if (match.index === rule.regex.lastIndex) {
                rule.regex.lastIndex++;
            }
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            const diagnostic = new vscode.Diagnostic(range, rule.message, rules_1.VscodeSeverity[rule.type]);
            diagnostic.code = rule.id;
            diagnostic.source = 'Sphere Script Linter';
            diagnostics.push(diagnostic);
        }
    });
}
function validateSectionDefnames(document, diagnostics) {
    let currentSection = null;
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        if (text.length === 0 || text.startsWith('//')) {
            continue;
        }
        const sectionMatch = text.match(/^\s*\[(ITEMDEF|CHARDEF)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (sectionMatch) {
            currentSection = { name: sectionMatch[2], line: lineIndex };
            continue;
        }
        if (text.startsWith('[')) {
            currentSection = null;
        }
        if (currentSection) {
            const defnameMatch = text.match(/^DEFNAME\s*=\s*(.*)/i);
            if (defnameMatch) {
                const defnameValue = defnameMatch[1].trim();
                if (defnameValue.toLowerCase() !== currentSection.name.toLowerCase()) {
                    const valueStartIndex = line.text.toUpperCase().indexOf(defnameValue.toUpperCase());
                    const range = new vscode.Range(lineIndex, valueStartIndex, lineIndex, valueStartIndex + defnameValue.length);
                    const diagnostic = new vscode.Diagnostic(range, `Le DEFNAME \"${defnameValue}\" ne correspond pas à la définition de la section \"${currentSection.name}\".`, vscode.DiagnosticSeverity.Error);
                    diagnostic.source = 'Sphere Script Linter';
                    diagnostic.code = 'defname-mismatch';
                    diagnostics.push(diagnostic);
                }
                currentSection = null;
            }
        }
    }
}
/**
 * Validates that all brackets like <> and () are properly matched and closed, using a tokenizer.
 * @param document The document to validate.
 * @param diagnostics The collection of diagnostics to add to.
 */
function validateBrackets(document, diagnostics) {
    // Valider ligne par ligne au lieu de tout le document
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const lineText = line.text;
        // Ignorer les commentaires et lignes vides
        if (lineText.trim().startsWith('//') || lineText.trim().length === 0) {
            continue;
        }
        const parenStack = [];
        const angleStack = [];
        const tokens = Array.from(tokenize(lineText));
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            switch (token.type) {
                case 'PAREN_OPEN':
                    parenStack.push(token.index);
                    break;
                case 'PAREN_CLOSE':
                    if (parenStack.length > 0) {
                        parenStack.pop();
                    }
                    else {
                        const pos = new vscode.Position(lineIndex, token.index);
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, 1)), 'Parenthèse fermante `)` inattendue.', vscode.DiagnosticSeverity.Error));
                    }
                    break;
                case 'LT': {
                    const prevToken = i > 0 ? tokens[i - 1] : null;
                    if (!prevToken || ['OPERATOR', 'OPERATOR_COMPARE', 'PAREN_OPEN', 'COMMA'].includes(prevToken.type)) {
                        angleStack.push(token.index);
                    }
                    break;
                }
                case 'GT':
                    if (angleStack.length > 0) {
                        angleStack.pop();
                    }
                    break;
            }
        }
        // Vérifier les brackets non fermés sur cette ligne
        angleStack.forEach(index => {
            const pos = new vscode.Position(lineIndex, index);
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, 1)), 'Chevron ouvrant `<` non fermé.', vscode.DiagnosticSeverity.Error));
        });
        parenStack.forEach(index => {
            const pos = new vscode.Position(lineIndex, index);
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, 1)), 'Parenthèse ouvrante `(` non fermée.', vscode.DiagnosticSeverity.Error));
        });
    }
}
function* tokenize(text) {
    const tokenDefinitions = [
        { type: 'COMMENT', regex: /^\/\/.*/ },
        { type: 'STRING', regex: /^"[^"]*"/ },
        { type: 'OPERATOR_COMPARE', regex: /^>>|^<<|^>=|^<=|^==|^!=/ },
        { type: 'KEYWORD', regex: /^\b(if|elif|elseif|else|endif|return|while|for|serv|src|new|argo|args|argn|argn1|i|def|local|argv|ref1|ref2|act|function|rand|magicresistance|healing|npc)\b/i },
        { type: 'PAREN_OPEN', regex: /^\(/ },
        { type: 'PAREN_CLOSE', regex: /^\)/ },
        { type: 'BRACKET_OPEN', regex: /^\[/ },
        { type: 'BRACKET_CLOSE', regex: /^\]/ },
        { type: 'OPERATOR_SINGLE', regex: /^<|^>/ },
        { type: 'OPERATOR', regex: /^[&|^~=!+\-\*\/%?:]/ },
        { type: 'IDENTIFIER', regex: /^[a-zA-Z_][a-zA-Z0-9_.]*/ },
        { type: 'NUMBER', regex: /^0x[0-9a-fA-F]+|^\d+(\.\d+)?/ },
        { type: 'COMMA', regex: /^,/ },
        { type: 'WHITESPACE', regex: /^\s+/ },
        { type: 'UNKNOWN', regex: /^./ },
    ];
    let currentIndex = 0;
    let remainingText = text;
    while (remainingText.length > 0) {
        let matched = false;
        // Gestion spéciale pour VARIABLE_ACCESS
        if (remainingText[0] === '<') {
            let depth = 1;
            let i = 1;
            while (i < remainingText.length && depth > 0) {
                if (remainingText[i] === '<') {
                    depth++;
                }
                else if (remainingText[i] === '>') {
                    depth--;
                }
                i++;
            }
            // Si on a trouvé le > fermant ET que c'est un VARIABLE_ACCESS valide
            if (depth === 0 && i > 1) {
                const value = remainingText.substring(0, i);
                const content = value.substring(1, value.length - 1).trim();
                // Si ça ressemble à une variable
                if (content.length > 0 && (/[a-zA-Z_]/.test(content) || content.includes('.') || content.includes(','))) {
                    yield {
                        type: 'VARIABLE_ACCESS',
                        value: value,
                        index: currentIndex
                    };
                    currentIndex += value.length;
                    remainingText = remainingText.substring(value.length);
                    matched = true;
                    continue;
                }
            }
            // IMPORTANT : Si ce n'est pas un VARIABLE_ACCESS valide,
            // on laisse les règles normales gérer le < comme OPERATOR_SINGLE
        }
        // Logique normale pour les autres tokens
        for (const def of tokenDefinitions) {
            const match = remainingText.match(def.regex);
            if (match) {
                const value = match[0];
                if (def.type !== 'WHITESPACE') {
                    yield {
                        type: def.type,
                        value: value,
                        index: currentIndex
                    };
                }
                currentIndex += value.length;
                remainingText = remainingText.substring(value.length);
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Fallback : consommer 1 caractère pour éviter la boucle infinie
            yield {
                type: 'UNKNOWN',
                value: remainingText[0],
                index: currentIndex
            };
            currentIndex++;
            remainingText = remainingText.substring(1);
        }
    }
}
function deactivate() {
    console.log('L\'extension SphereScript est désactivée.');
    if (diagnosticCollection) {
        diagnosticCollection.clear();
        diagnosticCollection.dispose();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}
//# sourceMappingURL=extension.js.map