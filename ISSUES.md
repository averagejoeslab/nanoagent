# Open Issues

This document tracks all open issues in the nanoagent repository, organized by priority.

**Last Updated:** 2026-04-09

**Total Open Issues:** 63

---

## Critical (3)

- #80 - [Nanoagent Review] CRITICAL: API Key Format Validation Missing
- #74 - [Nanoagent Review] CRITICAL: Uncaught promise rejections in signal handlers
- #94 - [Nanoagent Review] CRITICAL: Missing tsconfig.json - No strict type checking enforced

## High (4)

- #95 - [Nanoagent Review] HIGH: No API timeout causes application hangs
- #89 - [Nanoagent Review] HIGH: API response structure not validated before use
- #65 - [Nanoagent Review] HIGH: Add max iteration limit to prevent infinite agentic loops
- #47 - [Nanoagent Review] HIGH: Silent Failures in Tool Execution - grep and loadTrace

## Medium (15)

- #104 - [Nanoagent Review] MEDIUM: No prominent warning when sandbox is disabled in REPL mode
- #102 - [Nanoagent Review] MEDIUM: executeTool lacks detailed error context
- #101 - [Nanoagent Review] MEDIUM: File write operations are not atomic
- #96 - [Nanoagent Review] MEDIUM: Path traversal vulnerability when sandbox disabled
- #91 - [Nanoagent Review] MEDIUM: Synchronous Docker operations block event loop
- #88 - [Nanoagent Review] MEDIUM: Missing Error Handling in Trace Save Operations
- #85 - [Nanoagent Review] MEDIUM: Inconsistent Error Message Format
- #75 - [Nanoagent Review] MEDIUM: Token counting inconsistency in trace loading
- #67 - [Nanoagent Review] MEDIUM: Make hardcoded timeouts configurable
- #66 - [Nanoagent Review] MEDIUM: Move API key validation to startup
- #50 - [Nanoagent Review] MEDIUM: Container Not Cleaned Up on Sandbox Start Failure
- #49 - [Nanoagent Review] MEDIUM: Missing Docker Availability Check
- #41 - [Nanoagent Review] No file size limits in grep tool
- #32 - [Nanoagent Review] Missing directory creation in write tool
- #23 - [Nanoagent Review] Security: ReDoS vulnerability in regex handling

## Low (20)

- #81 - [Nanoagent Review] LOW: Missing error context and stack traces in fatal error handler
- #78 - [Nanoagent Review] LOW: Performance - Inefficient token budget loading for large traces
- #77 - [Nanoagent Review] LOW: Performance - Sequential file reading in grep slows large codebases
- #72 - [Nanoagent Review] LOW: Split main() into separate functions for one-off vs REPL modes
- #71 - [Nanoagent Review] LOW: Refactor global mutable state into class or module
- #70 - [Nanoagent Review] LOW: Container name could use more entropy for uniqueness
- #69 - [Nanoagent Review] LOW: Use streaming for large file operations
- #68 - [Nanoagent Review] LOW: Inconsistent async/await usage in tool implementations
- #54 - [Nanoagent Review] LOW: Improve Variable Naming for Clarity
- #53 - [Nanoagent Review] LOW: Platform Compatibility - process.getuid/getgid Not Available on Windows
- #40 - [Nanoagent Review] Fix empty file handling edge case
- #39 - [Nanoagent Review] Add stdin TTY validation for interactive mode
- #28 - [Nanoagent Review] Verify: Line numbering calculation with offset parameter
- #20 - [Nanoagent Review] README: Update shell timeout documentation
- #17 - [Nanoagent Review] Extract magic numbers to named constants
- #16 - [Nanoagent Review] Add JSDoc comments for public functions
- #15 - [Nanoagent Review] Optimize token counting performance
- #14 - [Nanoagent Review] Readline interface not closed on error
- #13 - [Nanoagent Review] Memory leak: tokenizer not freed on exit
- #11 - [Nanoagent Review] Race condition in concurrent file writes to trace

## Enhancement (21)

- #105 - [Nanoagent Review] Comprehensive Documentation Updates Needed
- #64 - [Nanoagent Review] Add concurrency limits for parallel tool execution
- #63 - [Nanoagent Review] Add graceful degradation when sandbox fails to start
- #57 - [Nanoagent Review] Missing retry logic for API calls
- #38 - [Nanoagent Review] Add consistent result limits across tools
- #37 - [Nanoagent Review] Improve grep performance with scanning limits
- #36 - [Nanoagent Review] Add file size limits to prevent memory exhaustion
- #34 - [Nanoagent Review] Add debug/logging mode for troubleshooting
- #30 - [Nanoagent Review] Add configuration file support (.nanoagent.config.json)
- #27 - [Nanoagent Review] UX: Add rate limiting/summary for rapid tool execution display
- #19 - [Nanoagent Review] Add sensitive data protection in trace files
- #18 - [Nanoagent Review] Add unit tests for core functionality
- #12 - [Nanoagent Review] File system errors lack helpful context
- #10 - [Nanoagent Review] Missing input validation for tool parameters
- #5 - [Nanoagent Review] Weak type safety with excessive use of 'any'

---

## Issue Distribution by Type

- **Bug**: 17 issues
- **Enhancement**: 21 issues  
- **Documentation**: 3 issues
- **Security**: 5 issues
- **Performance**: 4 issues

## Recently Closed Issues

- #93 - [Nanoagent Review] CRITICAL: EOF Injection Vulnerability in Write Tool - **FIXED**
- #97 - [Nanoagent Review] CRITICAL: Command injection in path parameters - **FIXED**

---

## Priority Definitions

- **Critical**: Security vulnerabilities, data loss risks, or issues that prevent core functionality
- **High**: Significant bugs that affect reliability or user experience but have workarounds
- **Medium**: Issues that impact quality, maintainability, or cause inconvenience
- **Low**: Minor improvements, edge cases, or nice-to-have enhancements

## Contributing

When working on issues:
1. Comment on the issue before starting work
2. Reference the issue number in your PR (e.g., "Fixes #80")
3. Add tests when applicable
4. Update documentation if behavior changes

For questions about any issue, please comment directly on the GitHub issue.
