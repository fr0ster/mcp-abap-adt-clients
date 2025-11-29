# Test Configuration Schema

**Last Updated:** 2025-11-30  
**Status:** Active Schema (Updated with skip_cleanup parameter)

---

## Overview

All test parameters are defined in `src/__tests__/helpers/test-config.yaml`. This document describes the complete YAML schema for Builder tests.

## File Location

- **Main config:** `src/__tests__/helpers/test-config.yaml`
- **Template:** `src/__tests__/helpers/test-config.yaml.template`

## Top-Level Structure

```yaml
test_settings:
  # Test execution settings

create_<object_type>:
  builder_<object_type>:
    # Builder test case configuration

environment:
  # Global environment settings

standard_objects:
  # Registry of standard SAP objects for read tests
```

## Test Settings

```yaml
test_settings:
  timeout:
    test: 300000      # Timeout for full workflow tests (ms)
    read: 60000       # Timeout for read tests (ms)
    default: 30000    # Default timeout (ms)
```

## Environment Configuration

Global settings that apply to all tests:

```yaml
environment:
  default_package: ZOK_TEST_PKG_01        # Default package for test objects
  default_transport: E19K905635           # Optional: Default transport request
                                           # Required only for transportable packages
                                           # Local packages ($TMP) don't need transport
  cleanup_before: true                    # Clean up objects before test (default: true)
  cleanup_after: true                     # Clean up objects after test (default: true)
  skip_cleanup: false                     # Skip cleanup after test (objects left for analysis)
                                           # Can be overridden per test case
```

**Usage:**
- Tests can override these values in their specific `params` section
- If not specified in test case, environment defaults are used
- Tests skip gracefully if `default_package` is not configured

### Cleanup Configuration

The `skip_cleanup` parameter controls whether test objects are deleted after test execution:

- **Global level** (`environment.skip_cleanup`): Applies to all tests by default
- **Test case level** (`params.skip_cleanup`): Overrides global setting for specific test

**Behavior:**
- `skip_cleanup: false` (default): Objects are deleted after test (normal cleanup)
- `skip_cleanup: true`: Objects are **not deleted** but are **always unlocked** (for analysis)

**Important:** Unlock operations are **always performed** regardless of `skip_cleanup` setting. Only delete operations are skipped when `skip_cleanup: true`.

**Example:**
```yaml
environment:
  skip_cleanup: false  # Default: cleanup enabled

create_view:
  test_cases:
    - name: "builder_view"
      params:
        skip_cleanup: true  # Override: leave objects for analysis
```

**Use cases:**
- Debugging: Leave objects in SAP system for manual inspection
- Analysis: Keep test objects to verify their state after test execution
- Troubleshooting: Preserve objects when investigating test failures

## Builder Test Cases

Each object type has a `create_<object_type>` section with a `builder_<object_type>` test case:

```yaml
create_class:
  builder_class:
    enabled: true
    params:
      # Object-specific parameters
```

### Common Parameters

All Builder test cases support:

- `enabled: boolean` - Enable/disable the test case
- `params: object` - Test-specific parameters
  - `skip_cleanup: boolean` - Skip cleanup after test (overrides global `environment.skip_cleanup`)
    - `false` (default): Delete objects after test
    - `true`: Leave objects for analysis (unlock is still performed)

### Object-Specific Parameters

#### Class (`create_class`)

```yaml
create_class:
  builder_class:
    enabled: true
    params:
      class_name: ZADT_BLD_CL01
      package_name: ${environment.package_name}  # Optional, uses environment default
      transport_request: ${environment.transport_request}  # Optional
      source_code: |
        CLASS zadt_bld_cl01 DEFINITION PUBLIC FINAL CREATE PUBLIC.
        PUBLIC SECTION.
          METHODS: hello.
        ENDCLASS.
      updated_source_code: |
        CLASS zadt_bld_cl01 DEFINITION PUBLIC FINAL CREATE PUBLIC.
        PUBLIC SECTION.
          METHODS: hello, goodbye.
        ENDCLASS.
```

#### Domain (`create_domain`)

```yaml
create_domain:
  builder_domain:
    enabled: true
    params:
      domain_name: ZADT_BLD_DOM01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      datatype: CHAR
      length: 10
      description: Test domain
```

#### Data Element (`create_data_element`)

```yaml
create_data_element:
  builder_data_element:
    enabled: true
    params:
      data_element_name: ZADT_BLD_DTEL01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      domain_name: MANDT  # Reference to standard domain
      description: Test data element
```

#### Table (`create_table`)

