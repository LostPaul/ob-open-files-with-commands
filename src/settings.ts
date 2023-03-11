import { PluginSettingTab, Setting, Command, App, TFile, Notice, WorkspaceLeaf, Platform, FileView } from 'obsidian';
import OpenFilesPlugin from './main';
import { FileSuggest } from './suggesters/FileSuggester';
type openFileIn = 'newTab' | 'newTabSplit' | 'newTabSplitHorizontal' | 'activeTab' | 'rightLeaf' | 'leftLeaf';
export interface OpenFilesSettings {
    commands: FileCommand[];
    openNewTab: boolean;
    openFileIn: openFileIn;
}
export const DEFAULT_SETTINGS: OpenFilesSettings = {
    commands: [],
    openNewTab: false,
    openFileIn: 'activeTab'
}
export class SettingsTab extends PluginSettingTab {
    plugin: OpenFilesPlugin;
    app: App;
    commands: FileCommand[] = [];
    constructor(app: App, plugin: OpenFilesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Open files with commands settings' });
        containerEl.classList.add('ofwc-settings');
        if (Platform.isDesktopApp) {
            new Setting(containerEl)
                .setName('Choose where you want to open the files')
                .addDropdown(cb => {
                    cb.addOptions(
                        {
                            'activeTab': 'Open',
                            'newTab': 'Open in a new tab',
                            'newTabSplit': 'Open to the right',
                            'newTabSplitHorizontal': 'Open below',
                            'rightLeaf': 'Open in right sidebar',
                            'leftLeaf': 'Open in left sidebar',
                        }
                    );
                    cb.setValue(this.plugin.settings.openFileIn);
                    cb.onChange(async (val) => {
                        this.plugin.settings.openFileIn = val as openFileIn;
                        await this.plugin.saveSettings();
                    });
                })
        }
        new Setting(containerEl)
            .setHeading()
            .setName('Manage commands')
        new Setting(containerEl)
            .setName('Create a new command')
            .addButton(cb => {
                cb.setIcon('plus');
                cb.setClass('create-command-button');
                cb.setTooltip('Create a new command');
                cb.onClick(() => {
                    const fileCommand = new FileCommand('', '', this.plugin.settings.openFileIn);
                    fileCommand.updateCommand();
                    this.addCommandListOption(containerEl, fileCommand);
                })
            })
        for (const fileCommand of this.commands.filter(e => e != null)) {
            this.addCommandListOption(containerEl, fileCommand);
        }
        if (this.plugin.settings.commands.length == 0) {
            const fileCommand = new FileCommand('', '', this.plugin.settings.openFileIn);
            fileCommand.updateCommand();
            this.addCommandListOption(containerEl, fileCommand);
        }
    }
    createCommands() {
        for (let fileCommand of this.plugin.settings.commands) {
            fileCommand = new FileCommand(fileCommand.name, fileCommand.filePath, fileCommand.openFileIn);
            fileCommand.addCommand(this.plugin);
            this.commands.push(fileCommand);
        }
    }
    async addCommand(name: string, filePath: string, openFileIn: openFileIn, notice?: boolean) {
        if (this.plugin.settings.commands.some(e => e?.filePath == filePath)) {
            if (notice) {
                return new Notice('Command already exists');
            } else {
                return;
            }
        }
        const fileCommand = new FileCommand(name, filePath, openFileIn);
        fileCommand.addCommand(this.plugin);
        this.plugin.settings.commands.push(fileCommand);
        this.commands.push(fileCommand);
        await this.plugin.saveSettings();
        if (notice) {
            new Notice('Created a command for this file');
        }
    }
    async addCommandListOption(containerEl: HTMLElement, fileCommand: FileCommand) {
        const setting = new Setting(containerEl)
        setting.setClass('ofwc-command-list')
        setting.addButton(cb => {
            cb.onClick(() => {
                if (fileCommand.command?.id) {
                    this.deleteCommand(fileCommand);
                } else if (fileCommand.filePath?.trim() !== '') {
                    fileCommand.command.id = 'open-files-with-commands:' + fileCommand.filePath;
                    this.deleteCommand(fileCommand);
                }
                setting.clear();
                setting.settingEl.remove();
            })
            cb.setTooltip('Delete command');
            cb.setIcon('trash-2')
        });

        if (Platform.isDesktopApp) {
            setting.addButton(cb => {
                cb.onClick(() => {
                    fileCommand.filePath = '';
                    fileCommand.command.id = 'open-files-with-commands:' + fileCommand.filePath;
                    this.addCommandListOption(containerEl, fileCommand);
                })
                cb.setIcon('copy')
                cb.setTooltip('Duplicate command');
            });
        }

        setting.addText(cb => {
            cb.setPlaceholder('Command name');
            cb.setValue(fileCommand.name);
            cb.onChange(() => {
                fileCommand.name = cb.getValue();
                this.updateCommand(fileCommand);
            })
        });
        setting.addSearch(s => {
            s.setPlaceholder('File path');
            new FileSuggest(
                s.inputEl,
                this.plugin
            );
            s.setValue(fileCommand.filePath);
            s.inputEl.setAttribute('filePath', fileCommand.filePath);
            s.onChange(() => {
                if (this.plugin.app.vault.getAbstractFileByPath(s.getValue()) instanceof TFile) {
                    fileCommand.filePath = s.getValue();
                    fileCommand = new FileCommand(fileCommand.name, fileCommand.filePath, fileCommand.openFileIn);
                    fileCommand.updateCommand();
                    const oldFilePath = s.inputEl.getAttribute('filePath') || '';
                    if (this.plugin.app.vault.getAbstractFileByPath(oldFilePath)) {
                        const oldFileCommand = new FileCommand(fileCommand.name, oldFilePath, fileCommand.openFileIn);
                        oldFileCommand.updateCommand();
                        this.updateCommand(fileCommand, oldFileCommand);
                        s.inputEl.setAttribute('filePath', fileCommand.filePath);
                    } else {
                        s.inputEl.setAttribute('filePath', fileCommand.filePath);
                        this.updateCommand(fileCommand, fileCommand);
                    }
                }
            })
        });
        if (Platform.isDesktopApp) {
            setting.addDropdown(cb => {
                cb.addOptions(
                    {
                        'activeTab': 'Open',
                        'newTab': 'Open in a new tab',
                        'newTabSplit': 'Open to the right',
                        'newTabSplitHorizontal': 'Open below',
                        'rightLeaf': 'Open in right sidebar',
                        'leftLeaf': 'Open in left sidebar',
                    }
                );
                cb.setValue(fileCommand.openFileIn);
                cb.onChange(async (val) => {
                    fileCommand.openFileIn = val as openFileIn;
                    this.updateCommand(fileCommand);
                });
            })
        }

    }
    async updateCommand(newFileCommand: FileCommand, oldFileCommand?: FileCommand) {
        if (newFileCommand.filePath.trim() == '') return;
        if (newFileCommand.name.trim() == '') return;
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c.command?.id === oldFileCommand?.command?.id || c.command?.id === newFileCommand?.command?.id);

