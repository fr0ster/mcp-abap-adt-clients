# Test Object Naming Guidelines

## Overview

Test objects (classes, domains, function modules, etc.) must have **unique names** in `test-config.yaml` to avoid conflicts when tests run in parallel or sequentially.

## Naming Rules

### 1. Unique Names in YAML

Each test case in `test-config.yaml` must use **unique names** for objects. Names are used directly from YAML without any automatic suffix generation:

```yaml
create_class:
  test_cases:
    - name: "basic_class"
      params:
        class_name: "ZCL_TEST_BASIC_CREATE"  # Must be unique across all tests
        # ...

check_class:
  test_cases:
    - name: "test_class"
      params:
        class_name: "ZCL_TEST_BASIC_CHECK"  # Must be unique across all tests
        # ...

read_class:
  test_cases:
    - name: "test_class"
      params:
        class_name: "ZCL_TEST_BASIC_READ"  # Must be unique across all tests
        # ...
```

**Important**: 
- Names are used **exactly as specified** in YAML
- Each test must use a **different name** to avoid conflicts
- Names must follow ABAP naming conventions (max 30 characters, Z_ or Y_ prefix for user objects)

### 2. Inheritance (Superclass)

For classes with inheritance, ensure superclass name matches between `superclass` parameter and `source_code`:

```yaml
create_class:
  test_cases:
    - name: "basic_class"
      params:
        class_name: "ZCL_TEST_BASE_CREATE"  # Base class - must be unique
        # ...
    - name: "class_with_superclass"
      params:
        class_name: "ZCL_TEST_INHERIT_CREATE"  # Subclass - must be unique
        superclass: "ZCL_TEST_BASE_CREATE"  # References base class
        source_code: |
          CLASS ZCL_TEST_INHERIT_CREATE DEFINITION
            INHERITING FROM ZCL_TEST_BASE_CREATE
            # ...
```

**Important**: 
- The superclass name in `source_code` (e.g., `INHERITING FROM ZCL_TEST_BASE_CREATE`) must match the `superclass` parameter exactly
- If `superclass` is not specified in params, it will be extracted from `source_code` automatically
- Base class must be created before subclass (tests handle this automatically)

## Best Practices

1. **Use descriptive suffixes** in names to indicate test purpose:
   - `ZCL_TEST_BASIC_CREATE` - for create tests
   - `ZCL_TEST_BASIC_CHECK` - for check tests
   - `ZCL_TEST_BASIC_READ` - for read tests
   - `ZCL_TEST_BASIC_UPDATE` - for update tests
   - `ZCL_TEST_BASIC_DELETE` - for delete tests

2. **Keep names within ABAP limits** (max 30 characters):
   - ✅ `ZCL_TEST_BASIC_CREATE` (21 chars) - OK
   - ❌ `ZCL_VERY_LONG_TEST_CLASS_NAME_123` (32 chars) - exceeds limit

3. **Ensure source code matches**:
   - Class name in `source_code` must match `class_name` parameter exactly
   - Superclass name in `source_code` (if present) must match `superclass` parameter exactly

4. **Test isolation**:
   - Each test file should use different names
   - Tests in the same file should use different names for different operations
   - Tests automatically delete objects before creation to ensure clean state

## Examples

### Example 1: Simple Class Creation

```yaml
create_class:
  test_cases:
    - name: "basic_class"
      params:
        class_name: "ZCL_TEST_SIMPLE"
        source_code: |
          CLASS ZCL_TEST_SIMPLE DEFINITION
            PUBLIC
            CREATE PUBLIC .
          ENDCLASS.
```

### Example 2: Class with Inheritance

```yaml
create_class:
  test_cases:
    - name: "base_class"
      params:
        class_name: "ZCL_TEST_BASE"
        source_code: |
          CLASS ZCL_TEST_BASE DEFINITION
            PUBLIC
            CREATE PUBLIC .
          ENDCLASS.
    
    - name: "inherited_class"
      params:
        class_name: "ZCL_TEST_INHERIT"
        superclass: "ZCL_TEST_BASE"
        source_code: |
          CLASS ZCL_TEST_INHERIT DEFINITION
            PUBLIC
            INHERITING FROM ZCL_TEST_BASE
            CREATE PUBLIC .
          ENDCLASS.
```

**Note**: The superclass name in `source_code` (`INHERITING FROM ZCL_TEST_BASE`) must match the `superclass` parameter.

## Troubleshooting

### Error: "Class name exceeds 30 characters"

**Solution**: Shorten the name in YAML. ABAP class names are limited to 30 characters.

### Error: "Class/Interface does not exist" (for superclass)

**Possible causes**:
1. Superclass not created before subclass
2. Superclass name mismatch between `superclass` parameter and `source_code`
3. Superclass not activated

**Solution**: 
- Ensure superclass is created and activated before creating subclass
- Check that `superclass` parameter matches the name in `source_code` (e.g., `INHERITING FROM <name>`)
- Tests automatically create base class before subclass if they match

### Error: "Class already exists"

**Possible causes**:
1. Previous test run didn't clean up
2. Another test is using the same name

**Solution**: 
- Tests automatically delete objects before creation
- Ensure names are unique across all test files in `test-config.yaml`
- If error persists, manually delete the class in SAP system

