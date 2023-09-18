'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const formatUris = async (uris: vscode.Uri[]) => {
    const vscodeConfig = vscode.workspace.getConfiguration();

    const closeAfterSave = vscodeConfig.get('formatMultipleFiles.closeAfterSave') as boolean;
    const saveAfterFormat = vscodeConfig.get('formatMultipleFiles.saveAfterFormat') as boolean;
    const isShowDocument = vscodeConfig.get('formatMultipleFiles.showTextDocument') as boolean;
    const isOrganizeImports = vscodeConfig.get('formatMultipleFiles.organizeImports') as boolean;

    const increment = (1 / uris.length) * 100;

    const progressOptions: vscode.ProgressOptions = {
      cancellable: true,
      title: 'Formatting files',
      location: vscode.ProgressLocation.Notification
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
            progress.report({ message: `${i + 1}/${uris.length}` });

            if (isShowDocument) {
              await vscode.window.showTextDocument(uris[i], { preserveFocus: false, preview: true });
            }
            if (isOrganizeImports) {
              await vscode.commands.executeCommand('editor.action.organizeImports', uri);
            }
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

          progress.report({ increment: increment });
        }
      }
    );
  };

  const getRecursiveUris = async (uris: vscode.Uri[]) => {
    const outputUris: vscode.Uri[] = [];

    const vscodeConfig = vscode.workspace.getConfiguration();
    const includeFile = vscodeConfig.get('formatMultipleFiles.includeFilesFromFormat') as string;
    const excludeFile = vscodeConfig.get('formatMultipleFiles.excludeFilesFromFormat') as string | null;

    for (let i = 0; i < uris.length; i++) {
      if (!fs.existsSync(uris[i].fsPath)) {
        continue;
      }
      if (!fs.lstatSync(uris[i].fsPath).isDirectory()) {
        outputUris.push(uris[i]);
        continue;
      }
      outputUris.push(
        ...(await vscode.workspace.findFiles(
          { base: uris[i].path, pattern: includeFile },
          excludeFile ? { base: uris[i].path, pattern: excludeFile } : null
        ))
      );
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
