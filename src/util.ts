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
