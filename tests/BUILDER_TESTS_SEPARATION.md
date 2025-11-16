# Builder Tests Separation - Implementation Guide

## Проблема
Builder тести (ClassBuilder.test.ts, DomainBuilder.test.ts, та ін.) конкурують з create.test.ts за ті самі об'єкти в YAML конфігурації, що викликає конфлікти (403 помилки) коли тести запускаються разом.

## Рішення
Для кожного типу об'єкта створити окремий test case з ім'ям `builder_*` в test-config.yaml.template

## Статус виконання

### ✅ Виконано:
- **class**: додано `builder_class` в template, ClassBuilder.test.ts оновлено
- **domain**: додано `builder_domain` в template

### ⏳ Треба виконати:

1. **Додати в test-config.yaml.template** builder test cases для:
   - dataElement
   - interface  
   - program
   - table
   - structure
   - view
   - package
   - functionGroup
   - functionModule

2. **Оновити Builder тести** щоб використовували `builder_*` замість основних test cases:
   ```bash
   cd /home/okyslytsia/prj/mcp-abap-adt/packages/adt-clients/src/__tests__/unit
   
   # DataElement
   sed -i "s/'test_data_element'/'builder_data_element'/g" dataElement/DataElementBuilder.test.ts
   
   # Domain (вже зроблено для class)
   sed -i "s/'test_domain'/'builder_domain'/g" domain/DomainBuilder.test.ts
   
   # Interface
   sed -i "s/'basic_interface'/'builder_interface'/g" interface/InterfaceBuilder.test.ts
   
   # Program
   sed -i "s/'test_program'/'builder_program'/g" program/ProgramBuilder.test.ts
   
   # Table
   sed -i "s/'test_table'/'builder_table'/g" table/TableBuilder.test.ts
   
   # Structure
   sed -i "s/'test_structure'/'builder_structure'/g" structure/StructureBuilder.test.ts
   
   # View
   sed -i "s/'test_view'/'builder_view'/g" view/ViewBuilder.test.ts
   
   # Package
   sed -i "s/'test_package'/'builder_package'/g" package/PackageBuilder.test.ts
   
   # Function Group
   sed -i "s/'test_function_group'/'builder_function_group'/g" functionGroup/FunctionGroupBuilder.test.ts
   
   # Function Module
   sed -i "s/'test_function_module'/'builder_function_module'/g" functionModule/FunctionModuleBuilder.test.ts
   ```

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

## Важливо
Після додавання всіх builder test cases в template і оновлення всіх Builder тестів, при запуску `npm test -- unit/class` не буде конфлікту між create.test.ts та ClassBuilder.test.ts, оскільки вони використовуватимуть різні об'єкти:
- create.test.ts → `basic_class` 
- ClassBuilder.test.ts → `builder_class`
