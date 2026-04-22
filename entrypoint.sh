#!/bin/sh
set -e

# Navigate to the workspace (mounted by GitHub Actions)
cd "${GITHUB_WORKSPACE:-/github/workspace}"

# Run the assessment script
node /action/src/assess.js
