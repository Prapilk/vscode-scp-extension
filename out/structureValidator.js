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
exports.validateCodeStructure = validateCodeStructure;
const vscode = __importStar(require("vscode"));
function validateCodeStructure(document, diagnostics) {
    const blockStack = [];
    const openingKeywords = ['IF', 'WHILE', 'FOR', 'FORCHARS', 'DORAND', 'DOSWITCH', 'FORITEMS', 'FOROBJS', 'FORCONT', 'FORCONTID', 'FORCONTTYPE', 'FORCHARLAYER', 'FORCHARMEMORYTYPE', 'FORINSTANCES', 'FORPLAYERS', 'FORCLIENTS'];
    const closingKeywords = {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'FOR': 'ENDFOR',
        'FORCHARS': 'ENDFOR',
        'FORITEMS': 'ENDFOR',
        'FOROBJS': 'ENDFOR',
        'FORCONT': 'ENDFOR',
        'FORCONTID': 'ENDFOR',
        'FORCONTTYPE': 'ENDFOR',
        'FORCHARLAYER': 'ENDFOR',
        'FORCHARMEMORYTYPE': 'ENDFOR',
        'FORINSTANCES': 'ENDFOR',
        'FORPLAYERS': 'ENDFOR',
        'FORCLIENTS': 'ENDFOR',
        'DORAND': 'ENDDO',
        'DOSWITCH': 'ENDDO'
    };
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        // Ignorer les commentaires et les lignes vides
        if (text.length === 0 || text.startsWith('//'))
            continue;
        // Vérifier les mots-clés d'ouverture
        for (const keyword of openingKeywords) {
            const regex = new RegExp(`^${keyword}\\b`, 'i');
            if (regex.test(text)) {
                const col = line.firstNonWhitespaceCharacterIndex;
                blockStack.push({
                    keyword: keyword,
                    line: lineIndex,
                    column: col
                });
                break;
            }
        }
        // Vérifier les fautes de frappe et les mots-clés de fermeture
        const typoRegex = /^(elsif|eif|ele)\b/i;
        const typoMatch = text.match(typoRegex);
        if (typoMatch) {
            const typo = typoMatch[0].toUpperCase();
            const col = line.firstNonWhitespaceCharacterIndex;
            let expectedKeyword = '';
            switch (typo) {
                case 'ELSIF':
                case 'EIF':
                    expectedKeyword = 'ELSEIF';
                    break;
                case 'ELE':
                    expectedKeyword = 'ELSE';
                    break;
            }
            const range = new vscode.Range(lineIndex, col, lineIndex, col + typo.length);
            const diagnostic = new vscode.Diagnostic(range, `Syntaxe incorrecte: "${typo}" n'est pas un mot-clé valide. Utiliser "${expectedKeyword}".`, vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'Sphere Script Linter';
            diagnostic.code = 'invalid-syntax';
            diagnostics.push(diagnostic);
            continue; // Passer à la ligne suivante
        }
        // Vérifier ELSEIF et ELSE (doivent être dans un IF)
        if (/^(ELSEIF|ELSE|ELIF)\b/i.test(text)) {
            if (blockStack.length === 0 || blockStack[blockStack.length - 1].keyword !== 'IF') {
                const col = line.firstNonWhitespaceCharacterIndex;
                const range = new vscode.Range(lineIndex, col, lineIndex, col + text.split(/\s/)[0].length);
                const diagnostic = new vscode.Diagnostic(range, `${text.split(/\s/)[0]} sans IF correspondant.`, vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'mismatched-block';
                diagnostics.push(diagnostic);
            }
        }
        // Vérifier les mots-clés de fermeture et la syntaxe des blocs IF
        const closingRegex = /^(ENDIF|ENDWHILE|ENDFOR|ENDDO|ENIF)\b/i; // Ajout de ENIF
        if (closingRegex.test(text)) {
            const col = line.firstNonWhitespaceCharacterIndex;
            const closingKeyword = text.split(/\s/)[0].toUpperCase(); // Récupérer le mot-clé de fermeture
            // Vérification de la syntaxe (ENIF)
            if (closingKeyword === 'ENIF') {
                const range = new vscode.Range(lineIndex, col, lineIndex, col + closingKeyword.length);
                const diagnostic = new vscode.Diagnostic(range, `Syntaxe incorrecte: "${closingKeyword}" n'est pas un mot-clé valide. Utiliser ENDIF.`, vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'invalid-syntax';
                diagnostics.push(diagnostic);
                continue; // Passer à la ligne suivante
            }
            if (blockStack.length === 0) {
                // Mot-clé de fermeture sans ouverture correspondante
                const range = new vscode.Range(lineIndex, col, lineIndex, col + closingKeyword.length);
                const diagnostic = new vscode.Diagnostic(range, `${closingKeyword} sans bloc correspondant.`, vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'Sphere Script Linter';
                diagnostic.code = 'mismatched-block';
                diagnostics.push(diagnostic);
            }
            else {
                const lastBlock = blockStack.pop(); // Retirer le dernier bloc de la pile
                if (lastBlock) { // Vérifier si lastBlock est défini
                    const expectedClosing = closingKeywords[lastBlock.keyword];
                    if (closingKeyword !== expectedClosing) {
                        // Mauvaise correspondance
                        const range = new vscode.Range(lineIndex, col, lineIndex, col + closingKeyword.length);
                        const diagnostic = new vscode.Diagnostic(range, `${closingKeyword} ne correspond pas à ${lastBlock.keyword} à la ligne ${lastBlock.line + 1}.`, vscode.DiagnosticSeverity.Error);
                        diagnostic.source = 'Sphere Script Linter';
                        diagnostic.code = 'mismatched-block';
                        diagnostics.push(diagnostic);
                    }
                }
                else {
                    // La pile était vide après un pop, ce qui est inattendu.
                    const range = new vscode.Range(lineIndex, col, lineIndex, col + closingKeyword.length);
                    const diagnostic = new vscode.Diagnostic(range, `${closingKeyword} sans bloc correspondant (pile vide inattendue).`, vscode.DiagnosticSeverity.Error);
                    diagnostic.source = 'Sphere Script Linter';
                    diagnostic.code = 'mismatched-block';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }
    // Vérifier les blocs non fermés
    for (const block of blockStack) {
        const range = new vscode.Range(block.line, block.column, block.line, block.column + block.keyword.length);
        const expectedClosing = closingKeywords[block.keyword];
        const diagnostic = new vscode.Diagnostic(range, `${block.keyword} à la ligne ${block.line + 1} n'a pas de ${expectedClosing} correspondant.`, vscode.DiagnosticSeverity.Error);
        diagnostic.source = 'Sphere Script Linter';
        diagnostic.code = 'unclosed-block';
        diagnostics.push(diagnostic);
    }
}
//# sourceMappingURL=structureValidator.js.map