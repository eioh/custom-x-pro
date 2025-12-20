/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '\\.html$': '<rootDir>/test/__mocks__/htmlMock.js',
    '\\.css$': '<rootDir>/test/__mocks__/cssMock.js'
  }
}
