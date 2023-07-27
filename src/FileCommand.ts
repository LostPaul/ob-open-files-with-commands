import OpenFilesPlugin from './main';
import { Command, TFile, WorkspaceLeaf, FileView, Notice, moment } from 'obsidian';
import { openFileIn } from './settings';
export class FileCommand {
    id: string;
    command: Command;
    filePath: string;
    name: string;
    openFileIn: openFileIn;
    plugin: OpenFilesPlugin;
    type: 'file' | 'args';
    constructor(name: string, file: TFile | string, plugin: OpenFilesPlugin, id: string) {
        if (file instanceof TFile) {
            this.filePath = file.path;
        } else {
            this.filePath = file;
        }
        this.type = 'file';
        this.name = name;
        this.openFileIn = plugin.settings.openFileIn;
        this.id = id;
        this.command = {
            id: '',
            name: ''
        }
        this.plugin = plugin;
    }
    async createCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.id,
            name: this.name,
            checkCallback(checking) {
                let { id } = this;
                if (!id) { return false; }
                id = id.replace('open-files-with-commands:', '');
                const fileCommand = plugin.settings.commands.find(e => e.id == id);
                if (!fileCommand) { return false; }
                if (checking) { return true; }
                (async () => {
                    let filePath = await replaceArgs(fileCommand.filePath, plugin);
                    const file = plugin.app.vault.getAbstractFileByPath(filePath || '');
                    if (!(file instanceof TFile)) {
                        new Notice(`File "${filePath}" not found`);
                        return false;
                    }
                    const files: TFile[] = [];
                    let leaf: WorkspaceLeaf | null | undefined = null;
                    leaf = getLeaf(plugin, leaf, fileCommand, files, file);
                    if (!leaf) { return; }
                    leaf.openFile(file);
                })();
            }
        });
    }
    updateCommand(newFileCommand: FileCommand): boolean {
        if (newFileCommand.id != this.id) return false;
        const { commands } = this.plugin.settings;
        const fileWithSamePath = commands.find(e => e.filePath == newFileCommand.filePath && e.id != newFileCommand.id);
        const pathIsDifferent = this.filePath != newFileCommand.filePath;
        const nameIsDifferent = this.name != newFileCommand.name;
        const openFileInIsDifferent = this.openFileIn != newFileCommand.openFileIn;
        if (fileWithSamePath && newFileCommand.filePath != '') {
            new Notice(`A command with the same file path already exists: "${fileWithSamePath.name}"`);
            newFileCommand.filePath = commands.find(e => e.id == newFileCommand.id)?.filePath || '';
            return false;
        }
        if (pathIsDifferent) {
            this.filePath = newFileCommand.filePath;
        }
        if (nameIsDifferent) {
            this.name = newFileCommand.name;
        }
        if (openFileInIsDifferent) {
            this.openFileIn = newFileCommand.openFileIn;
        }
        this.command.name = 'Open files with commands: ' + this.name;
        this.command.id = 'open-files-with-commands:' + this.id;
        const fileCommand = this.plugin.settings.commands.find(e => e.id == this.id);
        if (fileCommand) {
            fileCommand.command = this.command;
            fileCommand.name = this.name;
            fileCommand.filePath = this.filePath;
            fileCommand.openFileIn = this.openFileIn;
        }
        this.plugin.saveSettings();
        return true;
    }
}
async function replaceArgs(filePath: string, plugin: OpenFilesPlugin) {
    const args = filePath.match(/\{\{([^}]+)\}\}/g);
    if (args) {
        const result = await replaceVariables(filePath, plugin, args);
        if (result !== undefined) {
            filePath = result;
        }
    }
    return filePath;
}
async function replaceVariables(filePath: string, plugin: OpenFilesPlugin, args: RegExpMatchArray) {
    for (const arg of args) {
        let argName = arg.replace(/\{\{([^}]+)\}\}/g, '$1');
        if (argName.startsWith('date:') || argName.startsWith('d:')) {
            argName = argName.replace('date:', '').replace('d:', '');
            const argValue = moment().format(argName);
            filePath = filePath.replace(arg, argValue);
        }
        const customVariable = plugin.settings.customVariables.find(e => e.name == argName);
        if (!customVariable) continue;
        if (argName != customVariable.name) continue;
        if (customVariable.type === 'javascript') {
            const myFunction = new Function(customVariable.value);
            filePath = filePath.replace(arg, myFunction());
        } else {
            const args = customVariable.value.match(/\{\{([^}]+)\}\}/g);
            let customVariableCopy = Object.assign({}, customVariable);
            if (args) {
                const result = await replaceVariables(customVariable.value, plugin, args);
                if (result !== undefined) {
                    customVariableCopy.value = result;
                }
            }
            console.log('arg', arg);
            console.log('customVariableCopy.value', customVariableCopy.value);
            filePath = filePath.replace(arg, customVariableCopy.value);
        }
    }
    return filePath;
}
function getLeaf(plugin: OpenFilesPlugin, leaf: WorkspaceLeaf | null, fileCommand: FileCommand, files: TFile[] = [], file: TFile) {
    switch (fileCommand?.openFileIn) {
        case 'activeTab':
            leaf = plugin.app.workspace.getLeaf(false);
            break;
        case 'newTab':
            leaf = plugin.app.workspace.getLeaf('tab');
            break;
        case 'newTabSplitHorizontal':
            leaf = plugin.app.workspace.getLeaf('split', 'horizontal');
            break;
        case 'newTabSplit':
            leaf = plugin.app.workspace.getLeaf('split', 'vertical');
            break;
        case 'rightLeaf':
            plugin.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
                if (leaf.getRoot() === plugin.app.workspace.rightSplit &&
                    leaf.view instanceof FileView &&
                    leaf.view.file.path == file.path) {
                    if (leaf.view instanceof FileView && leaf.view.file.path == file.path) {
                        plugin.app.workspace.revealLeaf(leaf)
                        return files.push(leaf.view.file);
                    }
                }
            })
            if (files.length > 0) return;
            leaf = plugin.app.workspace.getRightLeaf(false);
            plugin.app.workspace.revealLeaf(leaf);
            break;
        case 'leftLeaf':
            plugin.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
                if (leaf.getRoot() === plugin.app.workspace.leftSplit &&
                    leaf.view instanceof FileView &&
                    leaf.view.file.path == file.path) {
                    plugin.app.workspace.revealLeaf(leaf)
                    return files.push(leaf.view.file);
                }
            })
            if (files.length > 0) return;
            leaf = plugin.app.workspace.getLeftLeaf(false);
            plugin.app.workspace.revealLeaf(leaf);
            break;
        default:
            leaf = plugin.app.workspace.getLeaf(false);
            break;
    }
    return leaf;
}