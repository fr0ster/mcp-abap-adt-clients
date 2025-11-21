#!/usr/bin/env node

/**
 * Script to add delete() method and getDeleteResult() getter to all Builders
 * Run: node scripts/add-delete-methods.js
 */

const fs = require('fs');
const path = require('path');

const BUILDERS = [
  { dir: 'interface', name: 'Interface', paramName: 'interface_name', configProp: 'interfaceName' },
  { dir: 'table', name: 'Table', paramName: 'table_name', configProp: 'tableName' },
  { dir: 'functionModule', name: 'FunctionModule', paramName: 'function_module_name', configProp: 'functionModuleName' },
  { dir: 'structure', name: 'Structure', paramName: 'structure_name', configProp: 'structureName' },
  { dir: 'view', name: 'View', paramName: 'view_name', configProp: 'viewName' },
  { dir: 'domain', name: 'Domain', paramName: 'domain_name', configProp: 'domainName' },
  { dir: 'dataElement', name: 'DataElement', paramName: 'data_element_name', configProp: 'dataElementName' },
  { dir: 'package', name: 'Package', paramName: 'package_name', configProp: 'packageName' },
];

function addDeleteMethod(builderPath, name, paramName, configProp) {
  let content = fs.readFileSync(builderPath, 'utf8');
  
  // 1. Add deleteResult to state if not exists
  if (!content.includes('deleteResult?: AxiosResponse;')) {
    content = content.replace(
      /activateResult\?: AxiosResponse;/,
      'activateResult?: AxiosResponse;\n  deleteResult?: AxiosResponse;'
    );
    console.log(`  ✓ Added deleteResult to state`);
  } else {
    console.log(`  ✓ deleteResult already in state`);
  }
  
  // 2. Add delete() method after activate()
  if (!content.includes('async delete():')) {
    const deleteMethod = `
  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting ${name.toLowerCase()}:', this.config.${configProp});
      const result = await delete${name}(
        this.connection,
        {
          ${paramName}: this.config.${configProp},
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('${name} deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }
`;
    
    // Find activate() method and add delete after it
    const activateRegex = /(async activate\(\):[\s\S]*?}\s*}\s*\n)/;
    if (activateRegex.test(content)) {
      content = content.replace(activateRegex, `$1${deleteMethod}\n`);
      console.log(`  ✓ Added delete() method`);
    } else {
      console.log(`  ⚠️  Could not find activate() method`);
    }
  } else {
    console.log(`  ✓ delete() method already exists`);
  }
  
  // 3. Add getDeleteResult() getter after getActivateResult()
  if (!content.includes('getDeleteResult():')) {
    const getter = `
  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }
`;
    
    const getActivateRegex = /(getActivateResult\(\):[\s\S]*?}\s*\n)/;
    if (getActivateRegex.test(content)) {
      content = content.replace(getActivateRegex, `$1${getter}\n`);
      console.log(`  ✓ Added getDeleteResult() getter`);
    } else {
      console.log(`  ⚠️  Could not find getActivateResult()`);
    }
  } else {
    console.log(`  ✓ getDeleteResult() already exists`);
  }
  
  // 4. Add delete to getResults() return type
  if (!content.match(/getResults\(\):[\s\S]*?activate\?: AxiosResponse;[\s\S]*?lockHandle/)) {
    // Need to add delete in type definition
    content = content.replace(
      /(getResults\(\):[\s\S]*?activate\?: AxiosResponse;)/,
      '$1\n    delete?: AxiosResponse;'
    );
    console.log(`  ✓ Added delete to getResults() type`);
  }
  
  // 5. Add delete to getResults() return value
  if (!content.match(/activate: this\.state\.activateResult,[\s\S]*?delete: this\.state\.deleteResult/)) {
    content = content.replace(
      /(activate: this\.state\.activateResult,)/,
      '$1\n      delete: this.state.deleteResult,'
    );
    console.log(`  ✓ Added delete to getResults() value`);
  }
  
  fs.writeFileSync(builderPath, content);
}

console.log('🔧 Adding delete methods to Builders...\n');

for (const { dir, name, paramName, configProp } of BUILDERS) {
  const builderPath = path.join(__dirname, '..', 'src', 'core', dir, `${name}Builder.ts`);
  
  if (!fs.existsSync(builderPath)) {
    console.log(`❌ ${name}Builder not found`);
    continue;
  }
  
  console.log(`Processing ${name}Builder...`);
  addDeleteMethod(builderPath, name, paramName, configProp);
  console.log('');
}

console.log('✅ Done!');
