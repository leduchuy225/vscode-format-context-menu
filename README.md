# VSCode Formatter - Multiple files

This VSCode extension allows the user to format one or multiple files with right-click context menu.

## Features

- Format and organize imports in one or multiple files from Explorer Context Menu
- Format and organize imports in one or multiple files from SCM Context Menu
- Format and organize imports in one or multiple files File Tile Context Menu

- Right-click mouse and choose `VF-MF: Format and Organize imports`.

## Extension Settings

This extension contributes the following settings:

- `formatMultipleFiles.organizeImports`: enable/disable organizing imports (default: `true`).
- `formatMultipleFiles.formatFiles`: enable/disable formatting files (default: `true`).
- `formatMultipleFiles.excludeFilesPattern`: File glob pattern (default: `null`).
- `formatMultipleFiles.includeFilesPattern`: File glob pattern (default: `**/*`).

## Reference

- [vscode-folder-source-actions](https://github.com/mjbvz/vscode-folder-source-actions)
- [vscode-format-context-menu](https://github.com/lacroixdavid1/vscode-format-context-menu)
