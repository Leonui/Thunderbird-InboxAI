#!/bin/bash

# Build Script for InboxAI Thunderbird Extension
# This script packages the extension source code into an .xpi file for installation/submission.

# Output filename
OUTPUT_FILE="thunderbird-ai-plugin.xpi"

echo "Building $OUTPUT_FILE..."

scripts/build_xpi.sh "$OUTPUT_FILE"

echo "Build complete: $OUTPUT_FILE"
