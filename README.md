# SphereScript Linter Extension for VS Code

This VS Code extension provides a comprehensive suite of tools to enhance your SphereScript development experience, offering improved code readability, faster development, and better error detection.
(for package => python:
npm install -g @vscode/vsce
vsce package    )
## Features

-   **Syntax Highlighting:** Provides custom syntax highlighting for `.scp` files, making code more readable and easier to understand. This includes:
    *   Light blue highlighting for section keywords like `[ITEMDEF]`, `[CHARDEF]`, `[FUNCTION]`, etc.
    *   Yellow highlighting for object references such as `CONT.`, `SERV.`, `I.`, `SRC.`, `ACT.`, `NEW.`, `LOCAL.`, `TAG.`, `CTAG.`, `ARGO.`, `REF.`, `i.`, `c.`.
    *   Distinct color schemes for parentheses `()`, curly braces `{}`, and angle brackets `<>`.

-   **Intelligent Autocompletion:** Offers intelligent suggestions for SphereScript keywords, object properties, triggers, and commands, helping you write code faster and with fewer errors.
    *   **Context-aware filtering:** Suggestions are now dynamically filtered as you type after trigger characters like `.`, `@`, and `[`. For example, typing `i.da` will suggest properties starting with "DA" for items.

-   **Automatic Indentation Formatting:** Ensures consistent and correct indentation across your entire `.scp` files, supporting complex nested structures.
    *   **Usage:** You can trigger automatic formatting by using the command `Format Document` (accessible via `Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
    *   **Keyboard Shortcut:** A convenient shortcut `Ctrl+Alt+L` (or `Cmd+Alt+L` on Mac) is pre-configured to format the active document.

-   **Go to Definition:** Navigate quickly through your codebase by jumping directly to the definition of functions, items, characters, and other referenced symbols.
    *   **Supported Definitions:** Works for `[FUNCTION]`, `[ITEMDEF]`, `[CHARDEF]` sections.
    *   **Supported References:** You can now go to definition from:
        *   `DEFNAME`s in section headers (e.g., `[ITEMDEF i_myitem]` -> definition of `i_myitem`).
        *   `ID=` assignments (e.g., `ID=01b78` or `ID=i_handr_1` -> definition of `ITEMDEF 01b78` or `DEFNAME i_handr_1`).
        *   `TYPE=` assignments (e.g., `TYPE=t_some_type` -> definition of `TYPEDEF t_some_type`).
        *   References to `i_`, `c_`, `t_` `DEFNAME`s (e.g., `i_lingot_argent` in a `RESOURCES` line).
    *   **Usage:**
        *   `Ctrl+Click` (Windows/Linux) or `Cmd+Click` (Mac) on the symbol.
        *   Right-click on the symbol and select `Go to Definition`.
        *   Place your cursor on the symbol and press `F12`.

-   **Hover Information (Tooltips):** Get instant descriptions and contextual information by simply hovering your mouse cursor over various language elements.
    *   **Supported Elements:** Provides hover information for:
        *   **Triggers:** (e.g., `@Create`, `@HitTry`) displays their associated description.
        *   **Section Keywords:** (e.g., `ITEMDEF`, `FUNCTION`) displays their purpose.
        *   **Properties:** (e.g., `NAME`, `TYPE`, `VALUE`, `FLIP`, `MOREP`, `TAG`) displays their descriptions.

-   **Workspace-wide Error Scanning:** Automatically scans all `.scp` files in your workspace on activation and constantly monitors for changes, displaying all detected issues in the VS Code "Problems" panel. This provides a comprehensive overview of errors without needing to open each file individually.

## Requirements

This extension does not have any external runtime requirements. Simply install it in VS Code.

## Extension Settings

To customize the colors for the syntax highlighting, you can add the following to your VS Code `settings.json` file. Note that these scopes correspond to the TextMate grammar for SphereScript (`source.scp`).

```json
"editor.tokenColorCustomizations": {
    // To apply to all themes, remove "[Your Theme Name]" block
    // "[Your Theme Name]": { // Replace [Your Theme Name] with your actual VS Code theme
        "textMateRules": [
            {
                "scope": "entity.name.type.section.scp", // For section headers like [ITEMDEF ...], [FUNCTION ...]
                "settings": {
                    "foreground": "#80DFFF" // Light Blue
                }
            },
            {
                "scope": "entity.name.function.preprocessor.scp", // For triggers like @Create
                "settings": {
                    "foreground": "#FFCC00" // Orange/Yellow
                }
            },
            {
                "scope": "entity.name.class.scp", // For object prefixes like i., c., t., src., serv.
                "settings": {
                    "foreground": "#FFFF00" // Yellow
                }
            },
            {
                "scope": "support.variable.property.scp", // For properties like NAME, TYPE, VALUE, FLIP, MOREP, TAG
                "settings": {
                    "foreground": "#ADD8E6" // Light blue
                }
            },
            {
                "scope": "keyword.control.scp", // For control flow keywords like IF, ELSE, FOR
                "settings": {
                    "foreground": "#FF00FF" // Magenta
                }
            },
            {
                "scope": "constant.numeric.literal.scp", // For numeric values
                "settings": {
                    "foreground": "#B5CEA8" // Greenish
                }
            },
            {
                "scope": "string.quoted.double.scp", // For strings
                "settings": {
                    "foreground": "#CE9178" // Orange
                }
            },
            {
                "scope": "comment.line.scp", // For line comments //
                "settings": {
                    "foreground": "#6A9955" // Green
                }
            }
        ]
    // }
}
```

## Known Issues

No known issues at this time.

## Release Notes

### 0.0.1 (Initial Release - features added incrementally)

-   Initial release of the SphereScript Linter extension.
-   Basic syntax highlighting for SphereScript.
-   Autocompletion for common SphereScript elements.
-   **Added:** Automatic Indentation Formatting (`Ctrl+Alt+L`).
-   **Added:** Workspace-wide Error Scanning for `.scp` files.
(go to definition: right click => go to définitions.  ctrl + left click => go to definition) 
-   **Added:** Go to Definition for `[FUNCTION]`, `[ITEMDEF]`, `[CHARDEF]` section headers and their `DEFNAME`s.
-   **Added:** Go to Definition for `ID=` and `TYPE=` references to their respective definitions.
-   **Added:** Go to Definition for `i_`, `c_`, `t_` `DEFNAME` references within property values.
-   **Added:** Hover Information (tooltips) for Triggers, Section Keywords, and Properties.

---

**Enjoy your SphereScript development!** 

Prapilk
