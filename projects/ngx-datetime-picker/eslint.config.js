// @ts-check
const { defineConfig } = require('eslint/config');
const rootConfig = require('../../eslint.config.js');

module.exports = defineConfig([
  ...rootConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Directives are attribute selectors on <input>, e.g. input[ngxDtInput].
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ngxDt',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'ngx-dt',
          style: 'kebab-case',
        },
      ],
      // `for` and `rangePicker` are public template APIs (mirroring mat-datepicker-toggle /
      // mat-date-range-input); the class field keeps the more descriptive name `picker`.
      '@angular-eslint/no-input-rename': ['error', { allowedNames: ['for', 'rangePicker'] }],
      // ControlValueAccessor callbacks start as no-op arrow functions until registered.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    },
  },
]);
