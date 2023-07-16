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
    constructor(app: App, plugin: OpenFilesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.createCommands();
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
                            'activeTab': 'Open in active tab',
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
                    const fileCommand = this.createFileCommand('', '', this.plugin);
                    this.saveFileCommand(fileCommand);
                    fileCommand.createCommand(this.plugin);
                    this.addCommandListOption(containerEl, fileCommand);
                })
            })
        this.plugin.commands.forEach(fileCommand => {
            this.addCommandListOption(containerEl, fileCommand);
        });
        if (this.plugin.settings.commands.length == 0) {
            const fileCommand = this.createFileCommand('', '', this.plugin);
            this.saveFileCommand(fileCommand);
            this.plugin.commands.push(fileCommand);
            this.addCommandListOption(containerEl, fileCommand);
        }
    }
    async addCommandListOption(containerEl: HTMLElement, fileCommand: FileCommand) {
        const setting = new Setting(containerEl)
        setting.setClass('ofwc-command-list')
        setting.addButton(cb => {
            cb.onClick(() => {
                if (fileCommand.id) {
                    this.deleteCommand(fileCommand.id);
                } else if (fileCommand.filePath?.trim() !== '') {
                    fileCommand.command.id = 'open-files-with-commands:' + fileCommand.id;
                    this.deleteCommand(fileCommand.id);
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
                    const newFileCommand = this.createFileCommand(fileCommand.name, fileCommand.filePath, this.plugin);
                    this.addCommandListOption(containerEl, newFileCommand);
                    this.saveFileCommand(newFileCommand);
                    newFileCommand.createCommand(this.plugin);
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
                fileCommand.updateCommand(fileCommand)
                this.plugin.saveSettings();

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
                const path = s.getValue();
                const file = this.plugin.app.vault.getAbstractFileByPath(path);
                if (!(file instanceof TFile)) { return false; }
                if (this.plugin.commands.findIndex(e => e?.id == fileCommand.id) == -1) {
                    if (this.plugin.settings.commands.some(e => e?.id == fileCommand.id)) {
                        fileCommand.filePath = path;
                        fileCommand.createCommand(this.plugin);
                        this.plugin.saveSettings();
                    } else {
                        const newFileCommand = await this.addCommand(fileCommand.name, path, this.plugin, fileCommand.id);
                        if (newFileCommand) {
                            fileCommand.filePath = path;
                            this.plugin.saveSettings();
                        } else {
                            new Notice('File already has a command');
                            return this.display();
                        }
                    }
                } else {
                    fileCommand.filePath = path;
                    fileCommand = this.createFileCommand(fileCommand.name, path, this.plugin, fileCommand)
                    if (!fileCommand.updateCommand(fileCommand)) {
                        fileCommand.filePath = this.plugin.settings.commands.find(e => e?.id == fileCommand.id)?.filePath || fileCommand.filePath;
                        this.plugin.commands[this.plugin.commands.findIndex(e => e?.id == fileCommand.id)] = fileCommand;
                        this.display();
                    }
                }
            })
        });
        if (Platform.isDesktopApp) {
            setting.addDropdown(cb => {
                cb.addOptions(
                    {
                        'activeTab': 'Open in active tab',
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
                    fileCommand.updateCommand(fileCommand);
                    this.plugin.saveSettings();
                });
            })
        }
    }

    async deleteCommand(id: string) {
        const { commands } = this.plugin.settings;
        this.plugin.settings.commands = commands.filter(c => c.id !== id);
        this.plugin.commands = this.plugin.commands.filter(c => c.id !== id);
        await this.plugin.saveSettings();
    }

    createFileCommand(name: string, file: TFile | string, plugin: OpenFilesPlugin, fileCommand?: FileCommand): FileCommand {
        if (!fileCommand) {
            const id = crypto.randomUUID();
            fileCommand = new FileCommand(name, file, plugin, id);
        } else {
            fileCommand = new FileCommand(name, file, plugin, fileCommand.id);
        }
        return fileCommand;
    }

    saveFileCommand(fileCommand: FileCommand, settingsOnly?: boolean) {
        if (!settingsOnly) {
            this.plugin.commands.push(fileCommand);
        }
        this.plugin.settings.commands.push(({ id: fileCommand.id, name: fileCommand.name, filePath: fileCommand.filePath, openFileIn: fileCommand.openFileIn, command: fileCommand.command }) as FileCommand);
        this.plugin.saveSettings();
    }

    async addCommand(name: string, filePath: string, plugin: OpenFilesPlugin, id: string, notice?: boolean) {
        if (this.plugin.settings.commands.some(e => e?.filePath == filePath)) { return false; }
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) { return false; }
        const fileCommand = this.createFileCommand(name, file, plugin, new FileCommand(name, file, plugin, id));
        fileCommand.createCommand(this.plugin);
        this.saveFileCommand(fileCommand);
        return fileCommand;
    }
    createCommands() {
        let i = 0;
        this.plugin.commands = [];
        for (const fileCommand of this.plugin.settings.commands) {
            if (!fileCommand) continue;
            if (!fileCommand.id) fileCommand.id = crypto.randomUUID();
            const newFileCommand = this.createFileCommand(fileCommand.name, fileCommand.filePath, this.plugin, fileCommand);
            newFileCommand.createCommand(this.plugin);
            if (!fileCommand?.id) {
                this.plugin.settings.commands[i] = newFileCommand;
            }
            this.plugin.commands.push(newFileCommand);
            i++;
        }
        this.plugin.saveSettings();
    }
}