```yaml
create_table:
  builder_table:
    enabled: true
    params:
      table_name: ZADT_BLD_TAB01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      ddl_code: |
        @AbapCatalog.enhancement.category: #NOT_EXTENSIBLE
        @AbapCatalog.dataMaintenance: #RESTRICTED
        define table zadt_bld_tab01 {
          key mandt : abap.clnt not null;
          key field1 : abap.char(10);
        }
```

#### Structure (`create_structure`)

```yaml
create_structure:
  builder_structure:
    enabled: true
    params:
      structure_name: ZADT_BLD_STR01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      ddl_code: |
        define structure zadt_bld_str01 {
          mandt : abap.clnt;
          field1 : abap.char(10);
        }
```

#### View (`create_view`)

```yaml
create_view:
  builder_view:
    enabled: true
    params:
      view_name: ZADT_BLD_VIEW01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      ddl_code: |
        @AbapCatalog.viewEnhancementCategory: #NOT_ALLOWED
        @AccessControl.authorizationCheck: #NOT_REQUIRED
        @EndUserText.label: 'Test View'
        define view entity zadt_bld_view01
          as select from t000
        {
          key mandt,
          mtext
        }
```

#### Interface (`create_interface`)

```yaml
create_interface:
  builder_interface:
    enabled: true
    params:
      interface_name: ZADT_BLD_IF01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      source_code: |
        INTERFACE zif_test PUBLIC.
          METHODS: test_method.
        ENDINTERFACE.
      updated_source_code: |
        INTERFACE zif_test PUBLIC.
          METHODS: test_method, another_method.
        ENDINTERFACE.
```

#### Program (`create_program`)

```yaml
create_program:
  builder_program:
    enabled: true
    params:
      program_name: ZADT_BLD_PROG01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      source_code: |
        REPORT zadt_bld_prog01.
        WRITE 'Hello'.
      updated_source_code: |
        REPORT zadt_bld_prog01.
        WRITE 'Hello World'.
```

**Note:** Programs are not supported in SAP BTP ABAP Environment (cloud). Tests skip automatically in cloud systems.

#### Function Group (`create_function_group`)

```yaml
create_function_group:
  builder_function_group:
    enabled: true
    params:
      function_group_name: ZADT_BLD_FGR01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      description: Test function group
```

#### Function Module (`create_function_module`)

```yaml
create_function_module:
  builder_function_module:
    enabled: true
    params:
      function_group_name: ZADT_BLD_FGR02  # Different from FunctionGroupBuilder test
      function_module_name: Z_ADT_BLD_FM01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      source_code: |
        FUNCTION z_adt_bld_fm01.
        *"----------------------------------------------------------------------
        *"*"Local Interface:
        *"----------------------------------------------------------------------
        RETURN.
        ENDFUNCTION.
      updated_source_code: |
        FUNCTION z_adt_bld_fm01.
        *"----------------------------------------------------------------------
        *"*"Local Interface:
        *"----------------------------------------------------------------------
        DATA: lv_text TYPE string VALUE 'Updated'.
        RETURN.
        ENDFUNCTION.
```

**Note:** Function module name must follow SAP naming convention: `Z_*` or `Y_*` (with underscore).

#### Package (`create_package`)

```yaml
create_package:
  builder_package:
    enabled: true
    params:
      package_name: ZADT_BLD_PKG01
      super_package: ${environment.package_name}  # Parent package
      description: Test package
```

#### Service Definition (`create_service_definition`)

```yaml
create_service_definition:
  builder_service_definition:
    enabled: true
    params:
      service_definition_name: ZADT_BLD_SRVD01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      description: Test service definition
      source_code: |
        @EndUserText.label: 'Test service definition'
        define service ZADT_BLD_SRVD01 {
          expose ZOK_C_CDS_TEST;
        }
```

#### Transport (`create_transport`)

```yaml
create_transport:
  builder_transport:
    enabled: true
    params:
      description: Test transport request
      # No package_name or transport_request needed
      # Transport is created dynamically
```

#### Read Service Definition (`read_service_definition`)

```yaml
read_service_definition:
  read_standard_service_definition:
    enabled: true
    params:
      # Specify standard object name directly (overrides standard_objects registry)
      service_definition_name: "I_SapPackage"  # Replace with existing service definition
      # Or use environment-specific parameters:
      # service_definition_name_cloud: "I_SapPackage"  # For cloud systems only
      # service_definition_name_onprem: "ZPLACEHOLDER_SRVD"  # For on-premise systems only
```

## Standard Objects Registry

Registry of standard SAP objects used for read tests:

