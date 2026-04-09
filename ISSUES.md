# Open Issues

Last updated: 2025-01-21

## Critical (0)

*No critical issues currently open*

## High (4)

- #95 - [Nanoagent Review] HIGH: No API timeout causes application hangs
- #89 - [Nanoagent Review] HIGH: API response structure not validated before use
- #65 - [Nanoagent Review] HIGH: Add max iteration limit to prevent infinite agentic loops
- #97 - [Nanoagent Review] CRITICAL: Command injection in path parameters

## Medium (17)

- #105 - [Nanoagent Review] Comprehensive Documentation Updates Needed
- #104 - [Nanoagent Review] MEDIUM: No prominent warning when sandbox is disabled in REPL mode
- #102 - [Nanoagent Review] MEDIUM: executeTool lacks detailed error context
- #101 - [Nanoagent Review] MEDIUM: File write operations are not atomic
- #96 - [Nanoagent Review] MEDIUM: Path traversal vulnerability when sandbox disabled
- #94 - [Nanoagent Review] CRITICAL: Missing tsconfig.json - No strict type checking enforced
- #93 - [Nanoagent Review] CRITICAL: EOF Injection Vulnerability in Write Tool - Sandbox Escape
- #91 - [Nanoagent Review] MEDIUM: Synchronous Docker operations block event loop
- #88 - [Nanoagent Review] MEDIUM: Missing Error Handling in Trace Save Operations
- #85 - [Nanoagent Review] MEDIUM: Inconsistent Error Message Format
- #75 - [Nanoagent Review] MEDIUM: Token counting inconsistency in trace loading
- #67 - [Nanoagent Review] MEDIUM: Make hardcoded timeouts configurable
- #66 - [Nanoagent Review] MEDIUM: Move API key validation to startup
- #57 - [Nanoagent Review] Missing retry logic for API calls
- #41 - [Nanoagent Review] No file size limits in grep tool
- #32 - [Nanoagent Review] Missing directory creation in write tool
- #30 - [Nanoagent Review] Add configuration file support (.nanoagent.config.json)

## Low (25)

- #81 - [Nanoagent Review] LOW: Missing error context and stack traces in fatal error handler
- #78 - [Nanoagent Review] LOW: Performance - Inefficient token budget loading for large traces
- #77 - [Nanoagent Review] LOW: Performance - Sequential file reading in grep slows large codebases
- #72 - [Nanoagent Review] LOW: Split main() into separate functions for one-off vs REPL modes
- #71 - [Nanoagent Review] LOW: Refactor global mutable state into class or module
- #70 - [Nanoagent Review] LOW: Container name could use more entropy for uniqueness
- #69 - [Nanoagent Review] LOW: Use streaming for large file operations
- #68 - [Nanoagent Review] LOW: Inconsistent async/await usage in tool implementations
- #64 - [Nanoagent Review] Add concurrency limits for parallel tool execution
- #63 - [Nanoagent Review] Add graceful degradation when sandbox fails to start
- #60 - [Nanoagent Review] System prompt inconsistency between one-off and REPL modes
- #54 - [Nanoagent Review] LOW: Improve Variable Naming for Clarity
- #53 - [Nanoagent Review] LOW: Platform Compatibility - process.getuid/getgid Not Available on Windows
- #52 - [Nanoagent Review] LOW: Duplicate Code Pattern in Tool Implementations
- #50 - [Nanoagent Review] MEDIUM: Container Not Cleaned Up on Sandbox Start Failure
- #49 - [Nanoagent Review] MEDIUM: Missing Docker Availability Check
- #47 - [Nanoagent Review] HIGH: Silent Failures in Tool Execution - grep and loadTrace
- #46 - [Nanoagent Review] HIGH: Race Condition in Sandbox Health Check and Recreation
- #40 - [Nanoagent Review] Fix empty file handling edge case
- #39 - [Nanoagent Review] Add stdin TTY validation for interactive mode
- #38 - [Nanoagent Review] Add consistent result limits across tools
- #37 - [Nanoagent Review] Improve grep performance with scanning limits
- #36 - [Nanoagent Review] Add file size limits to prevent memory exhaustion
- #34 - [Nanoagent Review] Add debug/logging mode for troubleshooting
- #28 - [Nanoagent Review] Verify: Line numbering calculation with offset parameter

