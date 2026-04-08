# Open Issues

This document tracks all currently open issues for nanoagent, organized by priority.

**Total Open Issues: 30**

---

## Critical (5)

Security and stability issues that should be addressed immediately:

- [#93](https://github.com/averagejoeslab/nanoagent/issues/93) - EOF Injection Vulnerability in Write Tool - Sandbox Escape
- [#97](https://github.com/averagejoeslab/nanoagent/issues/97) - Command injection in path parameters
- [#74](https://github.com/averagejoeslab/nanoagent/issues/74) - Uncaught promise rejections in signal handlers
- [#80](https://github.com/averagejoeslab/nanoagent/issues/80) - API Key Format Validation Missing
- [#94](https://github.com/averagejoeslab/nanoagent/issues/94) - Missing tsconfig.json - No strict type checking enforced

---

## High (3)

Important issues affecting reliability and functionality:

- [#95](https://github.com/averagejoeslab/nanoagent/issues/95) - No API timeout causes application hangs
- [#89](https://github.com/averagejoeslab/nanoagent/issues/89) - API response structure not validated before use
- [#65](https://github.com/averagejoeslab/nanoagent/issues/65) - Add max iteration limit to prevent infinite agentic loops

---

## Medium (10)

Issues that impact usability and code quality:

- [#101](https://github.com/averagejoeslab/nanoagent/issues/101) - File write operations are not atomic
- [#96](https://github.com/averagejoeslab/nanoagent/issues/96) - Path traversal vulnerability when sandbox disabled
- [#91](https://github.com/averagejoeslab/nanoagent/issues/91) - Synchronous Docker operations block event loop
- [#88](https://github.com/averagejoeslab/nanoagent/issues/88) - Missing Error Handling in Trace Save Operations
- [#102](https://github.com/averagejoeslab/nanoagent/issues/102) - executeTool lacks detailed error context
- [#85](https://github.com/averagejoeslab/nanoagent/issues/85) - Inconsistent Error Message Format
- [#75](https://github.com/averagejoeslab/nanoagent/issues/75) - Token counting inconsistency in trace loading
- [#67](https://github.com/averagejoeslab/nanoagent/issues/67) - Make hardcoded timeouts configurable
- [#66](https://github.com/averagejoeslab/nanoagent/issues/66) - Move API key validation to startup
- [#104](https://github.com/averagejoeslab/nanoagent/issues/104) - No prominent warning when sandbox is disabled in REPL mode

---

## Low (11)

Nice-to-have improvements and optimizations:

- [#81](https://github.com/averagejoeslab/nanoagent/issues/81) - Missing error context and stack traces in fatal error handler
- [#78](https://github.com/averagejoeslab/nanoagent/issues/78) - Performance - Inefficient token budget loading for large traces
- [#77](https://github.com/averagejoeslab/nanoagent/issues/77) - Performance - Sequential file reading in grep slows large codebases
- [#72](https://github.com/averagejoeslab/nanoagent/issues/72) - Split main() into separate functions for one-off vs REPL modes
- [#71](https://github.com/averagejoeslab/nanoagent/issues/71) - Refactor global mutable state into class or module
- [#70](https://github.com/averagejoeslab/nanoagent/issues/70) - Container name could use more entropy for uniqueness
- [#69](https://github.com/averagejoeslab/nanoagent/issues/69) - Use streaming for large file operations
- [#68](https://github.com/averagejoeslab/nanoagent/issues/68) - Inconsistent async/await usage in tool implementations
- [#64](https://github.com/averagejoeslab/nanoagent/issues/64) - Add concurrency limits for parallel tool execution
- [#63](https://github.com/averagejoeslab/nanoagent/issues/63) - Add graceful degradation when sandbox fails to start
- [#103](https://github.com/averagejoeslab/nanoagent/issues/103) - containerId could use better validation in Docker commands

---

## Documentation (1)

Documentation improvements:

- [#105](https://github.com/averagejoeslab/nanoagent/issues/105) - Comprehensive Documentation Updates Needed

---

## Issue Priority Guidelines

- **Critical**: Security vulnerabilities, data corruption risks, crashes
- **High**: Significant functionality gaps, reliability issues
- **Medium**: Usability problems, code quality issues, non-critical bugs
- **Low**: Minor improvements, optimizations, refactoring suggestions
- **Documentation**: Documentation gaps and improvements

---

**Last Updated**: 2024 (via automated review workflow)
