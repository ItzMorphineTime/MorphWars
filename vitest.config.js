// Vitest config for Morph Wars RTS unit tests
// See docs/UNIT_TESTING_PLAN.md for setup and test targets.

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: ['node_modules', '**/assets/**'],
  },
});
