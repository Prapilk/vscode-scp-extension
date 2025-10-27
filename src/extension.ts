import * as vscode from 'vscode';
import { DISCOVERED_RULES, KNOWLEDGE_BASE, VscodeSeverity, LinterRule } from './rules';
import { SphereScriptCodeActionProvider } from './codeActions';
import { validateCodeStructure } from './structureValidator';
import { SphereScriptDocumentFormattingEditProvider } from './formatting';
import { SphereScriptCompletionItemProvider } from './completion';
import { SphereScriptSymbolProvider, SphereScriptDefinitionProvider } from './symbolProvider';
import { SphereScriptHoverProvider } from './hoverProvider';
import { autocompleteData } from './autocompleteData';

let diagnosticCollection: vscode.DiagnosticCollection;
let isScanningWorkspace: boolean = false; // Drapeau pour indiquer si un scan complet est en cours
let debounceTimer: NodeJS.Timeout | undefined; // Pour le debounce des diagnostics en temps réel

export function activate(context: vscode.ExtensionContext) {
    console.log('L\'extension SphereScript est activée.');

    diagnosticCollection = vscode.languages.createDiagnosticCollection('sphereScriptLinter');
    context.subscriptions.push(diagnosticCollection);

    // Enregistrer le Completion Item Provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'scp',
            new SphereScriptCompletionItemProvider(),
            '[', '.', '@' // Caractères déclencheurs
        )
    );

    // Enregistrer le Code Action Provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            'scp',
            new SphereScriptCodeActionProvider(),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            }
        )
    );

    // Enregistrer le Document Formatting Edit Provider
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            'scp',
            new SphereScriptDocumentFormattingEditProvider()
        )
    );

    // Initialise le fournisseur de symboles.
    SphereScriptSymbolProvider.initialize(context).then(() => {
        // Une fois que la table de symboles est construite, lance le scan complet des diagnostics.
        scanAllWorkspaceForDiagnostics(context);
    });

    // Enregistrer le Definition Provider
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            'scp',
            new SphereScriptDefinitionProvider()
        )
    );

    // Enregistrer le Hover Provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            'scp',
            new SphereScriptHoverProvider()
        )
    );

    // --- Gestion des diagnostics pour les fichiers ouverts et modifiés ---
    const updateDiagnosticsTrigger = (document: vscode.TextDocument) => {
        // N'exécute pas les diagnostics en temps réel si un scan complet est en cours
        if (document.languageId === 'scp' && !isScanningWorkspace) {
            updateDiagnostics(document);
        }
    };

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(updateDiagnosticsTrigger));

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
async function scanAllWorkspaceForDiagnostics(context: vscode.ExtensionContext): Promise<void> {
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
        const allWorkspaceDiagnostics = new Map<vscode.Uri, vscode.Diagnostic[]>();

        for (const fileUri of allScpFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileDiagnostics: vscode.Diagnostic[] = [];
                validateSymbols(document, fileDiagnostics);
                validateCodeStructure(document, fileDiagnostics);
                validateWithRegexRules(document, fileDiagnostics);

                diagnosticCollection.set(document.uri, fileDiagnostics);
            } catch (error: any) {
                vscode.window.showErrorMessage(`[Extension] Error processing diagnostics for ${fileUri.fsPath}: ${error.message}`);
            } finally {
                processedCount++;
                progress.report({ message: `Processed ${processedCount}/${totalFiles} files.`, increment: (100 / totalFiles) });
            }
        }

        vscode.window.showInformationMessage(`[Extension] Finished full workspace diagnostic scan. Processed ${processedCount} files.`);
    });

    isScanningWorkspace = false; // Désactive le drapeau une fois le scan terminé
}


function updateDiagnostics(document: vscode.TextDocument): void {
    vscode.window.showInformationMessage(`Updating diagnostics for: ${document.uri.fsPath}`);
    const diagnostics: vscode.Diagnostic[] = [];

    validateSymbols(document, diagnostics);
    validateCodeStructure(document, diagnostics);
    validateWithRegexRules(document, diagnostics);

    diagnosticCollection.set(document.uri, diagnostics);
}

