import { Plugin, Menu, TAbstractFile, TFile } from 'obsidian';
import { SettingsTab, OpenFilesSettings, DEFAULT_SETTINGS } from './settings';
import { FileCommand } from './FileCommand';
export default class OpenFilesPlugin extends Plugin {
	settings: OpenFilesSettings;
	settingsTab: SettingsTab;
	commands: FileCommand[] = [];
	async onload() {
		console.log('loading open files with commands');
		await this.loadSettings();
		this.settingsTab = new SettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			const fileCommand = this.commands.find(c => c.filePath == file.path);
			if (!(file instanceof TFile)) { return; }
			if (!fileCommand) {
				menu.addItem((item) =>
					item
						.setTitle("Create a command for this file")
						.setIcon("command")
						.onClick(() => {
							const name = file.name.replace(".md", "");
							this.settingsTab.addCommand(name, file.path, this, crypto.randomUUID(), true);
						})
				)
			} else {
				menu.addItem((item) =>
					item
						.setTitle("Delete the command for this file")
						.setIcon("trash")
						.onClick(() => {
							this.settingsTab.deleteCommand(fileCommand.id);
						})
				)
			}
		}));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (!(file instanceof TFile)) return;
			if (!this.settings.updateCommandsOnRename) return;
			const fileCommand = this.commands.find(c => c.filePath == oldPath);
			if (fileCommand) {
				const name = file.name.replace(".md", "");
				const newFileCommand = this.settingsTab.createFileCommand(name, file.path, this, fileCommand);
				fileCommand.updateCommand(newFileCommand);
			}
		}));

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => {
			if (!this.settings.deleteCommandWhenFileIsDeleted) return;
			const fileCommand = this.commands.find(c => c.filePath == file.path);
			if (fileCommand) {
				this.settingsTab.deleteCommand(fileCommand.id);
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