## Documentation (6)

- #105 - [Nanoagent Review] Comprehensive Documentation Updates Needed
- #20 - [Nanoagent Review] README: Update shell timeout documentation
- #19 - [Nanoagent Review] Add sensitive data protection in trace files
- #18 - [Nanoagent Review] Add unit tests for core functionality
- #17 - [Nanoagent Review] Extract magic numbers to named constants
- #16 - [Nanoagent Review] Add JSDoc comments for public functions

## Enhancements (11)

- #74 - [Nanoagent Review] CRITICAL: Uncaught promise rejections in signal handlers
- #64 - [Nanoagent Review] Add concurrency limits for parallel tool execution
- #63 - [Nanoagent Review] Add graceful degradation when sandbox fails to start
- #57 - [Nanoagent Review] Missing retry logic for API calls
- #38 - [Nanoagent Review] Add consistent result limits across tools
- #37 - [Nanoagent Review] Improve grep performance with scanning limits
- #36 - [Nanoagent Review] Add file size limits to prevent memory exhaustion
- #34 - [Nanoagent Review] Add debug/logging mode for troubleshooting
- #32 - [Nanoagent Review] Missing directory creation in write tool
- #30 - [Nanoagent Review] Add configuration file support (.nanoagent.config.json)
- #27 - [Nanoagent Review] UX: Add rate limiting/summary for rapid tool execution display

## Bugs (14)

- #97 - [Nanoagent Review] CRITICAL: Command injection in path parameters
- #96 - [Nanoagent Review] MEDIUM: Path traversal vulnerability when sandbox disabled
- #93 - [Nanoagent Review] CRITICAL: EOF Injection Vulnerability in Write Tool - Sandbox Escape
- #91 - [Nanoagent Review] MEDIUM: Synchronous Docker operations block event loop
- #89 - [Nanoagent Review] HIGH: API response structure not validated before use
- #88 - [Nanoagent Review] MEDIUM: Missing Error Handling in Trace Save Operations
- #80 - [Nanoagent Review] CRITICAL: API Key Format Validation Missing
- #75 - [Nanoagent Review] MEDIUM: Token counting inconsistency in trace loading
- #74 - [Nanoagent Review] CRITICAL: Uncaught promise rejections in signal handlers
- #65 - [Nanoagent Review] HIGH: Add max iteration limit to prevent infinite agentic loops
- #60 - [Nanoagent Review] System prompt inconsistency between one-off and REPL modes
- #52 - [Nanoagent Review] LOW: Duplicate Code Pattern in Tool Implementations
- #25 - [Nanoagent Review] Memory: Unbounded message array growth in REPL mode
- #23 - [Nanoagent Review] Security: ReDoS vulnerability in regex handling

## Security (7)

- #97 - [Nanoagent Review] CRITICAL: Command injection in path parameters
- #96 - [Nanoagent Review] MEDIUM: Path traversal vulnerability when sandbox disabled
- #93 - [Nanoagent Review] CRITICAL: EOF Injection Vulnerability in Write Tool - Sandbox Escape
- #80 - [Nanoagent Review] CRITICAL: API Key Format Validation Missing
- #74 - [Nanoagent Review] CRITICAL: Uncaught promise rejections in signal handlers
- #46 - [Nanoagent Review] HIGH: Race Condition in Sandbox Health Check and Recreation
- #23 - [Nanoagent Review] Security: ReDoS vulnerability in regex handling

---

**Total Open Issues:** 46

**Recently Closed:**
- #103 - [Nanoagent Review] LOW: containerId could use better validation in Docker commands (Fixed: Container ID already validated with regex)