function levenshteinDistance(str1: string, str2: string): number {
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

function validateSymbols(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
    const lineCount = document.lineCount;
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        if (text.length === 0 || text.startsWith('//')) continue;

        // Valider les sections comme [ITEMDEF ...]
        let match = text.match(/^\s*\[([a-zA-Z0-9_]+)/);
        if (match) {
            const keyword = match[1];
            const upperKeyword = keyword.toUpperCase();

            if (!KNOWLEDGE_BASE.keywords.has(upperKeyword) && upperKeyword !== 'EOF' && !SphereScriptSymbolProvider.getSymbolLocation(upperKeyword)) {
                const bracketPos = line.text.indexOf('[');
                const keywordStartPos = bracketPos + 1;
                const range = new vscode.Range(
                    lineIndex,
                    keywordStartPos,
                    lineIndex,
                    keywordStartPos + keyword.length
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Le mot-clé de section '[${keyword}]' est inconnu ou non défini dans l'espace de travail.`,
                    vscode.DiagnosticSeverity.Error
                );
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

            if (upperProp !== 'ON' && !KNOWLEDGE_BASE.properties.has(upperProp) && !KNOWLEDGE_BASE.functions.has(upperProp) && !SphereScriptSymbolProvider.getSymbolLocation(upperProp)) {

                if (!/\d$/.test(upperProp)) {
                    let bestMatch: string | null = null;
                    let minDistance = 3;

                    for (const prop of KNOWLEDGE_BASE.properties) {
                        const distance = levenshteinDistance(upperProp, prop);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = prop;
                        }
                    }

                    if (bestMatch) {
                        const propertyStartPos = line.text.indexOf(propertyName);
                        const range = new vscode.Range(
                            lineIndex,
                            propertyStartPos,
                            lineIndex,
                            propertyStartPos + propertyName.length
                        );
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `La propriété '${propertyName}' est inconnue ou non définie. Suggestion: '${bestMatch}'`,
                            vscode.DiagnosticSeverity.Error
                        );
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
            if (match.index === undefined) continue;

            const objectPrefix = match[1];
            const memberName = match[2];

            const commentIndex = line.text.indexOf('//');
            if (commentIndex !== -1 && match.index > commentIndex) continue;

            const textBefore = line.text.substring(0, match.index);
            const quoteCount = (textBefore.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) continue;

            const upperMember = memberName.toUpperCase();
            let isKnown = false;

            switch (objectPrefix.toUpperCase()) {
                case 'I':
                    isKnown = autocompleteData.item_properties.includes(upperMember);
                    break;
                case 'SRC':
                    isKnown = autocompleteData.char_properties.includes(upperMember) || autocompleteData.triggers.includes(upperMember);
                    break;
                case 'SERV':
                    isKnown = autocompleteData.serv_properties.includes(upperMember);
                    break;
                case 'NEW':
                    isKnown = autocompleteData.new_properties.includes(upperMember);
                    break;
                case 'ARGO':
                    isKnown = autocompleteData.argo_properties.includes(upperMember);
                    break;
                default:
                    isKnown = KNOWLEDGE_BASE.properties.has(upperMember) || KNOWLEDGE_BASE.functions.has(upperMember) || !!SphereScriptSymbolProvider.getSymbolLocation(upperMember);
                    break;
            }

            if (!isKnown) {
                const startCol = match.index + objectPrefix.length + 1;
                const range = new vscode.Range(
                    lineIndex,
                    startCol,
                    lineIndex,
                    startCol + memberName.length
                );
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `La propriété/fonction '${memberName}' de l'objet '${objectPrefix}' est potentiellement inconnue ou non définie.`,
                    vscode.DiagnosticSeverity.Hint
                );
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'unknown-object-member';
                diagnostics.push(diagnostic);
            }
        }
    }
}

function findCorrectCase(knowledgeSet: Set<string>, value: string): string | null {
    const lowerValue = value.toLowerCase();
    for (const item of knowledgeSet) {
        if (item.toLowerCase() === lowerValue) {
            return item;
        }
    }
    return null;
}

function validateWithRegexRules(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
    const text = document.getText();
    DISCOVERED_RULES.forEach(rule => {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(text)) !== null) {
            if (match.index === rule.regex.lastIndex) {
                rule.regex.lastIndex++;
            }

            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);

            const range = new vscode.Range(startPos, endPos);

            const diagnostic = new vscode.Diagnostic(
                range,
                rule.message,
                VscodeSeverity[rule.type]
            );
            diagnostic.code = rule.id;
            diagnostic.source = 'Sphere Script Linter';
            diagnostics.push(diagnostic);
        }
    });
}

export function deactivate() {
    console.log('L\'extension SphereScript est désactivée.');
    if (diagnosticCollection) {
        diagnosticCollection.clear();
        diagnosticCollection.dispose();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}