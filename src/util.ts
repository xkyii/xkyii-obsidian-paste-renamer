import { App, Vault } from 'obsidian';

interface VaultConfig {
	useMarkdownLinks?: boolean
}

interface VaultWithConfig extends Vault {
	config?: VaultConfig,
}

export function getVaultConfig(app: App): VaultConfig | undefined {
	const vault = app.vault as VaultWithConfig;
	return vault.config;
}

export function toRegex(s: string): string {
	// 正则特殊字符
	s = replaceAll(s, '\\$', '\\$');
	s = replaceAll(s, '%', '\\%');
	s = replaceAll(s, '{', '\\{');
	s = replaceAll(s, '\\(', '\\(');
	// 剪贴板截图会被命名为: Paste Image xxxx.png, 并且cursorline中会encodeURI
	s = replaceAll(s, ' ', '%20');
	return s;
}

function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(find, 'g'), replace);
}
