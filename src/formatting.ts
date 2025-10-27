import * as vscode from 'vscode';

export class SphereScriptDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const tabSize = options.tabSize;
        const indentStack: { type: string; level: number }[] = []; // Stack to track block types and their indent levels

        const openingKeywords = ['IF', 'WHILE', 'FOR', 'FORCHARS', 'DORAND', 'DOSWITCH', 'FORITEMS', 'FOROBJS', 'FORCONT', 'FORCONTID', 'FORCONTTYPE', 'FORCHARLAYER', 'FORCHARMEMORYTYPE', 'FORINSTANCES', 'FORPLAYERS', 'FORCLIENTS', 'BEGIN'];
        const closingKeywords = ['ENDIF', 'ENDWHILE', 'ENDFOR', 'ENDDO'];
        const middleKeywords = ['ELSE', 'ELSEIF', 'ELIF', 'END'];
        const sectionPattern = /^\s*\[/; // Lines starting with [

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const trimmedText = line.text.trim();

            // Handle empty lines - keep them empty
            if (trimmedText.length === 0) {
                if (line.text.length > 0) {
                    edits.push(vscode.TextEdit.replace(line.range, ''));
                }
                continue;
            }

            // Handle comments - maintain current indentation
            if (trimmedText.startsWith('//')) {
                const currentIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1].level + 1 : 0;
                const expectedIndentation = currentIndent * tabSize;
                const newText = ' '.repeat(expectedIndentation) + trimmedText;
                if (newText !== line.text) {
                    edits.push(vscode.TextEdit.replace(line.range, newText));
                }
                continue;
            }

            // Handle sections [ITEMDEF], [CHARDEF], etc. - reset indentation to 0
            if (sectionPattern.test(trimmedText)) {
                indentStack.length = 0; // Clear stack
                if (line.text !== trimmedText) {
                    edits.push(vscode.TextEdit.replace(line.range, trimmedText));
                }
                continue;
            }

            const upperCaseText = trimmedText.toUpperCase();
            let lineIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1].level + 1 : 0;
            let blockType = 'normal';

            // Check for ON= keyword
            if (upperCaseText.startsWith('ON=')) {
                // If we're in an ON block, close it
                while (indentStack.length > 0 && indentStack[indentStack.length - 1].type === 'on') {
                    indentStack.pop();
                }
                lineIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1].level + 1 : 0;
                
                // Format the line
                const expectedIndentation = lineIndent * tabSize;
                const newText = ' '.repeat(expectedIndentation) + trimmedText;
                if (newText !== line.text) {
                    edits.push(vscode.TextEdit.replace(line.range, newText));
                }
                
                // Push ON block to stack
                indentStack.push({ type: 'on', level: lineIndent });
                continue;
            }

            // Check for closing keywords
            let isClosing = false;
            for (const kw of closingKeywords) {
                if (upperCaseText.startsWith(kw)) {
                    isClosing = true;
                    // Pop the stack to find matching opening
                    if (kw === 'ENDIF' && indentStack.length > 0) {
                        // Pop all ELIF/ELSE blocks until we find the IF
                        while (indentStack.length > 0) {
                            const top = indentStack[indentStack.length - 1];
                            if (top.type === 'if' || top.type === 'elif' || top.type === 'else') {
                                lineIndent = top.level;
                                indentStack.pop();
                                if (top.type === 'if') break;
                            } else {
                                break;
                            }
                        }
                    } else if (indentStack.length > 0) {
                        const top = indentStack.pop()!;
                        lineIndent = top.level;
                    } else {
                        lineIndent = 0;
                    }
                    break;
                }
            }

            // Check for middle keywords (ELSE, ELSEIF, ELIF, END)
            let isMiddle = false;
            if (!isClosing) {
                for (const kw of middleKeywords) {
                    if (upperCaseText.startsWith(kw)) {
                        isMiddle = true;
                        
                        if (kw === 'END') {
                            // END closes a BEGIN block in DOSWITCH
                            // Pop the BEGIN block
                            if (indentStack.length > 0 && indentStack[indentStack.length - 1].type === 'begin') {
                                const top = indentStack.pop()!;
                                lineIndent = top.level;
                            } else {
                                lineIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1].level + 1 : 0;
                            }
                            // END doesn't open a new block, so we don't push to stack
                            blockType = 'end';
                        } else {
                            // ELSE, ELSEIF, ELIF
                            // Find the matching IF block
                            let ifLevel = 0;
                            // Pop ELIF/ELSE blocks until we find IF
                            while (indentStack.length > 0) {
                                const top = indentStack[indentStack.length - 1];
                                if (top.type === 'elif' || top.type === 'else') {
                                    indentStack.pop();
                                } else if (top.type === 'if') {
                                    ifLevel = top.level;
                                    break;
                                } else {
                                    break;
                                }
                            }
                            lineIndent = ifLevel;
                            blockType = kw.toLowerCase();
                        }
                        break;
                    }
                }
            }

            // Check for opening keywords
            let isOpening = false;
            if (!isClosing && !isMiddle) {
                for (const kw of openingKeywords) {
                    if (upperCaseText.startsWith(kw)) {
                        isOpening = true;
                        blockType = kw.toLowerCase();
                        break;
                    }
                }
            }

            // Apply formatting for the current line
            const expectedIndentation = lineIndent * tabSize;
            const newText = ' '.repeat(expectedIndentation) + trimmedText;
            if (newText !== line.text) {
                edits.push(vscode.TextEdit.replace(line.range, newText));
            }

            // Update stack for next line
            if (isOpening) {
                indentStack.push({ type: blockType, level: lineIndent });
            } else if (isMiddle && blockType !== 'end') {
                // Only push if it's ELSE/ELIF (not END)
                indentStack.push({ type: blockType, level: lineIndent });
            }

            // Handle RETURN - closes the current ON= block
            if (upperCaseText.startsWith('RETURN')) {
                // Pop until we're out of the ON block
                while (indentStack.length > 0 && indentStack[indentStack.length - 1].type === 'on') {
                    indentStack.pop();
                }
            }
        }

        return edits;
    }
}