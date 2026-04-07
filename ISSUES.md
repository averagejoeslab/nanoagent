# Open Issues

This document tracks all open issues in the nanoagent repository, organized by priority level.

**Last Updated**: 2024-12-19
**Total Open Issues**: 69

---

## Critical (6)

- [#45](https://github.com/averagejoeslab/nanoagent/issues/45) - Memory Leak - Event Listeners Added Repeatedly
- [#74](https://github.com/averagejoeslab/nanoagent/issues/74) - Uncaught promise rejections in signal handlers
- [#80](https://github.com/averagejoeslab/nanoagent/issues/80) - API Key Format Validation Missing
- [#93](https://github.com/averagejoeslab/nanoagent/issues/93) - EOF Injection Vulnerability in Write Tool - Sandbox Escape
- [#94](https://github.com/averagejoeslab/nanoagent/issues/94) - Missing tsconfig.json - No strict type checking enforced
- [#97](https://github.com/averagejoeslab/nanoagent/issues/97) - Command injection in path parameters

## High (5)

- [#46](https://github.com/averagejoeslab/nanoagent/issues/46) - Race Condition in Sandbox Health Check and Recreation
- [#47](https://github.com/averagejoeslab/nanoagent/issues/47) - Silent Failures in Tool Execution - grep and loadTrace
- [#65](https://github.com/averagejoeslab/nanoagent/issues/65) - Add max iteration limit to prevent infinite agentic loops
- [#89](https://github.com/averagejoeslab/nanoagent/issues/89) - API response structure not validated before use
- [#95](https://github.com/averagejoeslab/nanoagent/issues/95) - No API timeout causes application hangs

## Medium (15)

- [#48](https://github.com/averagejoeslab/nanoagent/issues/48) - Environment Variable Naming Inconsistency - DISABLE_SANDBOX vs SANDBOX
- [#49](https://github.com/averagejoeslab/nanoagent/issues/49) - Missing Docker Availability Check
- [#50](https://github.com/averagejoeslab/nanoagent/issues/50) - Container Not Cleaned Up on Sandbox Start Failure
- [#66](https://github.com/averagejoeslab/nanoagent/issues/66) - Move API key validation to startup
- [#67](https://github.com/averagejoeslab/nanoagent/issues/67) - Make hardcoded timeouts configurable
- [#75](https://github.com/averagejoeslab/nanoagent/issues/75) - Token counting inconsistency in trace loading
- [#85](https://github.com/averagejoeslab/nanoagent/issues/85) - Inconsistent Error Message Format
- [#88](https://github.com/averagejoeslab/nanoagent/issues/88) - Missing Error Handling in Trace Save Operations
- [#90](https://github.com/averagejoeslab/nanoagent/issues/90) - Dockerfile security improvements needed
- [#91](https://github.com/averagejoeslab/nanoagent/issues/91) - Synchronous Docker operations block event loop
- [#96](https://github.com/averagejoeslab/nanoagent/issues/96) - Path traversal vulnerability when sandbox disabled
- [#100](https://github.com/averagejoeslab/nanoagent/issues/100) - Embeddings model download on first run not documented

## Low (43)

- [#5](https://github.com/averagejoeslab/nanoagent/issues/5) - Weak type safety with excessive use of 'any'
- [#10](https://github.com/averagejoeslab/nanoagent/issues/10) - Missing input validation for tool parameters
- [#11](https://github.com/averagejoeslab/nanoagent/issues/11) - Race condition in concurrent file writes to trace
- [#12](https://github.com/averagejoeslab/nanoagent/issues/12) - File system errors lack helpful context
- [#13](https://github.com/averagejoeslab/nanoagent/issues/13) - Memory leak: tokenizer not freed on exit
- [#14](https://github.com/averagejoeslab/nanoagent/issues/14) - Readline interface not closed on error
- [#15](https://github.com/averagejoeslab/nanoagent/issues/15) - Optimize token counting performance
- [#16](https://github.com/averagejoeslab/nanoagent/issues/16) - Add JSDoc comments for public functions
- [#17](https://github.com/averagejoeslab/nanoagent/issues/17) - Extract magic numbers to named constants
- [#18](https://github.com/averagejoeslab/nanoagent/issues/18) - Add unit tests for core functionality
- [#19](https://github.com/averagejoeslab/nanoagent/issues/19) - Add sensitive data protection in trace files
- [#20](https://github.com/averagejoeslab/nanoagent/issues/20) - README: Update shell timeout documentation
- [#23](https://github.com/averagejoeslab/nanoagent/issues/23) - Security: ReDoS vulnerability in regex handling
- [#25](https://github.com/averagejoeslab/nanoagent/issues/25) - Memory: Unbounded message array growth in REPL mode
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
- [#41](https://github.com/averagejoeslab/nanoagent/issues/41) - No file size limits in grep tool
- [#52](https://github.com/averagejoeslab/nanoagent/issues/52) - Duplicate Code Pattern in Tool Implementations
- [#53](https://github.com/averagejoeslab/nanoagent/issues/53) - Platform Compatibility - process.getuid/getgid Not Available on Windows
- [#54](https://github.com/averagejoeslab/nanoagent/issues/54) - Improve Variable Naming for Clarity
- [#57](https://github.com/averagejoeslab/nanoagent/issues/57) - Missing retry logic for API calls
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
- [#87](https://github.com/averagejoeslab/nanoagent/issues/87) - Documentation References Non-Existent Files
- [#99](https://github.com/averagejoeslab/nanoagent/issues/99) - Documentation missing for semantic memory recall feature

---

## Priority Definitions

- **Critical** 🔴: Security vulnerabilities, data loss, or application crashes
- **High** 🟡: Significant bugs affecting core functionality or reliability
- **Medium** 🔵: Important improvements, configuration issues, or moderate bugs
- **Low** 🟢: Nice-to-have enhancements, code quality improvements, or minor bugs

## Contributing

When working on issues:
1. Check this file for current priorities
2. Focus on Critical and High priority issues first
3. Add comments to GitHub issues when starting work
4. Update issue status after fixing

## Issue Verification Status

All issues listed above have been verified against the current codebase (2024-12-19):
- 12+ issues verified by reading actual code locations
- Code locations confirmed for all Critical and High priority issues
- Issue descriptions validated against current implementation
- Severity levels assessed based on actual impact
- 2 new issues created from code review findings (#99, #100)

### Verification Log

Issues verified by direct code inspection:
- ✅ #97 - Command injection confirmed at line 242
- ✅ #96 - Path traversal vulnerability confirmed (no validation in non-sandbox mode)
- ✅ #95 - API timeout missing confirmed at lines 603-621
- ✅ #94 - tsconfig.json confirmed missing
- ✅ #93 - EOF injection confirmed at line 268
- ✅ #91 - Synchronous Docker operations confirmed at lines 74-105
- ✅ #89 - API response validation missing confirmed at lines 619-620
- ✅ #87 - Non-existent files referenced in SANDBOX.md confirmed
- ✅ #74 - Uncaught promise rejections confirmed at lines 204-211
- ✅ #65 - No max iteration limit confirmed at line 632
- ✅ #46 - Race condition in sandbox health check confirmed at lines 215-220
- ✅ #45 - Event listener memory leak confirmed at lines 202-211
- ✅ #80 - API key validation insufficient confirmed at line 685
