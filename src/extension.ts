'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

const fakeWholeDocumentRange = new vscode.Range(0, 0, 99999, 0);

export function activate(context: vscode.ExtensionContext) {
  const getProgressTitlte = (isFormat: boolean, isOrganizeImports: boolean) => {
    if (isFormat && isOrganizeImports) {
      return 'Formatting files and Organizing imports';
    }
    if (isFormat) {
      return 'Formatting files';
    }
    if (isOrganizeImports) {
      return 'Organizing imports';
    }
    return '';
  };

  const formatUris = async (uris: vscode.Uri[]) => {
    const vscodeConfig = vscode.workspace.getConfiguration();

    const isFormatFiles = vscodeConfig.get('formatMultipleFiles.formatFiles') as boolean;
    const isOrganizeImports = vscodeConfig.get('formatMultipleFiles.organizeImports') as boolean;

    if (!isFormatFiles && !isOrganizeImports) {
      return;
    }

    const isAutoClosed = uris.length > 1;
    const increment = (1 / uris.length) * 100;

    let didOpenTextListener: vscode.Disposable | null = null;
    if (isOrganizeImports) {
      didOpenTextListener = vscode.workspace.onDidChangeTextDocument(async (doc) => {
        if (doc.document.isClosed) {
          return;
        }
        await doc.document.save();
      });
    }

    await vscode.window
      .withProgress(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: getProgressTitlte(isFormatFiles, isOrganizeImports)
        },
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
                await vscode.window.showTextDocument(uri, { preserveFocus: true, preview: false });
                await vscode.commands.executeCommand('editor.action.formatDocument', uri);
                await vscode.commands.executeCommand('workbench.action.files.save', uri);
              }

              if (isOrganizeImports) {
                const doc = await vscode.workspace.openTextDocument(uri);
                if (!doc) {
                  return;
                }
                const kind = vscode.CodeActionKind.SourceOrganizeImports;
                await vscode.commands
                  .executeCommand<vscode.CodeAction[]>(
                    'vscode.executeCodeActionProvider',
                    doc.uri,
                    fakeWholeDocumentRange,
                    kind.value
                  )
                  .then((data) => {
                    if (!data) {
                      return;
                    }
                    return data.find((item) => (item.kind ? kind.contains(item.kind) : false));
                  })
                  .then(tryApplyCodeAction);
              }

              if (isAutoClosed) {
                await timeout(isOrganizeImports && isFormatFiles ? 250 : 0).then(async () => {
                  await vscode.commands.executeCommand('workbench.action.closeActiveEditor', uri);
                });
              }
            } catch (exception) {
              vscode.window.showWarningMessage(`Could not format file ${uri}`);
            }

            progress.report({ increment: increment });
          }
        }
      )
      .then(() => {
        if (didOpenTextListener) {
          didOpenTextListener.dispose();
        }
      });
  };

  const getRecursiveUris = async (uris: vscode.Uri[]) => {
    const vscodeConfig = vscode.workspace.getConfiguration();

    const includeFile = vscodeConfig.get('formatMultipleFiles.includeFilesPattern') as string;
    const excludeFile = vscodeConfig.get('formatMultipleFiles.excludeFilesPattern') as string | null;

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

  async function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
