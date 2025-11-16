# Builder Tests Separation - Implementation Guide

## Problem
Builder tests (ClassBuilder.test.ts, DomainBuilder.test.ts, etc.) compete with create.test.ts for the same objects in YAML configuration, causing conflicts (403 errors) when tests run together.

## Solution
Create separate test cases named `builder_*` in test-config.yaml.template for each object type.

## Implementation Status

### ✅ Completed:
- **All Builder test files updated** (11 files):
  - class: ClassBuilder.test.ts → `builder_class`
  - domain: DomainBuilder.test.ts → `builder_domain`
  - dataElement: DataElementBuilder.test.ts → `builder_data_element`
  - interface: InterfaceBuilder.test.ts → `builder_interface`
  - program: ProgramBuilder.test.ts → `builder_program`
  - table: TableBuilder.test.ts → `builder_table`
  - structure: StructureBuilder.test.ts → `builder_structure`
  - view: ViewBuilder.test.ts → `builder_view`
  - package: PackageBuilder.test.ts → `builder_package`
  - functionGroup: FunctionGroupBuilder.test.ts → `builder_function_group`
  - functionModule: FunctionModuleBuilder.test.ts → `builder_function_module`

- **All YAML templates added** to test-config.yaml.template:
  - All 11 create_* sections with builder_* test cases added
  - Each builder test case has proper placeholders like `<YOUR_BUILDER_TEST_*_NAME>`

### ✅ Implementation Complete!

All Builder tests are now separated from create.test.ts tests. Running `npm test -- unit/class` (or any other unit test) will no longer cause conflicts between create.test.ts and Builder tests, because they use different test case configurations.

## Builder Test Case Templates

### DataElement
```yaml
    - name: "builder_data_element"
      enabled: false
      description: "Create data element using DataElementBuilder (separate from create.test.ts)"
      params:
        data_element_name: "<YOUR_BUILDER_TEST_DATA_ELEMENT_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_data_element (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test data element for DataElementBuilder tests"
        domain_name: "<YOUR_TEST_DOMAIN_NAME>"
        short_label: "Test"
        medium_label: "Test DE"
        long_label: "Test Data Element"
        heading_label: "Test Data Element"
```

### Interface
```yaml
    - name: "builder_interface"
      enabled: false
      description: "Create interface using InterfaceBuilder (separate from create.test.ts)"
      params:
        interface_name: "<YOUR_BUILDER_TEST_INTERFACE_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from basic_interface (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test interface for InterfaceBuilder tests"
        source_code: |
          INTERFACE <YOUR_BUILDER_TEST_INTERFACE_NAME>
            PUBLIC .
            METHODS: test_method.
          ENDINTERFACE.
```

### Program
```yaml
    - name: "builder_program"
      enabled: false
      description: "Create program using ProgramBuilder (separate from create.test.ts)"
      params:
        program_name: "<YOUR_BUILDER_TEST_PROGRAM_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_program (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test program for ProgramBuilder tests"
        program_type: "executable"
        source_code: |
          REPORT <YOUR_BUILDER_TEST_PROGRAM_NAME>.
          WRITE: / 'Builder test program'.
```

### Table
```yaml
    - name: "builder_table"
      enabled: false
      description: "Create table using TableBuilder (separate from create.test.ts)"
      params:
        table_name: "<YOUR_BUILDER_TEST_TABLE_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_table (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test table for TableBuilder tests"
        delivery_class: "A"
        data_class: "APPL0"
```

### Structure
```yaml
    - name: "builder_structure"
      enabled: false
      description: "Create structure using StructureBuilder (separate from create.test.ts)"
      params:
        structure_name: "<YOUR_BUILDER_TEST_STRUCTURE_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_structure (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test structure for StructureBuilder tests"
```

### View
```yaml
    - name: "builder_view"
      enabled: false
      description: "Create view using ViewBuilder (separate from create.test.ts)"
      params:
        view_name: "<YOUR_BUILDER_TEST_VIEW_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_view (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        # transport_request: if not specified, uses environment.default_transport
        description: "Test view for ViewBuilder tests"
        view_type: "database_view"
```

### Package
```yaml
    - name: "builder_package"
      enabled: false
      description: "Create package using PackageBuilder (separate from create.test.ts)"
      params:
        package_name: "<YOUR_BUILDER_NEW_PACKAGE_NAME>"  # ⚠️ UPDATE: Must be DIFFERENT from test_package (Z_ or Y_ prefix)
        super_package: "<YOUR_PARENT_PACKAGE>"
        description: "Test package for PackageBuilder tests"
        package_type: "development"
```

### Function Group
```yaml
    - name: "builder_function_group"
      enabled: false
      description: "Create function group using FunctionGroupBuilder (separate from create.test.ts)"
      params:
        function_group_name: "<YOUR_BUILDER_TEST_FUNCTION_GROUP>"  # ⚠️ UPDATE: Must be DIFFERENT from test_function_group (Z_ or Y_ prefix)
        # package_name: if not specified, uses environment.default_package
        description: "Test function group for FunctionGroupBuilder tests"
```

### Function Module
```yaml
    - name: "builder_function_module"
      enabled: false
      description: "Create function module using FunctionModuleBuilder (separate from create.test.ts)"
      params:
        function_name: "<YOUR_BUILDER_TEST_FUNCTION_MODULE>"  # ⚠️ UPDATE: Must be DIFFERENT from test_function_module (Z_ or Y_ prefix)
        function_group: "<YOUR_TEST_FUNCTION_GROUP>"
        description: "Test function module for FunctionModuleBuilder tests"
```

## Important
After adding all builder test cases to the template and updating all Builder tests, running `npm test -- unit/class` will no longer conflict between create.test.ts and ClassBuilder.test.ts, because they will use different objects:
- create.test.ts → `basic_class` 
- ClassBuilder.test.ts → `builder_class`
