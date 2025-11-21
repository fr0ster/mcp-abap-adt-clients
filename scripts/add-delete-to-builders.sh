#!/bin/bash

# Script to add delete methods to all Builders
# Usage: ./add-delete-to-builders.sh

set -e

BUILDERS=(
  "dataElement:DataElement"
  "domain:Domain"
  "functionGroup:FunctionGroup"
  "functionModule:FunctionModule"
  "interface:Interface"
  "package:Package"
  "structure:Structure"
  "table:Table"
  "view:View"
)

for item in "${BUILDERS[@]}"; do
  IFS=':' read -r dir name <<< "$item"
  
  BUILDER_FILE="src/core/${dir}/${name}Builder.ts"
  
  if [ ! -f "$BUILDER_FILE" ]; then
    echo "❌ Skipping ${name}Builder - file not found"
    continue
  fi
  
  echo "🔧 Processing ${name}Builder..."
  
  # 1. Add import for delete function
  if grep -q "import { delete${name} } from './delete';" "$BUILDER_FILE"; then
    echo "   ✓ Import already exists"
  else
    # Find the line with activation import and add delete after it
    if grep -q "from './activation';" "$BUILDER_FILE"; then
      sed -i "/from '\.\/activation';/a import { delete${name} } from './delete';" "$BUILDER_FILE"
      echo "   ✓ Added import"
    else
      echo "   ⚠️  No activation import found, adding at end of imports"
      # Find last import line and add after it
      last_import_line=$(grep -n "^import" "$BUILDER_FILE" | tail -1 | cut -d: -f1)
      sed -i "${last_import_line}a import { delete${name} } from './delete';" "$BUILDER_FILE"
    fi
  fi
  
  # 2. Add deleteResult to State interface
  if grep -q "deleteResult\?: AxiosResponse;" "$BUILDER_FILE"; then
    echo "   ✓ deleteResult already in state"
  else
    # Find activateResult and add deleteResult after it
    sed -i "/activateResult\?: AxiosResponse;/a \  deleteResult?: AxiosResponse;" "$BUILDER_FILE"
    echo "   ✓ Added deleteResult to state"
  fi
  
  # 3. Add delete() method (this is more complex, will need manual verification)
  if grep -q "async delete():" "$BUILDER_FILE"; then
    echo "   ✓ delete() method already exists"
  else
    echo "   ⚠️  delete() method needs to be added manually"
  fi
  
  # 4. Add getDeleteResult() getter
  if grep -q "getDeleteResult():" "$BUILDER_FILE"; then
    echo "   ✓ getDeleteResult() already exists"
  else
    echo "   ⚠️  getDeleteResult() needs to be added manually"
  fi
  
  # 5. Add delete to getResults() return type and value
  if grep -q "delete\?: AxiosResponse;" "$BUILDER_FILE"; then
    echo "   ✓ delete in getResults() type"
  else
    echo "   ⚠️  delete needs to be added to getResults()"
  fi
  
  echo ""
done

echo "✅ Done! Please review changes and add delete() method manually where needed"
