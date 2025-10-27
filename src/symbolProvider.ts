// symbolProvider.ts (ou sphereScriptProviders.ts)
import * as vscode from 'vscode';

/**
 * Représente l'emplacement d'un symbole (définition) dans un document.
 */
interface SymbolLocation {
    uri: vscode.Uri;
    range: vscode.Range;
}

/**
 * Gère la construction et la maintenance d'une table de symboles globale pour tous les fichiers SphereScript (.scp)
 * dans l'espace de travail.
 */
export class SphereScriptSymbolProvider {
    private static symbolMap: Map<string, SymbolLocation> = new Map();
    private static isInitialized: boolean = false;

    private static readonly sectionDefinitionRegex =
        /^\[(FUNCTION|ITEMDEF|CHARDEF|SPELL|SKILL|DIALOG|MENU|SKILLMENU|TEMPLATE|REGIONTYPE|SPAWN|TYPEDEF|DEFMESSAGE|SPEECH|EVENTS)\s+([a-zA-Z0-9_]+)\]/i;

    private static readonly defnameDefinitionRegex =
        /^DEFNAME=([a-zA-Z0-9_]+)/i;

    /**
     * Construit ou reconstruit la table de symboles pour un document donné.
     * @param document Le document texte à analyser.
     */
    public static async buildSymbolTable(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'scp') {
            return;
        }

        console.log(`[SphereScriptSymbolProvider] Building symbol table for: ${document.uri.fsPath}`);
        SphereScriptSymbolProvider.clearSymbolsForDocument(document.uri);

