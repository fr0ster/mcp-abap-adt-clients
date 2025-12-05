# Parameters Usage Analysis in adt-clients

## Current State

### 1. Create Functions

#### Using Structures (Params):
- ✅ **Class**: `CreateClassParams` (snake_case)
- ✅ **Program**: `CreateProgramParams` (camelCase)
- ✅ **DataElement**: `CreateDataElementParams` (snake_case)
- ✅ **Domain**: `CreateDomainParams` (snake_case)
- ✅ **ServiceDefinition**: `CreateServiceDefinitionParams` (snake_case)
- ✅ **BehaviorDefinition**: `BehaviorDefinitionCreateParams` (camelCase)
- ✅ **FunctionModule**: `CreateFunctionModuleParams` (camelCase) - recently added
- ✅ **Structure**: `CreateStructureParams` (camelCase) - recently updated
- ✅ **Interface**: `CreateInterfaceParams` (camelCase) - recently updated
- ✅ **FunctionGroup**: `CreateFunctionGroupParams` (camelCase) - recently updated

#### Using Individual Parameters:
- ❌ None - all create functions now use structures

### 2. Update Functions

#### Using Structures (Params):
- ✅ **Table**: `UpdateTableParams` (snake_case)
- ✅ **Structure**: `UpdateStructureParams` (camelCase) - recently updated
- ✅ **View**: `UpdateViewSourceParams` (camelCase)
- ✅ **Interface**: `UpdateInterfaceSourceParams` (camelCase)
- ✅ **Program**: `UpdateProgramSourceParams` (camelCase)
- ✅ **Domain**: `UpdateDomainParams` (snake_case)
- ✅ **DataElement**: `UpdateDataElementParams` (snake_case)
- ✅ **ServiceDefinition**: `UpdateServiceDefinitionParams` (snake_case)
- ✅ **FunctionGroup**: `UpdateFunctionGroupParams` (snake_case)
- ✅ **FunctionModule**: `UpdateFunctionModuleParams` (camelCase) - recently added
- ✅ **BehaviorDefinition**: `UpdateBehaviorDefinitionParams` (camelCase) - recently added

#### Using Individual Parameters:
- ❌ None - all update functions now use structures

### 3. BuilderConfig Interfaces

All Builder classes have their `*BuilderConfig` interfaces (camelCase):
- `FunctionModuleBuilderConfig`
- `ClassBuilderConfig`
- `ProgramBuilderConfig`
- `TableBuilderConfig`
- `StructureBuilderConfig`
- `ViewBuilderConfig`
- `InterfaceBuilderConfig`
- `DomainBuilderConfig`
- `DataElementBuilderConfig`
- `ServiceDefinitionBuilderConfig`
- `BehaviorDefinitionBuilderConfig`
- `FunctionGroupBuilderConfig`
- etc.

## Issues and Inconsistencies

### 1. Naming Convention Inconsistency
- Some Params use **snake_case** (Domain, DataElement, Table, FunctionGroup)
- Some Params use **camelCase** (Program, FunctionModule, View, Interface, ServiceDefinition, Structure, BehaviorDefinition)
- BuilderConfig always uses **camelCase** (correct)

**Note**: The recommended approach is to use **camelCase** for all Params to match BuilderConfig convention.

### 2. Consistency Between Params and BuilderConfig
- Params - for low-level functions
- BuilderConfig - for Builder classes
- All Builders now pass structures to low-level functions (✅ fixed)

## Advantages of Using Structures (Params)

### ✅ Advantages:

1. **Scalability**
   - Easy to add new parameters without changing function signature
   - No need to update all call sites when adding an optional parameter

2. **Readability**
   ```typescript
   // Structure - clear what is being passed
   create(connection, {
     functionGroupName: 'Z_MY_GROUP',
     functionModuleName: 'Z_MY_FM',
     description: 'My FM',
     transportRequest: 'E19K905635'
   })
   
   // vs individual parameters - hard to remember order
   create(connection, 'Z_MY_GROUP', 'Z_MY_FM', 'My FM', 'E19K905635')
   ```

3. **Flexibility**
   - Optional parameters don't require passing `undefined`
   - Can pass only needed fields
   ```typescript
   create(connection, {
     functionGroupName: 'Z_MY_GROUP',
     functionModuleName: 'Z_MY_FM',
     description: 'My FM'
     // transportRequest not passed - this is OK
   })
   ```

4. **Type Safety**
   - TypeScript can validate field types
   - Better IDE autocomplete support
   - Can use `Partial<>` for optional parameters

5. **Consistency**
   - Same approach for all functions
   - Easier to maintain and extend

6. **Backward Compatibility**
   - Adding a new optional field doesn't break existing call sites

### ❌ Disadvantages:

1. **More Code**
   - Need to create interface
   - Need to create object before calling

2. **Simplicity for Simple Cases**
   - For functions with 2-3 parameters, structure might be overkill
   ```typescript
   // Simpler
   unlock(connection, lockHandle)
   
   // vs
   unlock(connection, { lockHandle })
   ```

3. **Performance (minimal impact)**
   - Object creation adds overhead (but minimal)

## Recommendations

### 1. Unify Approach
**All low-level functions should use structures (Params)**

### 2. Naming Convention
**All Params should use camelCase** (like BuilderConfig), not snake_case

### 3. Params Structure
```typescript
// Correct example
export interface CreateFunctionModuleParams {
  functionGroupName: string;
  functionModuleName: string;
  description: string;
  transportRequest?: string;
}

export interface UpdateFunctionModuleParams {
  functionGroupName: string;
  functionModuleName: string;
  lockHandle: string;
  sourceCode: string;
  transportRequest?: string;
}
```

### 4. Consistency Between Create/Update/Delete
If there is `CreateXParams`, there should be:
- `UpdateXParams` (if update is supported)
- `DeleteXParams` (if delete is supported)

### 5. Usage in Builder
Builder should pass structure to low-level function:
```typescript
// In Builder
async create(): Promise<this> {
  const params: CreateFunctionModuleParams = {
    functionGroupName: this.config.functionGroupName,
    functionModuleName: this.config.functionModuleName,
    description: this.config.description || '',
    transportRequest: this.config.transportRequest
  };
  const result = await create(this.connection, params);
  // ...
}
```

## Migration Status

### ✅ Priority 1: Unify Create Functions - COMPLETED
1. ✅ FunctionModule - done
2. ✅ Structure - added `CreateStructureParams`, updated `create()`
3. ✅ Interface - added `CreateInterfaceParams`, updated `create()`
4. ✅ FunctionGroup - added `CreateFunctionGroupParams`, updated `create()`

### ✅ Priority 2: Unify Update Functions - COMPLETED
1. ✅ FunctionModule - added `UpdateFunctionModuleParams`
2. ✅ BehaviorDefinition - added `UpdateBehaviorDefinitionParams`
3. ✅ Structure - updated `upload()` to use `UpdateStructureParams`

### ⏳ Priority 3: Unify Naming Convention - PENDING
1. ⏳ Convert all snake_case Params to camelCase
2. ⏳ Update all call sites

**Note**: This is a breaking change and should be done carefully with proper versioning.

## Conclusion

**Structures (Params) are the better approach** for low-level functions due to:
- Scalability
- Readability
- Flexibility
- Type Safety
- Consistency

All create and update functions have been unified to use structures. The remaining task is to standardize naming convention to camelCase across all Params interfaces.
