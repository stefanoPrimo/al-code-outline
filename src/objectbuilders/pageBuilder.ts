import * as vscode from 'vscode';
import { ALObjectWriter } from "./alObjectWriter";
import { FileBuilder } from './fileBuilder';
import { ObjectBuilder } from './objectBuilder';
import { AZSymbolInformation } from '../symbollibraries/azSymbolInformation';
import { AZSymbolKind } from '../symbollibraries/azSymbolKind';

export class PageBuilder extends ObjectBuilder {

    constructor() {
        super();
    }

    //#region Wizards with UI

    async showWizard(tableSymbols: AZSymbolInformation[], pageType: string) {
        if (tableSymbols.length == 1)
            await this.showPageWizard(tableSymbols[0], pageType);
        else
            await this.showMultiPageWizard(tableSymbols, pageType);
    }

    async showMultiPageWizard(tableSymbols: AZSymbolInformation[], pageType: string) {
        if (!FileBuilder.checkCrsExtensionFileNamePatternRequired())
            return;

        const objType : AZSymbolKind = AZSymbolKind.PageObject;

        let startObjectId: number = await this.getObjectId(`Please enter a starting ID for the ${pageType} pages.`, 0);
        if (startObjectId < 0) {
            return;
        }

        let relativeFileDir: string = await this.getRelativeFileDir(objType);

        for (let i = 0; i < tableSymbols.length; i++) {
            let tableSymbol = tableSymbols[i];
            let objectId: number = startObjectId + i;
            let objectName : string = this.getDefaultPageName(tableSymbol, pageType);

            await this.createAndShowNewPage(tableSymbol, objType, objectId, objectName, pageType, relativeFileDir);
        }
    }

    async showPageWizard(tableSymbol : AZSymbolInformation, pageType: string) {
        if (!FileBuilder.checkCrsFileNamePatternRequired())
            return;

        const objType : AZSymbolKind = AZSymbolKind.PageObject;

        let objectId : number = await this.getObjectId(`Please enter an ID for the ${pageType} page.`, 0);
        if (objectId < 0) {
            return;
        }

        let objectName : string = this.getDefaultPageName(tableSymbol, pageType);
        objectName = await this.getObjectName(`Please enter a name for the ${pageType} page.`, objectName);
        
        if (!objectName) {
            return;
        }

        let relativeFileDir: string = await this.getRelativeFileDir(objType);
        await this.createAndShowNewPage(tableSymbol, objType, objectId, objectName, pageType, relativeFileDir);
    }

    private async createAndShowNewPage(tableSymbol: AZSymbolInformation, objType: AZSymbolKind, objectId: number, objectName: string, pageType: string, relativeFileDir: string) {
        let fileName : string = await FileBuilder.getPatternGeneratedFullObjectFileName(objType, objectId, objectName);
        let pageContents: string;
        if (pageType === 'List') {
            pageContents = this.buildListPageForTable(tableSymbol, objectId, objectName);
        }
        else if (pageType === 'Card') {
            pageContents = this.buildCardPageForTable(tableSymbol, objectId, objectName);
        }
        else {
            vscode.window.showErrorMessage(`Page generator for page type: ${pageType} not implemented.`)
            return;
        }

        this.showNewDocument(pageContents, fileName, relativeFileDir);
    }

    //#endregion

    //#region Page builders

    buildListPageForTable(tableSymbol : AZSymbolInformation, objectId : number, objectName : string) : string {
        return this.buildPageForTable(tableSymbol, objectId, objectName, "List", "repeater");
    }
    
    buildCardPageForTable(tableSymbol : AZSymbolInformation, objectId : number, objectName : string) : string {
        return this.buildPageForTable(tableSymbol, objectId, objectName, "Card", "group");
    }

    private buildPageForTable(tableSymbol : AZSymbolInformation, objectId : number, objectName : string, pageType : string, fieldGroupType : string) : string {
       
        //generate file content
        let writer : ALObjectWriter = new ALObjectWriter();

        writer.writeStartObject("page", objectId, objectName);
        writer.writeLine("");
        writer.writeProperty("PageType", pageType);
        writer.writeProperty("SourceTable", writer.encodeName(tableSymbol.name));
        writer.writeProperty("Caption", writer.encodeString(objectName));

        //usage category and application area for list pages
        if (pageType === "List") {
            let appArea : string = vscode.workspace.getConfiguration('alOutline').get('defaultAppArea');
            let usageCategory : string = vscode.workspace.getConfiguration('alOutline').get('defaultListUsageCategory');
            
            if ((usageCategory) && (usageCategory !== "")) {
                //application area requires useage category to be set
                if ((appArea) && (appArea !== ""))
                    writer.writeProperty("ApplicationArea", appArea);
                writer.writeProperty("UsageCategory", usageCategory);
            }
        }

        writer.writeLine("");
        
        writer.writeStartLayout();
        writer.writeStartGroup("area", "content");
        
        writer.writeStartGroup(fieldGroupType, "General");
        
        let fieldList : AZSymbolInformation[] = [];
        tableSymbol.collectChildSymbols(AZSymbolKind.Field, fieldList);
        fieldList.forEach(
            item => {
                writer.writePageField(item.name);
            }
        );
        
        writer.writeEndBlock();
        
        writer.writeEndBlock();
        
        writer.writeEndLayout();
        
        writer.writeLine("");
        writer.writeEndObject();
        
        return writer.toString();
    }

    //#endregion

    //#region Helper Methods

    private getDefaultPageName(tableSymbol: AZSymbolInformation, pageType: string) : string {
        return `${tableSymbol.name.trim()} ${pageType}`;
    }
    
    //#endregion
}