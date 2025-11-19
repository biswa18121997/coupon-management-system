// jest.config.js  ← Paste this exactly
export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',   // strips .js from imports
  },
  // Remove extensionsToTreatAsEsm completely — it's the culprit!
};