```yaml
standard_objects:
  classes:
    - name: CL_ABAP_CHAR_UTILITIES
      description: Standard SAP utility class for character operations
      available_in:
        - onprem
        - cloud
    
    - name: CL_ABAP_STRING_UTILITIES
      description: Standard SAP utility class for string operations
      available_in:
        - onprem
        - cloud

  domains:
    - name: MANDT
      description: Client domain (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud

  data_elements:
    - name: MANDT
      description: Client data element (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud
    
    - name: INT1
      description: Single-byte integer data element
      available_in:
        - onprem
        - cloud

  tables:
    - name: T000
      description: Client table (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud

  structures:
    - name: SYST
      description: System structure (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud

  interfaces:
    - name: IF_ABAP_CHAR_UTILITIES
      description: Character utilities interface
      available_in:
        - onprem
        - cloud

  function_groups:
    - name: SYST
      description: System function group (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud

  function_modules:
    - name: SYSTEM_INFO
      group: SYST  # Function group name
      description: System information function module
      available_in:
        - onprem
        - cloud

  programs:
    - name: SAPLSETT
      description: Settings program (exists in most on-premise systems)
      available_in:
        - onprem
      # Note: Programs are not supported in cloud systems

  packages:
    - name: $TMP
      description: Local package (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud
    
    - name: SAP
      description: Standard SAP package
      available_in:
        - onprem
        - cloud

  views:
    - name: H_T000
      description: Help view for client table
      available_in:
        - onprem
        - cloud

  service_definitions:
    - name: I_SapPackage
      description: ABAP Cloud: replace with service definition name existing in tenant
      available_in:
        - cloud
    - name: ZPLACEHOLDER_SRVD
      description: Placeholder for on-premise service definition – replace with existing service definition
      available_in:
        - onprem
```

### Standard Object Selection

Objects are selected automatically based on:

1. **Environment detection** - Cloud vs on-premise
2. **Available objects** - Filtered by `available_in` array
3. **Priority** - First matching object is used

Helper function `resolveStandardObject(objectType, isCloud, testCase)` handles selection.

## Parameter Resolution

### Priority Order

1. **Test case params** - Explicit values in test case `params` section
2. **Environment defaults** - Values from `environment` section
3. **Skip test** - If required parameter is missing

### Helper Functions

- `resolvePackageName(testCase)` - Resolves package name from test case or environment
- `resolveTransportRequest(testCase)` - Resolves transport request (optional)
- `resolveStandardObject(type, isCloud, testCase)` - Resolves standard object for read tests

## Variable Substitution

Environment variables can be referenced using `${environment.variable_name}`:

```yaml
params:
  package_name: ${environment.package_name}
  transport_request: ${environment.transport_request}
```

## Naming Conventions

### Test Objects

All test objects use prefix `ZADT_BLD_*`:

- Classes: `ZADT_BLD_CL01`, `ZADT_BLD_CL02`, ...
- Domains: `ZADT_BLD_DOM01`, ...
- Tables: `ZADT_BLD_TAB01`, ...
- Function Modules: `Z_ADT_BLD_FM01` (with underscore for SAP convention)

### Function Groups

- `FunctionGroupBuilder` uses: `ZADT_BLD_FGR01`
- `FunctionModuleBuilder` uses: `ZADT_BLD_FGR02` (different to avoid conflicts)

## Required vs Optional Fields

### Required Fields

- `enabled: boolean` - Must be present
- Object name (e.g., `class_name`, `domain_name`) - Required for workflow test
- `package_name` - Required (can come from environment)

### Optional Fields

- `transport_request` - Only needed for transportable packages
- `description` - Optional metadata
- `source_code` / `updated_source_code` - Required for code-based objects (classes, interfaces, programs, function modules)
- `ddl_code` - Required for DDL-based objects (tables, structures, views)

## Environment-Specific Behavior

### Cloud Systems (SAP BTP ABAP Environment)

- Programs are **not supported** - Tests skip automatically
- Objects are **local** - No transport requests (404 on transport read is expected)
- Standard objects may differ - Registry filters by `available_in: cloud`

### On-Premise Systems

- All object types supported
- Transport requests may be required
- Standard objects filtered by `available_in: onprem`

## Validation

Use `scripts/verify-builder-tests.js` to validate:

- All Builder tests have correct structure
- All parameters come from YAML
- No hardcoded values
- Standard objects are properly configured

---

**Related Documentation:**
- [BUILDER_TEST_PATTERN.md](./BUILDER_TEST_PATTERN.md) - Test pattern documentation

