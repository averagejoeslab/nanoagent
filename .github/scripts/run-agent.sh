#!/bin/bash
set -e

# Wrapper script to run nanoagent and capture output safely
# This prevents shell interpretation of agent output

PROMPT="$1"

# Run nanoagent and capture all output to a log file
bun nanoagent.ts "$PROMPT" > /tmp/agent-output.log 2>&1
EXIT_CODE=$?

# Display the output for visibility in GitHub Actions logs
cat /tmp/agent-output.log

# Exit with the agent's exit code
exit $EXIT_CODE
