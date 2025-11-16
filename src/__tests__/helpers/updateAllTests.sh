#!/bin/bash
# Script to update all test files to use setupTestEnvironment
# This script identifies test files that need updating

echo "Finding test files that need setupTestEnvironment..."

# Find all test files
find packages/adt-clients/src/__tests__/unit -name "*.test.ts" -type f | while read file; do
  # Check if file uses setupTestEnvironment
  if ! grep -q "setupTestEnvironment" "$file"; then
    echo "NEEDS UPDATE: $file"
  fi
done

echo ""
echo "Finding test files that already use setupTestEnvironment..."
find packages/adt-clients/src/__tests__/unit -name "*.test.ts" -type f | while read file; do
  if grep -q "setupTestEnvironment" "$file"; then
    echo "OK: $file"
  fi
done