        const text = document.getText();
        const lines = text.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 1. Cherche les définitions de sections [TYPE nom]
            let match = line.match(SphereScriptSymbolProvider.sectionDefinitionRegex);
            if (match) {
                const sectionType = match[1].toUpperCase();
                const defName = match[2].toUpperCase();
                const startPos = new vscode.Position(i, line.indexOf(match[0]));
                const endPos = new vscode.Position(i, line.indexOf(match[0]) + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                // Stocke le nom exact (ex: 01bc3, t_equipitem)
                SphereScriptSymbolProvider.symbolMap.set(defName, { uri: document.uri, range: range });
                console.log(`[SphereScriptSymbolProvider] Added section symbol: ${defName} (${sectionType}) from ${document.uri.fsPath}`);
                continue;
            }

            // 2. Cherche les DEFNAME
            match = line.match(SphereScriptSymbolProvider.defnameDefinitionRegex);
            if (match) {
                const defName = match[1].toUpperCase();
                const startPos = new vscode.Position(i, line.indexOf(match[1]));
                const endPos = new vscode.Position(i, line.indexOf(match[1]) + match[1].length);
                const range = new vscode.Range(startPos, endPos);

                // Stocke le DEFNAME (ex: i_shield_chaos)
                if (!SphereScriptSymbolProvider.symbolMap.has(defName)) {
                    SphereScriptSymbolProvider.symbolMap.set(defName, { uri: document.uri, range: range });
                    console.log(`[SphereScriptSymbolProvider] Added DEFNAME symbol: ${defName} from ${document.uri.fsPath}`);
                }
            }
        }
        console.log(`[SphereScriptSymbolProvider] Finished building for: ${document.uri.fsPath}. Total symbols: ${SphereScriptSymbolProvider.symbolMap.size}`);
    }

    /**
     * Récupère l'emplacement d'un symbole.
     * @param defName Le nom du symbole à rechercher.
     * @returns L'emplacement du symbole ou undefined s'il n'est pas trouvé.
     */
    public static getSymbolLocation(defName: string): SymbolLocation | undefined {
        const found = SphereScriptSymbolProvider.symbolMap.get(defName.toUpperCase());
        if (!found) { 
            console.log(`[SphereScriptSymbolProvider] Symbol not found: ${defName}`);
        } else { 
            console.log(`[SphereScriptSymbolProvider] Symbol found: ${defName} at ${found.uri.fsPath}:${found.range.start.line}`);
        }
        return found;
    }

    /**
     * Efface tous les symboles associés à un URI de document spécifique.
     * @param uri L'URI du document dont les symboles doivent être effacés.
     */
    public static clearSymbolsForDocument(uri: vscode.Uri): void {
        console.log(`[SphereScriptSymbolProvider] Clearing symbols for document: ${uri.fsPath}`);
        const uriString = uri.toString();
        const initialSize = SphereScriptSymbolProvider.symbolMap.size;
        for (const [key, value] of SphereScriptSymbolProvider.symbolMap.entries()) {
            if (value.uri.toString() === uriString) {
                SphereScriptSymbolProvider.symbolMap.delete(key);
            }
        }
        console.log(`[SphereScriptSymbolProvider] Cleared symbols for ${uri.fsPath}. Removed ${initialSize - SphereScriptSymbolProvider.symbolMap.size} symbols.`);
    }

    /**
     * Vérifie si l'initialisation est terminée.
     */
    public static isReady(): boolean {
        return SphereScriptSymbolProvider.isInitialized;
    }

    /**
     * Ré-initialise la table de symboles (utile pour forcer un rechargement complet).
     */
    public static async reinitialize(context: vscode.ExtensionContext): Promise<void> {
        console.log('[SphereScriptSymbolProvider] Reinitializing symbol table...');
        SphereScriptSymbolProvider.symbolMap.clear();
        SphereScriptSymbolProvider.isInitialized = false;
        await SphereScriptSymbolProvider.initialize(context);
    }

    /**
     * Initialise la table de symboles pour tous les documents .scp actuellement ouverts
     * et enregistre les écouteurs d'événements pour maintenir la table à jour.
     * Cette méthode doit être appelée lors de l'activation de l'extension.
     * @param context Le contexte de l'extension.
     */
    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        if (SphereScriptSymbolProvider.isInitialized) {
            console.log('[SphereScriptSymbolProvider] Already initialized, skipping...');
            return;
        }

        console.log('[SphereScriptSymbolProvider] Initializing symbol table...');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "SphereScript: Scanning workspace files",
            cancellable: false
        }, async (progress) => {
            // 1. Traite les documents .scp déjà ouverts
            const scpDocuments = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'scp');
            console.log(`[SphereScriptSymbolProvider] Processing ${scpDocuments.length} open documents...`);
            
            for (const doc of scpDocuments) {
                await SphereScriptSymbolProvider.buildSymbolTable(doc);
            }
            progress.report({ increment: 10, message: `${scpDocuments.length} open files scanned` });

            // 2. Trouve TOUS les fichiers .scp dans l'espace de travail
            console.log('[SphereScriptSymbolProvider] Searching for .scp files in workspace...');
            const allScpFiles = await vscode.workspace.findFiles(
                '**/*.scp',
                '{**/node_modules/**,**/.git/**,**/.vscode/**}'
            );
            
            console.log(`[SphereScriptSymbolProvider] Found ${allScpFiles.length} .scp files in workspace.`);

            // Filtrer les fichiers qui ne sont pas déjà ouverts
            const filesToProcess = allScpFiles.filter(fileUri =>
                !vscode.workspace.textDocuments.some(doc => doc.uri.toString() === fileUri.toString())
            );

            console.log(`[SphereScriptSymbolProvider] Processing ${filesToProcess.length} non-open files...`);

            let processedCount = 0;
            const totalFiles = filesToProcess.length;
            const batchSize = 25;

            for (let i = 0; i < filesToProcess.length; i += batchSize) {
                const batch = filesToProcess.slice(i, Math.min(i + batchSize, filesToProcess.length));
                
                await Promise.allSettled(batch.map(async (fileUri) => {
                    try {
                        const doc = await vscode.workspace.openTextDocument(fileUri);
                        await SphereScriptSymbolProvider.buildSymbolTable(doc);
                        processedCount++;
                        
                        if (processedCount % 10 === 0 || processedCount === totalFiles) {
                            const percentage = Math.floor((processedCount / totalFiles) * 90) + 10;
                            progress.report({ 
                                increment: 90 / totalFiles * 10,
                                message: `${processedCount}/${totalFiles} workspace files scanned` 
                            });
                        }
                    } catch (error) {
                        console.error(`[SphereScriptSymbolProvider] Error processing ${fileUri.fsPath}:`, error);
                    }
                }));
            }

            progress.report({ increment: 100, message: 'Indexing complete!' });
        });

        console.log(`[SphereScriptSymbolProvider] Initialization complete. Total symbols indexed: ${SphereScriptSymbolProvider.symbolMap.size}`);
        SphereScriptSymbolProvider.isInitialized = true;

        // Afficher un message de confirmation
        vscode.window.showInformationMessage(
            `SphereScript: Indexed ${SphereScriptSymbolProvider.symbolMap.size} symbols from ${vscode.workspace.textDocuments.filter(d => d.languageId === 'scp').length} files`
        );

        // 3. Enregistre les écouteurs d'événements
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                if (document.languageId === 'scp') {
                    console.log(`[SphereScriptSymbolProvider] Document opened: ${document.uri.fsPath}`);
                    SphereScriptSymbolProvider.buildSymbolTable(document);
                }
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'scp') {
                    // Reconstruction différée pour éviter trop de reconstructions pendant la saisie
                    setTimeout(() => {
                        SphereScriptSymbolProvider.buildSymbolTable(event.document);
                    }, 1000);
                }
            }),
            vscode.workspace.onDidSaveTextDocument(document => {
                if (document.languageId === 'scp') {
                    console.log(`[SphereScriptSymbolProvider] Document saved: ${document.uri.fsPath}`);
                    SphereScriptSymbolProvider.buildSymbolTable(document);
                }
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                if (document.languageId === 'scp') {
                    console.log(`[SphereScriptSymbolProvider] Document closed: ${document.uri.fsPath}`);
                    // Ne pas supprimer les symboles car le fichier existe toujours dans l'espace de travail
                    // SphereScriptSymbolProvider.clearSymbolsForDocument(document.uri);
                }
            })
        );

        // Commande pour forcer la ré-indexation
        context.subscriptions.push(
            vscode.commands.registerCommand('spherescript.reindexSymbols', async () => {
                await SphereScriptSymbolProvider.reinitialize(context);
                vscode.window.showInformationMessage('SphereScript symbols reindexed successfully!');
            })
        );
    }
}

