import js from '@eslint/js'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettierEslintRecommended from 'eslint-plugin-prettier/recommended'
import {defineConfig, globalIgnores} from 'eslint/config'
import globals from 'globals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/',
    '*.config.*',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: {js},
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: {globals: {...globals.browser, ...globals.node}},
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off', // eslint doesn't aware of types that globally injected by Next.js (.next/dev/types/**)
    },
  },
  // {
  //   plugins: {tseslint},
  //   files: ['*.ts', '*.tsx'],
  //   parserOptions: {
  //     project: './tsconfig.json',
  //   },
  //   extends: ['tseslint/recommendedTypeChecked'],
  // },
  // tseslint.configs.recommendedTypeChecked,
  prettierEslintRecommended,
  {
    settings: {
      react: {version: '19'},
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': 'off',
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
