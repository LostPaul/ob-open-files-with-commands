import { PluginSettingTab, Setting, Command, App, TFile } from "obsidian";
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
            .setName("Manage the commands")
            .addTextArea(cb => cb.setValue("Enter the command name"))
            .addSearch(s => {
                new FileSuggest(
                    s.inputEl,
                    this.plugin
                )
            })
    }
    createCommands() {
        for (let fileCommand of this.plugin.settings.commands) {
            fileCommand = new FileCommand(this.plugin,fileCommand.name,fileCommand.filePath)
            fileCommand.addCommand(this.plugin);
        }
    }
    async addCommand(name: string, filePath: string) {
        const fileCommand = new FileCommand(this.plugin, name, filePath)
        this.plugin.settings.commands.push(fileCommand);
        await this.plugin.saveSettings();
        this.display();
    }
    deleteCommand(fileCommand: FileCommand) {
        const command = fileCommand.command;
        const { commands } = this.plugin.settings;
        const index = commands.findIndex(c => c.command.id === command.id);
        if (index !== -1) {
            commands.splice(index, 1);
            this.plugin.saveSettings();
            this.display();
        }
    }
}
export class FileCommand {
    command: Command;
    filePath: string;
    name: string;
    constructor(plugin: OpenFilesPlugin, name: string, filePath: string) {
        this.addCommand(plugin);
        this.filePath = filePath;
        this.name = name;
    }
    addCommand(plugin: OpenFilesPlugin) {
        return this.command = plugin.addCommand({
            id: this.filePath,
            name: this.name,
            callback() {   
                const file = plugin.app.vault.getAbstractFileByPath(this.id.replace("open-files-with-commands:", ""))
                if (file instanceof TFile) {
                    if (plugin.settings.openNewTab) {
                        plugin.app.workspace.getLeaf("tab").openFile(file)
                    } else {
                        plugin.app.workspace.getLeaf(false).openFile(file)
                    }
                }
            },
        });
    }
}