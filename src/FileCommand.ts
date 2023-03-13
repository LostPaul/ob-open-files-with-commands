import OpenFilesPlugin from './main';
import { Command, TFile, WorkspaceLeaf, FileView } from 'obsidian';
import { openFileIn } from './settings';
export class FileCommand {
    id: string;
    command: Command;
    filePath: string;
    name: string;
    openFileIn: openFileIn;
    constructor(name: string, filePath: string, openFileIn: openFileIn, id: string) {
        this.filePath = filePath;
        this.name = name;
        this.openFileIn = openFileIn;
        this.id = id;
        this.command = {
            id: '',
            name: ''
        }
    }
    async createCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.id,
            name: this.name,
            checkCallback(checking) {
                const { id } = this;
                if (!id) {
                    return false;
                }
                if (!plugin.settings.commands.some(e => e?.command?.id == id)) {
                    return false;
                }
                if (!checking) {
                    const fileCommand = plugin.settings.commands.find(e => e?.command?.id == id || e.id == id.replace('open-files-with-commands:', ''));
                    const file = plugin.app.vault.getAbstractFileByPath(fileCommand?.filePath || '');
                    const files: TFile[] = [];
                    if (file instanceof TFile) {
                        let leaf: WorkspaceLeaf;
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
                        leaf.openFile(file);
                    }
                }
                return true;
            }
        });
    }
    updateCommand() {
        this.command.name = 'Open files with commands: ' + this.name;
        this.command.id = 'open-files-with-commands:' + this.id;
    }
}