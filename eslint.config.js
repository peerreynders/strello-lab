// file: eslint.config.js
import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
// import eslintConfigPrettier from 'eslint-config-prettier';
import solid from 'eslint-plugin-solid/configs/typescript';
import * as tsParser from '@typescript-eslint/parser';

export default tsEslint.config(
	eslint.configs.recommended,
	tsEslint.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}'],
		...solid,
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: 'tsconfig.json',
			},
		},
		rules: {
			quotes: ['error', 'single', { avoidEscape: true }],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ args: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
		},
	}
);
