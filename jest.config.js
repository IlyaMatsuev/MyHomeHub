module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^auth/(.*)$': '<rootDir>/auth/$1',
        '^common/(.*)$': '<rootDir>/common/$1',
        '^db/(.*)$': '<rootDir>/db/$1',
        '^devices/(.*)$': '<rootDir>/devices/$1',
        '^devices-control/(.*)$': '<rootDir>/devices-control/$1',
        '^mqtt/(.*)$': '<rootDir>/mqtt/$1',
        '^scenarios/(.*)$': '<rootDir>/scenarios/$1',
        '^scheduler/(.*)$': '<rootDir>/scheduler/$1',
        '^users/(.*)$': '<rootDir>/users/$1',
    },
};
