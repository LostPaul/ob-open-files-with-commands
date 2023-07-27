import { App, Modal, Setting } from 'obsidian';
import FolderNotesPlugin from './main';
import { Variable, SettingsTab } from './settings'
export default class ManageVariablesModal extends Modal {
    plugin: FolderNotesPlugin;
    app: App;
    settings: SettingsTab;
    constructor(app: App, plugin: FolderNotesPlugin, settings: SettingsTab) {
        super(app);
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
    }
    onOpen() {
        this.display();
    }
    display() {
        const { contentEl } = this;
        contentEl.addClass('variable-settings');
        contentEl.empty();
        new Setting(contentEl)
            .setName('Manage Variables')
            .addButton((button) => {
                button
                    .setButtonText('Add Variable')
                    .onClick(() => {
                        const variable = createVariable(this.plugin);
                        addVariableListItem(this.settings, contentEl, variable, this);
                        this.settings.display();
                        this.plugin.saveSettings();
                    });
            })
        this.plugin.settings.customVariables.forEach(variable => {
            addVariableListItem(this.settings, contentEl, variable, this);
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

function addVariableListItem(settings: SettingsTab, containerEl: HTMLElement, variable: Variable, modal: ManageVariablesModal) {
    const plugin = settings.plugin;
    const setting = new Setting(containerEl)
    setting.setClass('variable-item');
    setting.addText(text => text
        .setPlaceholder('Variable Name')
        .setValue(variable.name)
        .onChange(async (value) => {
            variable.name = value;
            await plugin.saveSettings();
        }
        ));

    setting.addTextArea(text => text
        .setPlaceholder('Variable Value')
        .setValue(variable.value)
        .onChange(async (value) => {
            variable.value = value;
            await plugin.saveSettings();
        }
        ));
    setting.addDropdown(dropdown => dropdown
        .addOption('string', 'String')
        .addOption('javascript', 'JavaScript')
        .setValue(variable.type)
        .onChange(async (value: 'string') => {
            variable.type = value;
            await plugin.saveSettings();
        }
        ));

    setting.addButton((button) => {
        button
            .setIcon('trash')
            .setTooltip('Delete Variable')
            .onClick(() => {
                deleteVariable(plugin, variable);
                modal.display();
                plugin.saveSettings();
            });
    })
}

function createVariable(plugin: FolderNotesPlugin): Variable {
    const variable: Variable = {
        name: '',
        value: '',
        type: 'string'
    }
    plugin.settings.customVariables.push(variable);
    return variable;
}
function deleteVariable(plugin: FolderNotesPlugin, variable: Variable) {
    const index = plugin.settings.customVariables.indexOf(variable);
    if (index > -1) {
        plugin.settings.customVariables.splice(index, 1);
    }
}