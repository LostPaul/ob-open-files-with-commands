import { Plugin, Menu, TAbstractFile, Notice } from 'obsidian';
import { SettingsTab, OpenFilesSettings, DEFAULT_SETTINGS } from './settings';

export default class OpenFilesPlugin extends Plugin {
	settings: OpenFilesSettings;
	settingsTab: SettingsTab;
	async onload() {
		await this.loadSettings();
		this.settingsTab = new SettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		this.settingsTab.createCommands();
		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
            console.log(file)
            menu.addItem((item) =>
                item
                    .setTitle("Create command for this file")
                    .setIcon("file")
					
                    .onClick((context) => {
						this.settingsTab.addCommand(file.name.replace(".md", ""),file.path)
						new Notice("Created an command for this file");
                    })
            )
        }));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}