        if (commands.some(e => e.command?.id == newFileCommand?.command?.id) && oldFileCommand?.command.id !== newFileCommand.command.id && oldFileCommand) {
            newFileCommand.filePath = oldFileCommand?.filePath;
            newFileCommand.updateCommand();
            new Notice('File already has a command');
            return this.display();
        } else if (index != -1 && newFileCommand.command.name == oldFileCommand?.command.name && newFileCommand.command.id == oldFileCommand.command.id && newFileCommand.openFileIn == newFileCommand.openFileIn) {
            new Notice('File already has a command');
            return this.display();
        }
        if (index !== -1) {
            commands[index].name = newFileCommand.name;
            commands[index].filePath = newFileCommand.filePath;
            commands[index].command.name = 'Open files with commands: ' + newFileCommand.name;
            commands[index].command.id = 'open-files-with-commands:' + newFileCommand.filePath;
            commands[index].openFileIn = newFileCommand.openFileIn;
            this.commands[index] = commands[index];
            await this.plugin.saveSettings();
        } else {
            if (newFileCommand.name.trim() != '' && this.plugin.app.vault.getAbstractFileByPath(newFileCommand.filePath)) {
                this.addCommand(newFileCommand.name, newFileCommand.filePath, newFileCommand.openFileIn)
            }
        }
    }
    async deleteCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c?.command.id === command?.id);
        if (index !== -1) {
            commands.splice(index, 1);
            this.commands.splice(index, 1);
            await this.plugin.saveSettings();
        }
    }
}
export class FileCommand {
    command: Command;
    filePath: string;
    name: string;
    openFileIn: openFileIn;
    constructor(name: string, filePath: string, openFileIn: openFileIn) {
        this.filePath = filePath;
        this.name = name;
        this.openFileIn = openFileIn;
        this.command = {
            id: '',
            name: ''
        }
    }
    async addCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.filePath,
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
                    const file = plugin.app.vault.getAbstractFileByPath(id.replace('open-files-with-commands:', ''));
                    const fileCommand = plugin.settings.commands.find(e => e?.command?.id == id);
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
        this.command.id = 'open-files-with-commands:' + this.filePath;
    }
}