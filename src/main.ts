import { Plugin, Menu, TAbstractFile } from 'obsidian';
import { SettingsTab, OpenFilesSettings, DEFAULT_SETTINGS, FileCommand } from './settings';

export default class OpenFilesPlugin extends Plugin {
	settings: OpenFilesSettings;
	settingsTab: SettingsTab;
	async onload() {
		console.log('loading open files with commands');
		await this.loadSettings();
		this.settingsTab = new SettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		this.settingsTab.createCommands();
		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			menu.addItem((item) =>
				item
					.setTitle("Create a command for this file")
					.setIcon("command")
					.onClick(() => {
						this.settingsTab.addCommand(file.name.replace(".md", ""), file.path, true);
					})
			)
		}));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			const fileCommand = this.settingsTab.commands.find(c => c.filePath == oldPath);
			if (fileCommand) {
				const newFileCommand = new FileCommand(file.name, file.path);
				this.settingsTab.updateCommand(newFileCommand, fileCommand);
			}
		}));

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => {
			const fileCommand = this.settingsTab.commands.find(c => c.filePath == file.path);
			if (fileCommand) {
				this.settingsTab.deleteCommand(fileCommand);
			}
		}));
	}

	onunload() {
		console.log('unloading open files with commands');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}