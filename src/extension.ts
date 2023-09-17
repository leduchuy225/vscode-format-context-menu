'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const formatUris = async (uris: vscode.Uri[]) => {
    const vscodeConfig = vscode.workspace.getConfiguration();

    // Getting current settings
    const saveAfterFormat = vscodeConfig.get('formatContextMenu.saveAfterFormat') as boolean;
    const closeAfterSave = vscodeConfig.get('formatContextMenu.closeAfterSave') as boolean;
    // const excludeFiles = vscodeConfig.get('formatContextMenu.excludeFilesFromFormat') as Array<String>;

    const increment = (1 / uris.length) * 100;

    const progressOptions: vscode.ProgressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: 'Formatting files',
      cancellable: true
    };

    vscode.window.withProgress(
      progressOptions,
      async (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        cancellationToken: vscode.CancellationToken
      ) => {
        for (let i = 0; i < uris.length; i++) {
          const uri = uris[i];

          if (cancellationToken.isCancellationRequested) {
            break;
          }
          try {
            progress.report({
              message: `${i + 1}/${uris.length}`
            });
            await vscode.window.showTextDocument(uris[i], {
              preserveFocus: false,
              preview: true
            });

            await vscode.commands.executeCommand('editor.action.formatDocument', uri);

            if (saveAfterFormat) {
              await vscode.commands.executeCommand('workbench.action.files.save', uri);
              if (closeAfterSave) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor', uri);
              }
            }
          } catch (exception) {
            vscode.window.showWarningMessage(`Could not format file ${uri}`);
          }
          progress.report({
            increment: increment
          });
        }
      }
    );
  };

  const getRecursiveUris = async (uris: vscode.Uri[]) => {
    let outputUris: vscode.Uri[] = [];
    for (let i = 0; i < uris.length; i++) {
      if (fs.existsSync(uris[i].fsPath)) {
        if (fs.lstatSync(uris[i].fsPath).isDirectory()) {
          outputUris = [...outputUris, ...(await vscode.workspace.findFiles('**​/*.js', '**​/node_modules/**', 10))];
        } else {
          outputUris.push(uris[i]);
        }
      }
    }
    return outputUris;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.formatSelectedFilesFromScmContext',
      async (...selectedFiles: vscode.SourceControlResourceState[]) => {
        const uris = await getRecursiveUris(selectedFiles.map((x) => x.resourceUri));
        await formatUris(uris);
      }
    ),
    vscode.commands.registerCommand(
      'extension.formatSelectedFileFromEditorTileContext',
      async (clickedFile: vscode.Uri) => {
        await formatUris([clickedFile]);
      }
    ),
    vscode.commands.registerCommand(
      'extension.formatSelectedFilesFromExplorerContext',
      async (clickedFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        const uris = await getRecursiveUris(selectedFiles || [clickedFile]);
        await formatUris(uris);
      }
    )
  );
}

export function deactivate() {}
