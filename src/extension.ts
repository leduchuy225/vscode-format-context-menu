'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

const fakeWholeDocumentRange = new vscode.Range(0, 0, 99999, 0);

export function activate(context: vscode.ExtensionContext) {
  const vscodeConfig = vscode.workspace.getConfiguration();

  const isFormatFiles = vscodeConfig.get('formatMultipleFiles.formatFiles') as boolean;
  const isOrganizeImports = vscodeConfig.get('formatMultipleFiles.organizeImports') as boolean;
  const includeFile = vscodeConfig.get('formatMultipleFiles.includeFilesPattern') as string;
  const excludeFile = vscodeConfig.get('formatMultipleFiles.excludeFilesPattern') as string | null;

  const formatUris = async (uris: vscode.Uri[]) => {
    const isAutoClosed = uris.length > 1;

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

            if (isFormatFiles) {
              // CHECK
              await vscode.window.showTextDocument(uri, { preserveFocus: true, preview: false });
              await vscode.commands.executeCommand('editor.action.formatDocument', uri);
              await vscode.commands.executeCommand('workbench.action.files.save', uri);

              if (isAutoClosed) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor', uri);
              }
            }

            if (isOrganizeImports) {
              const didOpenTextListener = vscode.workspace.onDidChangeTextDocument(async (doc) => {
                await doc.document.save();
                if (doc.document.isClosed) {
                  return;
                }
                if (isAutoClosed) {
                  await vscode.commands.executeCommand('workbench.action.closeActiveEditor', doc.document.uri);
                }
              });

              await vscode.workspace.openTextDocument(uri);
              const kind = vscode.CodeActionKind.SourceOrganizeImports;
              await vscode.commands
                .executeCommand<vscode.CodeAction[]>(
                  'vscode.executeCodeActionProvider',
                  uri,
                  fakeWholeDocumentRange,
                  kind.value
                )
                .then((data) => {
                  if (!data) {
                    return;
                  }
                  return data.find((item) => (item.kind ? kind.contains(item.kind) : false));
                })
                .then(tryApplyCodeAction)
                .then(() => {
                  didOpenTextListener.dispose();
                });
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

  async function tryApplyCodeAction(action: vscode.CodeAction | undefined) {
    if (!action) {
      return;
    }
    if (action.edit && action.edit.size > 0) {
      await vscode.workspace.applyEdit(action.edit);
    }
    if (action.command) {
      await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.formatSelectedFilesFromScmVFMF',
      async (...selectedFiles: vscode.SourceControlResourceState[]) => {
        const uris = await getRecursiveUris(selectedFiles.map((x) => x.resourceUri));
        await formatUris(uris);
      }
    ),
    vscode.commands.registerCommand(
      'extension.formatSelectedFileFromEditorTileVFMF',
      async (clickedFile: vscode.Uri) => {
        await formatUris([clickedFile]);
      }
    ),
    vscode.commands.registerCommand(
      'extension.formatSelectedFilesFromExplorerVFMF',
      async (clickedFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        const uris = await getRecursiveUris(selectedFiles || [clickedFile]);
        await formatUris(uris);
      }
    )
  );
}

export function deactivate() {}
