import { App, TFile, TAbstractFile, Plugin, PluginSettingTab, Setting, MarkdownView, Notice } from 'obsidian';
import { renderTemplate } from './template';
import { path } from './path';
import { getVaultConfig } from './util';

// Remember to rename these classes and interfaces!

interface PluginSettings {
	pattern: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	pattern: '{{DATE:YYYY.MM.DD-hhmmss}}'
};

const PASTED_IMAGE_PREFIX = 'Pasted image ';
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];

export default class RenamerPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// 设置页面
		this.addSettingTab(new SettingTab(this.app, this));

		// 注册事件
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (!(file instanceof TFile))
					return
				const timeGapMs = (new Date().getTime()) - file.stat.ctime
				// if the pasted image is created more than 1 second ago, ignore it
				if (timeGapMs > 1000)
					return
				// always ignore markdown file creation
				if (isMarkdownFile(file))
					return

				if (isPastedImage(file)) {
					this.startRenameProcess(file)
				}
			})
		)
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async startRenameProcess(file: TFile) {
		// get active file first
		const activeFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		if (!activeFile) {
			new Notice('Error: No active file found.')
			return
		}

		const newName = this.generateNewName(file, activeFile);

		this.renameFile(file, newName, activeFile);
	}

	async renameFile(file: TFile, newName: string, activeFile: TFile) {

		const originName = file.name;
		const originStem = encodeURI(file.basename);
		const ext = file.extension;
		const newNameExt = path.extension(newName);
		const newNameStem = newName.slice(0, newName.length - newNameExt.length - 1);

		console.log("originStem: ", originStem);
		console.log("ext: ", ext);

		/// rename file
		const newPath = path.join(file.parent.path, newName)
		console.log("newPath: ", newPath);
		try {
			await this.app.fileManager.renameFile(file, newPath)
		} catch (err) {
			new Notice(`Failed to rename ${newName}: ${err}`)
			throw err
		}

		/// replace current line
		const vaultConfig = getVaultConfig(this.app);
		const useMarkdownLinks = (vaultConfig && vaultConfig.useMarkdownLinks);


		let linkTextRegex, newLinkText
		if (useMarkdownLinks) {
			// NOTE should use this.app.fileManager.generateMarkdownLink(file, sourcePath) to get the encoded newNameStem, right now we just ignore this problem
			linkTextRegex = new RegExp(`!\\[\\]\\(([^[\\]]*\\/)?${originStem}\\.${ext}\\)`)
			newLinkText = `![]($1${newNameStem}.${ext})`
		} else {
			// ![[xxxx.png]] -> ![[attachments/xxxx.png]]
			linkTextRegex = new RegExp(`!\\[\\[([^[\\]]*\\/)?${originStem}\\.${ext}\\]\\]`)
			newLinkText = `![[$1${newNameStem}.${ext}]]`
		}
		console.log('linkTextRegex: ', linkTextRegex)
		console.log('newLinkText: ', newLinkText)

		// '![](../../assets/material/2022/10/Pasted%20image%2020221026172752.png)'.match('!\\[\\]\\(([^[\\]]*\\/)?Pasted%20image%2020221026172752.png\\)')

		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (!editor) {
			new Notice(`Failed to rename ${newName}: no active editor`)
			return
		}

		const cursor = editor.getCursor()
		const line = editor.getLine(cursor.line)
		console.log("cursor line: ", line);
		const replacedLine = line.replace(linkTextRegex, newLinkText)
		console.log('replacedLine: ', replacedLine)
		editor.transaction({
			changes: [
				{
					from: {...cursor, ch: 0},
					to: {...cursor, ch: line.length},
					text: replacedLine,
				}
			]
		})

		new Notice(`Renamed ${originName} to ${newName}`);
	}

	// returns a new name for the input file, with extension
	generateNewName(file: TFile, activeFile: TFile) {
		let imageNameKey = ''
		const fileCache = this.app.metadataCache.getFileCache(activeFile)
		if (fileCache) {
			console.log('frontmatter', fileCache.frontmatter)
			imageNameKey = fileCache.frontmatter?.imageNameKey || ''
		} else {
			console.warn('could not get file cache from active file', activeFile.name)
		}

		const stem = renderTemplate(this.settings.pattern, {
			imageNameKey,
			fileName: activeFile.basename,
		});

		const newName = stem + '.' + file.extension;
		console.log("newName: ", newName);
		return newName;
	}

} // end Plugin


function isMarkdownFile(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.extension === 'md') {
			return true
		}
	}
	return false
}


function isPastedImage(file: TAbstractFile): boolean {
	if (file instanceof TFile) {
		if (file.name.startsWith(PASTED_IMAGE_PREFIX)) {
			console.log("file is image.", file);
			return true;
		}
		if (IMAGE_EXTENSIONS.contains(file.extension)) {
			console.log("file is image. (with ext check)", file);
			return true;
		}
	}
	console.log("file is NOT image.", file);
	return false
}

class SettingTab extends PluginSettingTab {
	plugin: RenamerPlugin;

	constructor(app: App, plugin: RenamerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h3', {text: 'Paste Renamer'});

		new Setting(containerEl)
			.setName('Pattern')
			.setDesc('the pattern of you wish the file rename to.')
			.addText(text => text
				.setPlaceholder('Enter your pattern')
				.setValue(this.plugin.settings.pattern)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.pattern = value;
					await this.plugin.saveSettings();
				}));
	}
}
