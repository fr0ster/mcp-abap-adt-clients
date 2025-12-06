/**
 * Example: Check local test class code before updating
 * 
 * Demonstrates two ways to validate ABAP Unit test class source code:
 * 1. Using CrudClient.checkClassTestClassBeforeUpdate() - recommended
 * 2. Using low-level checkClassLocalTestClass() function
 */

const { CrudClient } = require('../dist/clients/CrudClient');
const { checkClassLocalTestClass } = require('../dist/core/class');

const testConfig = {
  host: 'your-sap-host.com',
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD',
  client: '100'
};

const testClassSource = `
"!@testing ZADT_BLD_CLS01
CLASS ltcl_zadt_bld_cls01 DEFINITION
  FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS
  FINAL.

  PRIVATE SECTION.
    METHODS parent_data_two_rows FOR TESTING.
    METHODS child_data_relations FOR TESTING.
ENDCLASS.

CLASS ltcl_zadt_bld_cls01 IMPLEMENTATION.
  METHOD parent_data_two_rows.
    DATA lt_parent TYPE zadt_bld_cls01=>ty_parent_tab.
    lt_parent = zadt_bld_cls01=>build_parent_data( ).

    cl_abap_unit_assert=>assert_equals(
      act = lines( lt_parent )
      exp = 2
      msg = 'Expected 2 parent rows'
    ).

    DATA(ls_first) = lt_parent[ 1 ].
    cl_abap_unit_assert=>assert_equals(
      act = ls_first-fld1
      exp = '0000000001'
      msg = 'Incorrect key for first parent'
    ).
  ENDMETHOD.

  METHOD child_data_relations.
    DATA lt_parent TYPE zadt_bld_cls01=>ty_parent_tab.
    DATA lt_child  TYPE zadt_bld_cls01=>ty_child_tab.

    lt_parent = zadt_bld_cls01=>build_parent_data( ).
    lt_child  = zadt_bld_cls01=>build_child_data( ).

    cl_abap_unit_assert=>assert_equals(
      act = lines( lt_child )
      exp = 3
      msg = 'Expected 3 child rows'
    ).

    LOOP AT lt_child ASSIGNING FIELD-SYMBOL(<ls_child>).
      READ TABLE lt_parent WITH KEY fld1 = <ls_child>-parent_id TRANSPORTING NO FIELDS.
      cl_abap_unit_assert=>assert_equals(
        act = sy-subrc
        exp = 0
        msg = |Invalid parent reference { <ls_child>-parent_id }|
      ).
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.
`;

// Method 1: Using CrudClient (recommended)
async function checkTestClassViaCrudClient() {
  const client = new CrudClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    // Check test class code using CrudClient
    console.log('\n🔍 Checking test class code via CrudClient...');
    await client.checkClassTestClass({
      className: 'ZADT_BLD_CLS01',
      testClassCode: testClassSource
    });

    console.log('✓ Test class code is valid!');

  } catch (error) {
    console.error('✗ Check failed:', error.message);
    
    // Error message will contain details from SAP check
    // Example: "Test class check failed: The type "ZADT_BLD_CLS01" is unknown..."
    
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

// Method 2: Using low-level function (for advanced scenarios)
async function checkTestClassLowLevel() {
  const client = new CrudClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    // Check test class code using low-level function
    console.log('\n🔍 Checking test class code (low-level)...');
    const checkResult = await checkClassLocalTestClass(
      client.getConnection(),
      'ZADT_BLD_CLS01',
      testClassSource,
      'inactive'
    );

    console.log('✓ Test class code is valid!');
    console.log('Status:', checkResult.status);

  } catch (error) {
    console.error('✗ Check failed:', error.message);
    
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

// Run both examples
console.log('=== Method 1: CrudClient (recommended) ===');
checkTestClassViaCrudClient()
  .then(() => {
    console.log('\n=== Method 2: Low-level function ===');
    return checkTestClassLowLevel();
  })
  .catch(console.error);
