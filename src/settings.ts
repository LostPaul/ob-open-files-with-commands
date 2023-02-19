import { PluginSettingTab, Setting, Command, App, TFile, Notice } from "obsidian";
import OpenFilesPlugin from './main';
import { FileSuggest } from './suggesters/FileSuggester'
export interface OpenFilesSettings {
    commands: FileCommand[];
    openNewTab: boolean;
}
export const DEFAULT_SETTINGS: OpenFilesSettings = {
    commands: [],
    openNewTab: false
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

        containerEl.createEl("h2", { text: "Open files with commands settings" })
        containerEl.classList.add("ofwc-settings")
        new Setting(containerEl)
            .setName("Open files in new tabs")
            .addToggle(cb =>
                cb
                    .setValue(this.plugin.settings.openNewTab)
                    .onChange(async val => {
                        this.plugin.settings.openNewTab = val
                        await this.plugin.saveSettings()
                    }))

        new Setting(containerEl)
            .setHeading()
            .setName("Manage commands")
        new Setting(containerEl)
            .setName("Create a new command")
            .addButton(cb => {
                cb.setIcon("plus")
                cb.setClass("create-command-button")
                cb.onClick(() => {
                    const fileCommand = new FileCommand("", "");
                    this.addCommandListOption(containerEl, fileCommand);
                })
            })

        for (const fileCommand of this.plugin.settings.commands.filter(e => e != null)) {
            this.addCommandListOption(containerEl, fileCommand);
        }
    }
    createCommands() {
        for (let fileCommand of this.plugin.settings.commands) {
            fileCommand = new FileCommand(fileCommand.name, fileCommand.filePath)
            fileCommand.addCommand(this.plugin);
            this.commands.push(fileCommand);
        }
    }
    async addCommand(name: string, filePath: string, notice?: boolean) {
        if (this.plugin.settings.commands.some(e => e?.filePath == filePath)) {
            return new Notice("Command already exists");
        }
        const fileCommand = new FileCommand(name, filePath);
        fileCommand.addCommand(this.plugin);
        this.plugin.settings.commands.push(fileCommand);
        this.commands.push(fileCommand);
        await this.plugin.saveSettings();
        this.display();
        if (notice) {
            new Notice("Created a command for this file");
        }
    }
    async addCommandListOption(containerEl: HTMLElement, fileCommand: FileCommand) {
        const setting = new Setting(containerEl)
            .setClass("ofwc-command-list")
            .addButton(cb => {
                cb.onClick(() => {
                    setting.clear();
                    console.log(fileCommand)
                    if (fileCommand.command) {
                        this.deleteCommand(fileCommand)
                    }
                })
                cb.setIcon("trash-2")
            })
            .addText(cb => {
                cb.setValue(fileCommand.name)
                cb.onChange(() => {
                    fileCommand.name = cb.getValue();
                    this.updateCommand(fileCommand);
                })
            })
            .addSearch(s => {
                new FileSuggest(
                    s.inputEl,
                    this.plugin
                )
                s.setValue(fileCommand.filePath)
                s.onChange(() => {
                    if (this.plugin.app.vault.getAbstractFileByPath(s.getValue())) {
                        fileCommand.filePath = s.getValue();
                        this.updateCommand(fileCommand);
                    }
                })
            });
    }
    async updateCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this;
        const index = commands.findIndex(c => c.command?.id === command?.id);
        if (index !== -1) {
            commands[index].name = fileCommand.name;
            commands[index].filePath = fileCommand.filePath;
            commands[index].command.name = "Open files with commands: " + fileCommand.name;
            commands[index].command.id = "open-files-with-commands:" + fileCommand.filePath;
            this.plugin.settings.commands[index] = commands[index];
            await this.plugin.saveSettings();
        } else {
            if (fileCommand.name.trim() != '' && this.plugin.app.vault.getAbstractFileByPath(fileCommand.filePath)) {
                this.addCommand(fileCommand.name, fileCommand.filePath)
            }
        }
    }
    async deleteCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c?.command.id === command.id);
        if (index !== -1) {
            commands.splice(index, 1);
            this.commands.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
        }
    }
}
export class FileCommand {
    command: Command;
    filePath: string;
    name: string;
    constructor(name: string, filePath: string) {
        this.filePath = filePath;
        this.name = name;
    }
    addCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.filePath,
            name: this.name,
            checkCallback(checking) {
                const { id } = this;
                if (!id) {
                    return false;
                }
                console.log(plugin.settings.commands)
                if (!plugin.settings.commands.some(e => e?.command?.id == id)) {
                    return false;
                }
                if (!checking) {
                    const file = plugin.app.vault.getAbstractFileByPath(id.replace("open-files-with-commands:", ""));
                    if (file instanceof TFile) {
                        if (plugin.settings.openNewTab) {
                            plugin.app.workspace.getLeaf("tab").openFile(file)
                        } else {
                            plugin.app.workspace.getLeaf(false).openFile(file)
                        }
                    }
                }
                return true;
            }
        });
    }
}