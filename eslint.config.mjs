import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import pluginVue from "eslint-plugin-vue";
import vueParser from 'vue-eslint-parser'
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["**/node_modules", "**/dist", "**/out"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: {...globals.browser, ...globals.node} } },
  tseslint.configs.recommended,
  pluginVue.configs["flat/recommended"],
  { files: ["**/*.vue"], languageOptions: { parserOptions: { parser: vueParser, parserOptions: { ecmaFeatures: { jsx: true } }, extraFileExtensions: ['.vue'], parser: tseslint.parser } } },
  {
    files: ['**/*.{js,ts,mts,tsx,vue}'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ]
    }
  },
  eslintConfigPrettier
]);
