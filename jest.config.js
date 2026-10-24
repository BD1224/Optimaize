module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: { '\\.sql$': '<rootDir>/tests/sqlTransform.js' },
  roots: ['<rootDir>/tests'],
};
