# Open Issues

Last updated: 2025-01-XX (Auto-generated from GitHub Issues)

## Critical (3)

- [#55](https://github.com/averagejoeslab/nanoagent/issues/55) - Command injection vulnerabilities in write/grep/glob tools
- [#74](https://github.com/averagejoeslab/nanoagent/issues/74) - Uncaught promise rejections in signal handlers
- [#80](https://github.com/averagejoeslab/nanoagent/issues/80) - API Key Format Validation Missing

## High (4)

- [#45](https://github.com/averagejoeslab/nanoagent/issues/45) - Memory Leak - Event Listeners Added Repeatedly
- [#46](https://github.com/averagejoeslab/nanoagent/issues/46) - Race Condition in Sandbox Health Check and Recreation
- [#47](https://github.com/averagejoeslab/nanoagent/issues/47) - Silent Failures in Tool Execution - grep and loadTrace
- [#65](https://github.com/averagejoeslab/nanoagent/issues/65) - Add max iteration limit to prevent infinite agentic loops

## Medium (14)

- [#11](https://github.com/averagejoeslab/nanoagent/issues/11) - Race condition in concurrent file writes to trace
- [#23](https://github.com/averagejoeslab/nanoagent/issues/23) - Security: ReDoS vulnerability in regex handling
- [#25](https://github.com/averagejoeslab/nanoagent/issues/25) - Memory: Unbounded message array growth in REPL mode
- [#41](https://github.com/averagejoeslab/nanoagent/issues/41) - No file size limits in grep tool
- [#43](https://github.com/averagejoeslab/nanoagent/issues/43) - Missing timeout on API calls
- [#48](https://github.com/averagejoeslab/nanoagent/issues/48) - Environment Variable Naming Inconsistency - DISABLE_SANDBOX vs SANDBOX
- [#49](https://github.com/averagejoeslab/nanoagent/issues/49) - Missing Docker Availability Check
- [#50](https://github.com/averagejoeslab/nanoagent/issues/50) - Container Not Cleaned Up on Sandbox Start Failure
- [#51](https://github.com/averagejoeslab/nanoagent/issues/51) - Improve API error handling and response validation
- [#66](https://github.com/averagejoeslab/nanoagent/issues/66) - Move API key validation to startup
- [#67](https://github.com/averagejoeslab/nanoagent/issues/67) - Make hardcoded timeouts configurable
- [#75](https://github.com/averagejoeslab/nanoagent/issues/75) - Token counting inconsistency in trace loading
- [#76](https://github.com/averagejoeslab/nanoagent/issues/76) - Incorrect regex escaping in edit tool
- [#84](https://github.com/averagejoeslab/nanoagent/issues/84) - No Path Validation - Directory Traversal Risk
- [#85](https://github.com/averagejoeslab/nanoagent/issues/85) - Inconsistent Error Message Format
- [#88](https://github.com/averagejoeslab/nanoagent/issues/88) - Missing Error Handling in Trace Save Operations

## Low (42)

- [#5](https://github.com/averagejoeslab/nanoagent/issues/5) - Weak type safety with excessive use of 'any'
- [#10](https://github.com/averagejoeslab/nanoagent/issues/10) - Missing input validation for tool parameters
- [#12](https://github.com/averagejoeslab/nanoagent/issues/12) - File system errors lack helpful context
- [#13](https://github.com/averagejoeslab/nanoagent/issues/13) - Memory leak: tokenizer not freed on exit
- [#14](https://github.com/averagejoeslab/nanoagent/issues/14) - Readline interface not closed on error
- [#15](https://github.com/averagejoeslab/nanoagent/issues/15) - Optimize token counting performance
- [#16](https://github.com/averagejoeslab/nanoagent/issues/16) - Add JSDoc comments for public functions
- [#17](https://github.com/averagejoeslab/nanoagent/issues/17) - Extract magic numbers to named constants
- [#18](https://github.com/averagejoeslab/nanoagent/issues/18) - Add unit tests for core functionality
- [#19](https://github.com/averagejoeslab/nanoagent/issues/19) - Add sensitive data protection in trace files
- [#20](https://github.com/averagejoeslab/nanoagent/issues/20) - README: Update shell timeout documentation
- [#27](https://github.com/averagejoeslab/nanoagent/issues/27) - UX: Add rate limiting/summary for rapid tool execution display
- [#28](https://github.com/averagejoeslab/nanoagent/issues/28) - Verify: Line numbering calculation with offset parameter
- [#30](https://github.com/averagejoeslab/nanoagent/issues/30) - Add configuration file support (.nanoagent.config.json)
- [#32](https://github.com/averagejoeslab/nanoagent/issues/32) - Missing directory creation in write tool
- [#34](https://github.com/averagejoeslab/nanoagent/issues/34) - Add debug/logging mode for troubleshooting
- [#36](https://github.com/averagejoeslab/nanoagent/issues/36) - Add file size limits to prevent memory exhaustion
- [#37](https://github.com/averagejoeslab/nanoagent/issues/37) - Improve grep performance with scanning limits
- [#38](https://github.com/averagejoeslab/nanoagent/issues/38) - Add consistent result limits across tools
- [#39](https://github.com/averagejoeslab/nanoagent/issues/39) - Add stdin TTY validation for interactive mode
- [#40](https://github.com/averagejoeslab/nanoagent/issues/40) - Fix empty file handling edge case
- [#52](https://github.com/averagejoeslab/nanoagent/issues/52) - Duplicate Code Pattern in Tool Implementations
- [#53](https://github.com/averagejoeslab/nanoagent/issues/53) - Platform Compatibility - process.getuid/getgid Not Available on Windows
- [#54](https://github.com/averagejoeslab/nanoagent/issues/54) - Improve Variable Naming for Clarity
- [#57](https://github.com/averagejoeslab/nanoagent/issues/57) - Missing retry logic for API calls
- [#58](https://github.com/averagejoeslab/nanoagent/issues/58) - Dockerfile security improvements needed
- [#60](https://github.com/averagejoeslab/nanoagent/issues/60) - System prompt inconsistency between one-off and REPL modes
- [#63](https://github.com/averagejoeslab/nanoagent/issues/63) - Add graceful degradation when sandbox fails to start
- [#64](https://github.com/averagejoeslab/nanoagent/issues/64) - Add concurrency limits for parallel tool execution
- [#68](https://github.com/averagejoeslab/nanoagent/issues/68) - Inconsistent async/await usage in tool implementations
- [#69](https://github.com/averagejoeslab/nanoagent/issues/69) - Use streaming for large file operations
- [#70](https://github.com/averagejoeslab/nanoagent/issues/70) - Container name could use more entropy for uniqueness
- [#71](https://github.com/averagejoeslab/nanoagent/issues/71) - Refactor global mutable state into class or module
- [#72](https://github.com/averagejoeslab/nanoagent/issues/72) - Split main() into separate functions for one-off vs REPL modes
- [#77](https://github.com/averagejoeslab/nanoagent/issues/77) - Performance - Sequential file reading in grep slows large codebases
- [#78](https://github.com/averagejoeslab/nanoagent/issues/78) - Performance - Inefficient token budget loading for large traces
- [#81](https://github.com/averagejoeslab/nanoagent/issues/81) - Missing error context and stack traces in fatal error handler
- [#86](https://github.com/averagejoeslab/nanoagent/issues/86) - Missing TypeScript Strict Mode Configuration
- [#87](https://github.com/averagejoeslab/nanoagent/issues/87) - Documentation References Non-Existent Files

## Documentation (3)

- [#20](https://github.com/averagejoeslab/nanoagent/issues/20) - README: Update shell timeout documentation
- [#73](https://github.com/averagejoeslab/nanoagent/issues/73) - Summary: Code review completed - 75+ distinct findings
- [#87](https://github.com/averagejoeslab/nanoagent/issues/87) - Documentation References Non-Existent Files

---

## Summary Statistics

- **Total Open Issues**: 62
- **Critical Priority**: 3
- **High Priority**: 4
- **Medium Priority**: 16
- **Low Priority**: 39

## Quick Links

- [All Open Issues](https://github.com/averagejoeslab/nanoagent/issues?q=is%3Aissue+is%3Aopen)
- [Critical Issues](https://github.com/averagejoeslab/nanoagent/issues?q=is%3Aissue+is%3Aopen+label%3Acritical)
- [Bug Issues](https://github.com/averagejoeslab/nanoagent/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- [Enhancement Issues](https://github.com/averagejoeslab/nanoagent/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)

## Priority Definitions

- **Critical**: Security vulnerabilities, data loss, crashes - immediate action required
- **High**: Major bugs, memory leaks, race conditions - should fix soon
- **Medium**: Moderate bugs, UX issues, missing features - plan to fix
- **Low**: Minor bugs, code quality, enhancements - nice to have