/**
 * Fournit la fonctionnalité "Aller à la définition" pour les symboles SphereScript.
 */
export class SphereScriptDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location | vscode.LocationLink[]> {
        // Regex IDENTIQUE à celle du hover provider pour garantir la cohérence
        // Capture : noms avec underscores, IDs hexadécimaux (0x...), IDs décimaux courts (02859)
        const range = document.getWordRangeAtPosition(
            position,
            /\b[a-zA-Z_][a-zA-Z0-9_]*\b|0x[0-9a-fA-F]+|\b[0-9a-fA-F]{4,}\b/
        );
        
        if (!range) {
            console.log('[SphereScriptDefinitionProvider] No word under cursor.');
            return undefined;
        }

        const word = document.getText(range);
        const symbolToLookup = word.toUpperCase();
        console.log(`[SphereScriptDefinitionProvider] Looking up symbol: '${word}' (normalized: '${symbolToLookup}')`);
        console.log(`[SphereScriptDefinitionProvider] Range: ${range.start.line}:${range.start.character} to ${range.end.line}:${range.end.character}`);

        // Vérifie si la table de symboles est prête
        if (!SphereScriptSymbolProvider.isReady()) {
            console.log('[SphereScriptDefinitionProvider] Symbol table not ready yet.');
            vscode.window.showWarningMessage('SphereScript: Symbol index is still building. Please wait...');
            return undefined;
        }

        const location = SphereScriptSymbolProvider.getSymbolLocation(symbolToLookup);

        if (location) {
            console.log(`[SphereScriptDefinitionProvider] Definition found for '${symbolToLookup}' at ${location.uri.fsPath}:${location.range.start.line}`);
            return new vscode.Location(location.uri, location.range);
        }

        console.log(`[SphereScriptDefinitionProvider] No definition found for '${symbolToLookup}'.`);
        return undefined;
    }
}