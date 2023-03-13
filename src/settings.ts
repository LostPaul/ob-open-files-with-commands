import { PluginSettingTab, Setting, App, TFile, Notice, Platform } from 'obsidian';
import OpenFilesPlugin from './main';
import { FileSuggest } from './suggesters/FileSuggester';
import { FileCommand } from './FileCommand';
export type openFileIn = 'newTab' | 'newTabSplit' | 'newTabSplitHorizontal' | 'activeTab' | 'rightLeaf' | 'leftLeaf';
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
                    const fileCommand = new FileCommand('', '', this.plugin.settings.openFileIn, crypto.randomUUID());
                    fileCommand.updateCommand();
                    this.addCommandListOption(containerEl, fileCommand);
                })
            })
        for (const fileCommand of this.commands.filter(e => e != null)) {
            this.addCommandListOption(containerEl, fileCommand);
        }
        if (this.plugin.settings.commands.length == 0) {
            const fileCommand = new FileCommand('', '', this.plugin.settings.openFileIn, crypto.randomUUID());
            fileCommand.updateCommand();
            this.addCommandListOption(containerEl, fileCommand);
        }
    }
    createCommands() {
        let i = 0;
        for (const fileCommand of this.plugin.settings.commands) {
            const newFileCommand = new FileCommand(fileCommand.name, fileCommand.filePath, fileCommand.openFileIn, fileCommand.id || crypto.randomUUID());
            newFileCommand.createCommand(this.plugin);
            if (!fileCommand?.id) {
                this.plugin.settings.commands[i] = newFileCommand;
            }
            this.commands.push(newFileCommand);
            i++;
        }
        this.plugin.saveSettings();
    }
    async addCommand(name: string, filePath: string, openFileIn: openFileIn, id: string, notice?: boolean) {
        if (this.plugin.settings.commands.some(e => e?.filePath == filePath)) {
            return false;
        }
        const fileCommand = new FileCommand(name, filePath, openFileIn, id);
        fileCommand.createCommand(this.plugin);
        this.plugin.settings.commands.push(fileCommand);
        this.commands.push(fileCommand);
        await this.plugin.saveSettings();
        return fileCommand;
    }
    async addCommandListOption(containerEl: HTMLElement, fileCommand: FileCommand) {
        const setting = new Setting(containerEl)
        setting.setClass('ofwc-command-list')
        setting.addButton(cb => {
            cb.onClick(() => {
                if (fileCommand.command?.id) {
                    this.deleteCommand(fileCommand);
                } else if (fileCommand.filePath?.trim() !== '') {
                    fileCommand.command.id = 'open-files-with-commands:' + fileCommand.id;
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
                    fileCommand = new FileCommand(fileCommand.name, '', fileCommand.openFileIn, crypto.randomUUID());
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
            s.onChange(async () => {
                if (this.plugin.app.vault.getAbstractFileByPath(s.getValue()) instanceof TFile) {
                    if (this.plugin.settings.commands.findIndex(e => e?.id == fileCommand.id) == -1) {
                        const newFileCommand = await this.addCommand(fileCommand.name, s.getValue(), fileCommand.openFileIn, fileCommand.id);
                        if (newFileCommand) {
                            fileCommand = newFileCommand;
                            this.updateCommand(fileCommand);
                        } else {
                            new Notice('File already has a command');
                            return this.display();
                        }
                    } else {
                        fileCommand.filePath = s.getValue();
                        fileCommand = new FileCommand(fileCommand.name, fileCommand.filePath, fileCommand.openFileIn, fileCommand.id);
                        fileCommand.updateCommand();
                        if (!await this.updateCommand(fileCommand)) {
                            fileCommand.filePath = this.plugin.settings.commands.find(e => e?.id == fileCommand.id)?.filePath || fileCommand.filePath;
                            this.commands[this.commands.findIndex(e => e?.id == fileCommand.id)] = fileCommand;
                            this.display();
                        }
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
        if (newFileCommand.name.trim() == '') return;
        if (!oldFileCommand) {
            oldFileCommand = this.commands.find(c => c.id == newFileCommand.id);
        }
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c.id == newFileCommand.id);

        if (commands.some(e => e.filePath == newFileCommand.filePath && e.id != newFileCommand.id)) {
            new Notice('File already has a command');
            newFileCommand.filePath = this.commands.find(c => c.id == newFileCommand.id)?.filePath || newFileCommand.filePath;
            return false;
        } else if (index !== -1) {
            commands[index].name = newFileCommand.name;
            commands[index].filePath = newFileCommand.filePath;
            commands[index].command.name = 'Open files with commands: ' + newFileCommand.name;
            commands[index].command.id = 'open-files-with-commands:' + newFileCommand.id;
            commands[index].openFileIn = newFileCommand.openFileIn;
            this.commands[index] = commands[index];
            await this.plugin.saveSettings();
            return true;
        } else {
            if (newFileCommand.name.trim() != '' && this.plugin.app.vault.getAbstractFileByPath(newFileCommand.filePath)) {
                this.addCommand(newFileCommand.name, newFileCommand.filePath, newFileCommand.openFileIn, newFileCommand.id);
                return true;
            }
        }
    }
    async deleteCommand(fileCommand: FileCommand) {
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c.id === fileCommand?.id);
        if (index !== -1) {
            commands.splice(index, 1);
            this.commands.splice(index, 1);
            await this.plugin.saveSettings();
        }
    }
}