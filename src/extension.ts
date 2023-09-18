'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const vscodeConfig = vscode.workspace.getConfiguration();

  const isFormatFiles = vscodeConfig.get('formatMultipleFiles.formatFiles') as boolean;
  const isOrganizeImports = vscodeConfig.get('formatMultipleFiles.organizeImports') as boolean;
  const closeAfterSeconds = vscodeConfig.get('formatMultipleFiles.closeAfterSeconds') as number;
  const includeFile = vscodeConfig.get('formatMultipleFiles.includeFilesFromFormat') as string;
  const excludeFile = vscodeConfig.get('formatMultipleFiles.excludeFilesFromFormat') as string | null;

  // //Create output channel
  // let orange = vscode.window.createOutputChannel("Orange");

  // //Write to output.
  // orange.appendLine("I am a banana.");

  const formatUris = async (uris: vscode.Uri[]) => {
    const increment = (1 / uris.length) * 100;

    const progressOptions: vscode.ProgressOptions = {
      cancellable: true,
      title: 'Formatting files',
      location: vscode.ProgressLocation.Notification
    };

    isOrganizeImports && closeAfterSeconds != -1
      ? vscode.workspace.onDidOpenTextDocument(async (doc) => {
          const clock = setTimeout(async () => {
            await doc.save();
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor', doc.uri);
            clearTimeout(clock);
          }, closeAfterSeconds * 1000);
        })
      : null;

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
            await vscode.window.showTextDocument(uris[i], { preserveFocus: true, preview: false });

            if (isFormatFiles) {
              await vscode.commands.executeCommand('editor.action.formatDocument', uri);
            }

            if (isOrganizeImports) {
              await vscode.commands.executeCommand('vscode.executeCodeActionProvider', uri).then((data) => {
                console.log('AHIHI');
                console.log(data);
              });
              await vscode.commands.executeCommand('editor.action.organizeImports', uri);
            } else {
              await vscode.commands.executeCommand('workbench.action.files.save', uri);
              await vscode.commands.executeCommand('workbench.action.closeActiveEditor', uri);
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
