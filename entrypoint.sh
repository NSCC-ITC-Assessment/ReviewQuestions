#!/bin/sh
set -e

# Mark the workspace as safe for git (avoids "dubious ownership" error
# when the container user differs from the directory owner)
git config --global --add safe.directory /github/workspace

# Navigate to the workspace (mounted by GitHub Actions)
cd "${GITHUB_WORKSPACE:-/github/workspace}"

# Run the assessment script
node /action/src/assess.js
