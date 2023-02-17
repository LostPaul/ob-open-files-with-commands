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
            .addSearch(s => {
                new FileSuggest(
                    s.inputEl,
                    this.plugin
                )
            })
            .addText(cb => cb.setValue("Enter the command name"))

        for (const fileCommand of this.plugin.settings.commands) {
            const setting = new Setting(containerEl)
                .addButton(cb => {
                    cb.onClick(() => {
                        setting.clear();
                        this.deleteCommand(fileCommand)
                    })
                    cb.setButtonText("✕")
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
    }
    createCommands() {
        for (let fileCommand of this.plugin.settings.commands) {
            fileCommand = new FileCommand(this.plugin, fileCommand.name, fileCommand.filePath)
            this.commands.push(fileCommand);
        }
    }
    async addCommand(name: string, filePath: string) {
        if (this.plugin.settings.commands.some(e => e.filePath == filePath)) {
            return new Notice("Command already exists");
        }
        const fileCommand = new FileCommand(this.plugin, name, filePath);
        this.plugin.settings.commands.push(fileCommand);
        this.commands.push(fileCommand);
        await this.plugin.saveSettings();
        this.display();
        new Notice("Created a command for this file");
    }
    async updateCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this;
        const index = commands.findIndex(c => c.command.id === command.id);
        if (index !== -1) {
            commands[index].name = fileCommand.name;
            commands[index].filePath = fileCommand.filePath;
            commands[index].command.name = "Open files with commands: " + fileCommand.name;
            commands[index].command.id = "open-files-with-commands:" + fileCommand.filePath;
            this.plugin.settings.commands[index] = commands[index];
            await this.plugin.saveSettings();
        }
    }
    async deleteCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c.command.id === command.id);
        if (index !== -1) {
            commands.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
        }
    }
}
export class FileCommand {
    command: Command;
    filePath: string;
    name: string;
    constructor(plugin: OpenFilesPlugin, name: string, filePath: string) {
        this.filePath = filePath;
        this.name = name;
        this.addCommand(plugin);
    }
    addCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.filePath,
            name: this.name,
            checkCallback(checking) {
                const { id } = this;
                console.log(id)
                if (!plugin.settings.commands.some(e => e.command.id == id)) {
                    return false;
                }
                if (!checking) {
                    const file = plugin.app.vault.getAbstractFileByPath(this.id.replace("open-files-with-commands:", ""));
                    if (file instanceof TFile) {
                        if (plugin.settings.openNewTab) {
                            plugin.app.workspace.getLeaf("tab").openFile(file)
                        } else {
                            plugin.app.workspace.getLeaf(false).openFile(file)
                        }
                    }
                }
                return true;
            },
        });
    }
}