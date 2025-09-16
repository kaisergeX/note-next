import js from '@eslint/js'
import nextEslint from '@next/eslint-plugin-next'
import prettierEslintRecommended from 'eslint-plugin-prettier/recommended'
import pluginReact from 'eslint-plugin-react'
import {defineConfig} from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: {js},
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: {globals: {...globals.browser, ...globals.node}},
  },
  // {
  //   plugins: {tseslint},
  //   files: ['*.ts', '*.tsx'],
  //   parserOptions: {
  //     project: './tsconfig.json',
  //   },
  //   extends: ['tseslint/recommendedTypeChecked'],
  // },
  tseslint.configs.recommendedTypeChecked,
  pluginReact.configs.flat.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  nextEslint.flatConfig.coreWebVitals,
  prettierEslintRecommended,
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        {allowShortCircuit: true, allowTernary: true},
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])
