import * as vscode from 'vscode';
import { DevToolsExtensionContext } from '../../devToolsExtensionContext';
import { AZSymbolKind } from '../../symbollibraries/azSymbolKind';
import { AZSymbolInformation } from '../../symbollibraries/azSymbolInformation';
import { ALBaseSortCodeCommand } from './alBaseSortCodeCommand';
import { AZDocumentSymbolsLibrary } from '../../symbollibraries/azDocumentSymbolsLibrary';

export class ALSortProceduresCodeCommand extends ALBaseSortCodeCommand {
    protected _methodSymbolKinds: AZSymbolKind[] = [
        AZSymbolKind.MethodDeclaration, 
        AZSymbolKind.LocalMethodDeclaration, 
        AZSymbolKind.EventSubscriberDeclaration,
        AZSymbolKind.EventDeclaration,
        AZSymbolKind.BusinessEventDeclaration,
        AZSymbolKind.IntegrationEventDeclaration
    ];
    
    constructor(context : DevToolsExtensionContext) {
        super(context, "SortProcedures");
    }

    collectCodeActions(docSymbols: AZDocumentSymbolsLibrary, symbol: AZSymbolInformation, document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, actions: vscode.CodeAction[]) {
        let edit: vscode.WorkspaceEdit | undefined = undefined;
        let actionKind = vscode.CodeActionKind.QuickFix;

        if (this.canRunOnSave(document.uri)) {
            if ((context.only) && (context.only.contains(vscode.CodeActionKind.SourceFixAll))) {
                actionKind = vscode.CodeActionKind.SourceFixAll;
                let objList: AZSymbolInformation[] = [];        
                docSymbols.findALObjectsInsideRange(range, objList);
                for (let i=0; i<objList.length; i++)
                    edit = this.prepareEdit(objList[i], document, edit);
            }
        } else {
            if ((symbol) && 
                ((this.isMethodSymbol(symbol)) || (symbol.isALObject())) && 
                (symbol.selectionRange.start.line == range.start.line))
                edit = this.prepareEdit(symbol, document, edit);
        }

        if (edit) {
            let action = new vscode.CodeAction("Sort procedures", actionKind);
            action.edit = edit;
            actions.push(action);
        }
    }

    protected prepareEdit(symbol: AZSymbolInformation, document: vscode.TextDocument, edit: vscode.WorkspaceEdit | undefined): vscode.WorkspaceEdit | undefined {        
        let objectSymbol = symbol.findParentObject();
        let isMethodSymbol = this.isMethodSymbol(symbol);

        // Collect method declarations of matching symbol-kind or all methods if we run code action for whole object
        let methodDecls: AZSymbolInformation[] = [];
        if (this.isMethodSymbol(symbol))        
            objectSymbol.collectChildSymbols(symbol.kind, true, methodDecls);
        else {
            for (let i=0; i<this._methodSymbolKinds.length; i++)
                objectSymbol.collectChildSymbols(this._methodSymbolKinds[i], true, methodDecls);
        }       
        
        if (methodDecls.length == 0) {
            return edit;
        }

        // Sort the method declarations
        methodDecls.sort((methodDeclA, methodDeclB) => {
            if (methodDeclA.kind != methodDeclB.kind)
                return (this._methodSymbolKinds.indexOf(methodDeclA.kind) - this._methodSymbolKinds.indexOf(methodDeclB.kind));
            return methodDeclA.name.localeCompare(methodDeclB.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Produce the new sorted source
        let newSource: string = "";
        for (const methodDecl of methodDecls) {
            const declRange = new vscode.Range(methodDecl.range.start.line, methodDecl.range.start.character, methodDecl.range.end.line, methodDecl.range.end.character);
            newSource += vscode.window.activeTextEditor.document.getText(declRange);
        }
        
        // Delete the old unsorted method declarations and insert the new sorted source
        if (!edit)
            edit = new vscode.WorkspaceEdit();
        let insertPos: vscode.Position = new vscode.Position(methodDecls[0].range.start.line, methodDecls[0].range.start.character);
            
        for (const methodDecl of methodDecls) {
            const deleteRange = new vscode.Range(methodDecl.range.start.line, methodDecl.range.start.character, methodDecl.range.end.line, methodDecl.range.end.character);
            edit.delete(document.uri, deleteRange);
        }
            
        edit.insert(document.uri, insertPos, newSource);

        return edit;
    }

    protected isMethodSymbol(symbol: AZSymbolInformation): boolean {
        return (this._methodSymbolKinds.indexOf(symbol.kind) >= 0);
    }

}
