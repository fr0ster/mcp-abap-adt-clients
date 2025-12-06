/**
 * Example: Working with class include files
 * 
 * Demonstrates how to update and check class include files:
 * - Local types (implementations include)
 * - Definitions (class-relevant local types)
 * - Macros (legacy ABAP feature)
 */

const { CrudClient } = require('../dist/clients/CrudClient');

const testConfig = {
  host: 'your-sap-host.com',
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD',
  client: '100'
};

const localTypesCode = `
"! use this source file for the definition and implementation of
"! local helper classes, interface definitions and type
"! declarations
types: tyt_example_type type table of mara with default key.
`;

const definitionsCode = `
"! use this source file for any type of declarations (class
"! definitions, interfaces or type declarations) you need for
"! components in the private section
class lcl_helper definition.
  public section.
    methods: process.
endclass.
`;

const macrosCode = `
"! use this source file for any macro definitions you need
"! in the implementation part of the class
define class macros for zcl_my_class.
`;

async function workWithClassIncludes() {
  const client = new CrudClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    const className = 'ZCL_MY_CLASS';

    // Lock class
    console.log('\n🔒 Locking class...');
    await client.lockClass({ className });
    console.log('✓ Class locked');

    // Update local types
    console.log('\n📝 Updating local types...');
    await client.updateClassLocalTypes({
      className,
      localTypesCode
    });
    console.log('✓ Local types updated');

    // Update definitions
    console.log('\n📝 Updating definitions...');
    await client.updateClassDefinitions({
      className,
      definitionsCode
    });
    console.log('✓ Definitions updated');

    // Update macros (if using older ABAP version)
    console.log('\n📝 Updating macros...');
    await client.updateClassMacros({
      className,
      macrosCode
    });
    console.log('✓ Macros updated');

    // Activate class
    console.log('\n⚡ Activating class...');
    await client.activateClass({ className });
    console.log('✓ Class activated');

    // Unlock class
    console.log('\n🔓 Unlocking class...');
    await client.unlockClass({ className });
    console.log('✓ Class unlocked');

  } catch (error) {
    console.error('✗ Error:', error.message);
    
    // Try to unlock on error
    try {
      await client.unlockClass({ className: 'ZCL_MY_CLASS' });
      console.log('✓ Class unlocked after error');
    } catch (unlockError) {
      console.error('✗ Failed to unlock:', unlockError.message);
    }
    
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

// Example using ClassBuilder directly
async function workWithBuilderDirectly() {
  const { CrudClient } = require('../dist/clients/CrudClient');
  const { ClassBuilder } = require('../dist/core/class');

  const client = new CrudClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    const builder = new ClassBuilder(client.getConnection(), {
      className: 'ZCL_MY_CLASS'
    });

    // Chain operations using builder
    await builder
      .lock()
      .setLocalTypesCode(localTypesCode)
      .updateLocalTypes()
      .setDefinitionsCode(definitionsCode)
      .updateDefinitions()
      .setMacrosCode(macrosCode)
      .updateMacros()
      .activate()
      .unlock();

    console.log('✓ All includes updated and activated');

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

// Example: Check includes before updating
async function checkIncludesBeforeUpdate() {
  const client = new CrudClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    // Check local types code
    console.log('\n🔍 Checking local types...');
    await client.checkClassLocalTypes({
      className: 'ZCL_MY_CLASS',
      localTypesCode
    });
    console.log('✓ Local types check passed');

    // Check definitions code
    console.log('\n🔍 Checking definitions...');
    await client.checkClassDefinitions({
      className: 'ZCL_MY_CLASS',
      definitionsCode
    });
    console.log('✓ Definitions check passed');

    // Check macros code
    console.log('\n🔍 Checking macros...');
    await client.checkClassMacros({
      className: 'ZCL_MY_CLASS',
      macrosCode
    });
    console.log('✓ Macros check passed');

  } catch (error) {
    console.error('✗ Check failed:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

// Run examples
console.log('=== Example 1: Update class includes ===');
workWithClassIncludes()
  .then(() => {
    console.log('\n=== Example 2: Using ClassBuilder ===');
    return workWithBuilderDirectly();
  })
  .then(() => {
    console.log('\n=== Example 3: Check before update ===');
    return checkIncludesBeforeUpdate();
  })
  .catch(console.error);
