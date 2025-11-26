## Roadmap

### RAP Builder & CDS End-to-End Tests

#### ✅ Completed
- **All RAP builders implemented:**
  - `TableBuilder` – DDIC tables creation and management
  - `ViewBuilder` – CDS views (interface views, projections) with full CRUD support
  - `BehaviorDefinitionBuilder` – BDEF metadata
  - `BehaviorImplementationBuilder` – behavior implementation classes
  - `ServiceDefinitionBuilder` – service definitions
  - `MetadataExtensionBuilder` – metadata extensions
  - `UnitTestBuilder` – ABAP Unit tests (supports CDS unit tests via ClassBuilder inheritance)
- **CDS View Creation** – fully implemented:
  - Complete CRUD operations: create, read, update, delete, lock, unlock, activate, check, validate
  - Support for all CDS view types: interface views, projection views, consumption views
  - DDL source code management
  - Integration with `CrudClient` for simplified API
  - Comprehensive integration tests in `ViewBuilder.test.ts`
- **CDS Unit Tests** – fully implemented and tested:
  - CDS unit test class generation and execution via `UnitTestBuilder` with `objectType='cds'`
  - Integration test in `ViewBuilder.test.ts` covering: create CDS view → generate unit test class → run ABAP Unit → get status → get results
  - Support for CDS unit test templates and test class source code generation
- **Group activation** – available via `SharedBuilder.groupActivation()` for activating multiple objects together
- **Individual integration tests** – each builder has comprehensive integration tests

#### 🔄 Remaining Work
- **RAP end-to-end orchestration tests:**
  - Scaffold dedicated RAP integration test suite covering full data model creation workflow
  - Orchestrate complete RAP scenarios: table → interface view → projection → BDEF → behavior implementation → service definition → service binding
  - Test group activation of related RAP objects
  - Provide dedicated RAP integration suite separate from existing builder tests
- **Service binding support:**
  - Service binding helpers (if ADT API supports it)

