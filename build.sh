#!/bin/bash

# Build Script for InboxAI Thunderbird Extension
# This script packages the extension source code into an .xpi file for installation/submission.

# Output filename
OUTPUT_FILE="thunderbird-ai-plugin.xpi"

# Remove existing build artifact if it exists
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

echo "Building $OUTPUT_FILE..."

# Create the XPI archive
# -r: Recursive
# -x: Exclude patterns (git files, system files, the script itself, and existing XPIs)
zip -r "$OUTPUT_FILE" . \
    -x "*.git*" \
    -x ".github/*" \
    -x "*.DS_Store*" \
    -x "build.sh" \
    -x "*.xpi" \
    -x ".vscode/*" \
    -x ".idea/*"

echo "Build complete: $OUTPUT_FILE"
