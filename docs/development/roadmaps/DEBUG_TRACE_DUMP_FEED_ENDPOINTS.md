# Endpoints for Debugging, Tracing, Dump Analysis, and Feed Reader Modules

## Analysis Date
2025-01-27

## Purpose
Identify ADT endpoints from `discovery.md` that can be used to implement modules for:
1. **Debugging** - AMDP debugging, runtime debugging
2. **Tracing** - Performance tracing, ABAP profiler, cross-trace
3. **Dump Analysis** - Memory snapshots, application logs, ATC logs
4. **Feed Reader** - Feed repository access

---

## 1. Debugging Module

### 1.1 AMDP Debugger for ADT

**Base URL:** `/sap/bc/adt/amdp/debugger/main`

**Operations:**

#### Debugger Session Management
- **Start Debugger**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/start`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main{?stopExisting,requestUser,cascadeMode}`
  - Purpose: Start a new AMDP debugger session

- **Resume Debugger**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/resume`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}`
  - Purpose: Resume a paused debugger session

- **Terminate Debugger**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/terminate`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}{?hardStop}`
  - Purpose: Stop debugger session

#### Debuggee Operations
- **Get Debuggee**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/debuggee`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}`
  - Purpose: Get debuggee information

#### Variable Operations
- **Get Variables**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/vars`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}{?offset,length}`
  - Purpose: Read variable values

- **Set Variables**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/setvars`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}{?setNull}`
  - Purpose: Modify variable values

- **Lookup**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/lookup`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/lookup{?name}`
  - Purpose: Lookup objects/variables

#### Step Operations
- **Step Over**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/step/over`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=over`
  - Purpose: Execute step over

- **Step Continue**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/step/continue`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=continue`
  - Purpose: Continue execution

#### Breakpoint Operations
- **Get Breakpoints**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/breakpoints`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`
  - Purpose: List all breakpoints

- **Breakpoints for LLang**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/breakpoints/llang`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`
  - Purpose: LLang-specific breakpoints

- **Breakpoints for Table Functions**
  - Relation: `http://www.sap.com/adt/amdp/debugger/relations/breakpoints/tablefunctions`
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`
  - Purpose: Table function breakpoints

### 1.2 Data Preview for AMDP Debugger

**Base URL:** `/sap/bc/adt/datapreview/amdpdebugger`

**Operations:**

- **AMDP Debugger Data Preview**
  - Relation: `http://www.sap.com/adt/categories/datapreview/amdpdebugger`
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdpdebugger{?rowNumber,colNumber,sessionId,debuggerId,debuggeeId,variableName,schema,provideRowId,action}`
  - Purpose: Preview data during AMDP debugging

- **Cell Substring**
  - Relation: `http://www.sap.com/adt/categories/datapreview/amdpdebugger/cellsubstring`
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring{?rowNumber,columnName,sessionId,debuggerId,debuggeeId,variableName,valueOffset,valueLength,schema,action}`
  - Purpose: Get substring of cell value

### 1.3 ABAP Debugger (Standard - for Classes, Programs, Function Modules)

**Base URL:** `/sap/bc/adt/debugger`

**Purpose:** Standard ABAP debugger for debugging classes, programs, function modules, and other ABAP objects

**Operations:**

#### Debugger Session Management
- **Launch Debugger**
  - Relation: `http://www.sap.com/adt/debugger/relations/launch`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,timeout,checkConflict,isNotifiedOnConflict}`
  - Purpose: Launch debugger session for ABAP objects

- **Stop Debugger**
  - Relation: `http://www.sap.com/adt/debugger/relations/stop`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict,notifyConflict}`
  - Purpose: Stop active debugger session

- **Get Debugger**
  - Relation: `http://www.sap.com/adt/debugger/relations/get`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict}`
  - Purpose: Get current debugger session information

#### Memory Operations
- **Get Memory Sizes**
  - Relation: `http://www.sap.com/adt/debugger/relations/memorysizes`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/memorysizes{?includeAbap}`
  - Purpose: Get memory size information

#### System Areas
- **Get System Area**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/systemareas/{systemarea}{?offset,length,element,isSelection,selectedLine,selectedColumn,programContext,filter}`
  - Purpose: Get system area content (source code, data, etc.)

#### Breakpoints
- **Synchronize Breakpoints**
  - Relation: `http://www.sap.com/adt/debugger/relations/synchronize`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/breakpoints{?checkConflict}`
  - Purpose: Synchronize breakpoints

- **Statements for Breakpoints**
  - URL: `/sap/bc/adt/debugger/breakpoints/statements`
  - Purpose: Get statements that can have breakpoints

- **Message Types for Breakpoints**
  - URL: `/sap/bc/adt/debugger/breakpoints/messagetypes`
  - Purpose: Get message types for breakpoints

- **Breakpoint Conditions**
  - URL: `/sap/bc/adt/debugger/breakpoints/conditions`
  - Purpose: Manage breakpoint conditions

- **Breakpoint Validation**
  - URL: `/sap/bc/adt/debugger/breakpoints/validations`
  - Purpose: Validate breakpoints

- **VIT Breakpoints**
  - URL: `/sap/bc/adt/debugger/breakpoints/vit`
  - Purpose: VIT (Variable Inspection Tool) breakpoints

#### Variables
- **Get Variable Max Length**
  - Relation: `http://www.sap.com/adt/debugger/relations/maxlength`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?maxLength}`
  - Purpose: Get maximum length for variable display

- **Get Variable Subcomponents**
  - Relation: `http://www.sap.com/adt/debugger/relations/subcomponents`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?component,line}`
  - Purpose: Get subcomponents of a variable

- **Get Variable as CSV**
  - Relation: `http://www.sap.com/adt/debugger/relations/csv`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?offset,length,filter,sortComponent,sortDirection,whereClause,c*}`
  - Purpose: Get variable value as CSV

- **Get Variable as JSON**
  - Relation: `http://www.sap.com/adt/debugger/relations/json`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?offset,length,filter,sortComponent,sortDirection,whereClause,c*}`
  - Purpose: Get variable value as JSON

- **Get Variable Value Statement**
  - Relation: `http://www.sap.com/adt/debugger/relations/valueStatement`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?rows,maxStringLength,maxNestingLevel,maxTotalSize,ignoreInitialValues,c*,lineBreakThreshold}`
  - Purpose: Get variable value as ABAP statement

#### Actions
- **Execute Debugger Action**
  - Relation: `http://www.sap.com/adt/debugger/relations/action`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/actions{?action,value}`
  - Purpose: Execute debugger actions (step over, step into, continue, etc.)

#### Stack
- **Get Call Stack**
  - URL: `/sap/bc/adt/debugger/stack`
  - Purpose: Get current call stack

#### Watchpoints
- **Insert Watchpoint**
  - Relation: `http://www.sap.com/adt/debugger/relations/insert`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/watchpoints{?variableName,condition}`
  - Purpose: Insert a watchpoint

- **Get Watchpoints**
  - Relation: `http://www.sap.com/adt/debugger/relations/get`
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/watchpoints`
  - Purpose: Get all watchpoints

#### Batch Operations
- **Debugger Batch Request**
  - URL: `/sap/bc/adt/debugger/batch`
  - Purpose: Execute multiple debugger operations in batch

### 1.4 ADT IDE Actions (Runtime)

**Base URL:** `/sap/bc/adt/ideactions/runtime`

**Purpose:** Runtime actions for IDE integration

---

## 2. Tracing Module

### 2.1 ABAP Profiler

**Base URLs:**
- `/sap/bc/adt/runtime/traces/abaptraces` - Trace files
- `/sap/bc/adt/runtime/traces/abaptraces/parameters` - Trace parameters
- `/sap/bc/adt/runtime/traces/abaptraces/requests` - Trace requests
- `/sap/bc/adt/runtime/traces/abaptraces/objecttypes` - Object types
- `/sap/bc/adt/runtime/traces/abaptraces/processtypes` - Process types

**Operations:**

#### Trace Files
- **List Trace Files**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces`
  - Purpose: Get list of available trace files

#### Trace Parameters
- **Get Trace Parameters**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/parameters`
  - Purpose: Get trace configuration parameters

- **Callstack Aggregation Parameters**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/parameters`
  - Purpose: Parameters for callstack aggregation

- **AMDP Trace Parameters**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/parameters`
  - Purpose: Parameters for AMDP tracing

#### Trace Requests
- **List Trace Requests**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/requests`
  - Purpose: Get trace request list

- **Trace Requests with URI**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/requests`
  - Purpose: Get trace requests filtered by URI

#### Metadata
- **Object Types**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`
  - Purpose: List available object types for tracing

- **Process Types**
  - URL: `/sap/bc/adt/runtime/traces/abaptraces/processtypes`
  - Purpose: List available process types

### 2.2 Performance Trace (ST05)

**Base URLs:**
- `/sap/bc/adt/st05/trace/state` - Trace state
- `/sap/bc/adt/st05/trace/directory` - Trace directory

**Operations:**

- **Get Trace State**
  - URL: `/sap/bc/adt/st05/trace/state`
  - Purpose: Get current performance trace state

- **Get Trace Directory**
  - URL: `/sap/bc/adt/st05/trace/directory`
  - Purpose: Get trace file directory information

### 2.3 ABAP Cross Trace

**Base URL:** `/sap/bc/adt/crosstrace/traces`

**Operations:**

- **List Traces**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces{?traceUser,actCreateUser,actChangeUser}`
  - Purpose: List cross traces with optional filters

- **Get Trace**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}`
  - Purpose: Get trace details

- **Get Trace (with sensitive data)**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}{?includeSensitiveData}`
  - Purpose: Get trace including sensitive data

- **Get Records**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}/records`
  - Purpose: Get trace records

- **Get Record Content**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}/records/{recordNumber}/content`
  - Purpose: Get content of specific record

**Base URL:** `/sap/bc/adt/crosstrace/activations`

**Operations:**

- **Get Activations**
  - Purpose: Get activation information for cross traces

---

## 3. Dump Analysis Module

### 3.1 Runtime Memory Analysis (Snapshots)

**Base URL:** `/sap/bc/adt/runtime/memory/snapshots`

**Operations:**

#### Snapshot Management
- **List Snapshots**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots{?user,originalUser}`
  - Purpose: List memory snapshots for user(s)

- **Get Snapshot**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}`
  - Purpose: Get specific snapshot details

#### Ranking Lists
- **Snapshot Ranking List**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/rankinglist{?maxNumberOfObjects,excludeAbapType*,sortAscending,sortByColumnName,groupByParentType}`
  - Purpose: Get ranked list of objects in snapshot

- **Delta Ranking List**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/rankinglist{?uri1,uri2,maxNumberOfObjects,excludeAbapType*,sortAscending,sortByColumnName,groupByParentType}`
  - Purpose: Compare two snapshots and get delta ranking

#### Children
- **Snapshot Children**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/children{?parentKey,maxNumberOfObjects,sortAscending,sortByColumnName}`
  - Purpose: Get child objects of a parent in snapshot

- **Delta Children**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/children{?uri1,uri2,parentKey,maxNumberOfObjects,sortAscending,sortByColumnName}`
  - Purpose: Get children delta between two snapshots

#### References
- **Snapshot References**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/references{?objectKey,maxNumberOfReferences}`
  - Purpose: Get references to an object in snapshot

- **Delta References**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/references{?uri1,uri2,objectKey,maxNumberOfReferences}`
  - Purpose: Get references delta between snapshots

#### Overview
- **Snapshot Overview**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/overview`
  - Purpose: Get overview of snapshot

- **Delta Overview**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/overview{?uri1,uri2}`
  - Purpose: Get overview of delta between snapshots

### 3.2 Application Log Objects

**Base URL:** `/sap/bc/adt/applicationlog/objects`

**Operations:**

- **Get Application Log Object Properties**
  - Relation: `http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties`
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationlog/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`
  - Purpose: Get application log object metadata

- **Get Application Log Object Source**
  - Relation: `http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source`
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationlog/objects/{object_name}/source/main{?corrNr,lockHandle,version}`
  - Purpose: Get application log object source code

- **Validation**
  - URL: `/sap/bc/adt/applicationlog/objects/validation`
  - Purpose: Validate application log object name

### 3.3 ATC Check Failures Logs

**Base URL:** `/sap/bc/adt/atc/checkfailures/logs`

**Operations:**

- **Get Check Failure Logs**
  - Relation: `http://www.sap.com/adt/atc/relations/checkfailures/logs`
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkfailures/logs{?displayId,objName,objType,moduleId,phaseKey}`
  - Purpose: Get detailed logs for ATC check failures

### 3.4 ATC Results Log

**Base URL:** `/sap/bc/adt/atc/results/{executionId}/log`

**Operations:**

- **Get Execution Log**
  - Relation: `http://www.sap.com/adt/atc/relations/results/log`
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results/{executionId}/log`
  - Purpose: Get execution log for ATC run

### 3.5 DDIC Activation Graph Logs

**Base URL:** `/sap/bc/adt/ddic/logs/activationgraph`

**Operations:**

- **Get Activation Graph**
  - Relation: `http://www.sap.com/adt/categories/ddic/logs/activation/graph`
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/logs/activationgraph{?objectName,objectType,logName}`
  - Purpose: Get activation dependency graph with logs

---

## 4. Feed Reader Module

### 4.1 Feed Repository

**Base URL:** `/sap/bc/adt/feeds`

**Operations:**

- **Get Feeds**
  - URL: `/sap/bc/adt/feeds`
  - Purpose: Access feed repository

### 4.2 Feed Variants

**Base URL:** `/sap/bc/adt/feeds/variants`

**Operations:**

- **Get Feed Variants**
  - URL: `/sap/bc/adt/feeds/variants`
  - Purpose: Get available feed variants

---

## Summary

### Debugging Module
- ✅ **AMDP Debugger** - Full debugging capabilities for AMDP (start, step, breakpoints, variables)
- ✅ **ABAP Debugger (Standard)** - Full debugging capabilities for classes, programs, function modules (launch, breakpoints, variables, stack, watchpoints)
- ✅ **Data Preview** - Data inspection during AMDP debugging
- ✅ **Runtime Actions** - IDE integration for runtime debugging

### Tracing Module
- ✅ **ABAP Profiler** - Comprehensive tracing (files, parameters, requests)
- ✅ **Performance Trace (ST05)** - Performance analysis
- ✅ **Cross Trace** - Cross-system tracing with records

### Dump Analysis Module
- ✅ **Memory Snapshots** - Full memory analysis with ranking, children, references
- ✅ **Application Logs** - Application log object access
- ✅ **ATC Logs** - Check failure and execution logs
- ✅ **Activation Graph Logs** - DDIC activation dependency logs

### Feed Reader Module
- ✅ **Feed Repository** - Access to feed repository
- ✅ **Feed Variants** - Feed variant management

---

## Implementation Recommendations

### Priority 1: High Value
1. **Memory Snapshots** - Critical for dump analysis
2. **ABAP Profiler Traces** - Essential for performance analysis
3. **ABAP Debugger (Standard)** - Core debugging for classes, programs, function modules
4. **AMDP Debugger** - Core debugging for AMDP procedures

### Priority 2: Medium Value
5. **Cross Trace** - Useful for distributed system analysis
6. **Application Logs** - Important for error analysis
7. **ATC Logs** - Helpful for code quality analysis

### Priority 3: Lower Priority
7. **Feed Reader** - Nice to have for feed consumption
8. **Performance Trace (ST05)** - Specialized use case
9. **Data Preview Debugger** - Extension of AMDP debugger

---

## Notes

- All endpoints use standard ADT authentication
- Most endpoints return XML format
- Some endpoints support filtering via query parameters
- Memory snapshots support delta comparison between two snapshots
- AMDP debugger requires active debugger session (mainId)
- Trace endpoints may require specific permissions

---

## Implementation Action Items

### Priority 1: High Value Modules

#### 1. Memory Snapshots Module
**Status:** ✅ **Completed**

**Tasks:**
- [x] Create `runtime/memory/snapshots.ts` with low-level functions:
  - [x] `listSnapshots(user?, originalUser?)` → GET `/sap/bc/adt/runtime/memory/snapshots`
  - [x] `getSnapshot(snapshotId)` → GET `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}`
  - [x] `getSnapshotRankingList(snapshotId, options?)` → GET `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/rankinglist`
  - [x] `getSnapshotDeltaRankingList(uri1, uri2, options?)` → GET `/sap/bc/adt/runtime/memory/snapdelta/rankinglist`
  - [x] `getSnapshotChildren(snapshotId, parentKey, options?)` → GET `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/children`
  - [x] `getSnapshotDeltaChildren(uri1, uri2, parentKey, options?)` → GET `/sap/bc/adt/runtime/memory/snapdelta/children`
  - [x] `getSnapshotReferences(snapshotId, objectKey, options?)` → GET `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/references`
  - [x] `getSnapshotDeltaReferences(uri1, uri2, objectKey, options?)` → GET `/sap/bc/adt/runtime/memory/snapdelta/references`
  - [x] `getSnapshotOverview(snapshotId)` → GET `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/overview`
  - [x] `getSnapshotDeltaOverview(uri1, uri2)` → GET `/sap/bc/adt/runtime/memory/snapdelta/overview`
- [x] Add to `AdtRuntime` → `getMemorySnapshot*()` methods (10 methods)
- [x] Create types for snapshot data structures (`ISnapshotRankingListOptions`, `ISnapshotChildrenOptions`, `ISnapshotReferencesOptions`)
- [ ] Add integration tests

#### 2. ABAP Profiler Traces Module
**Status:** ✅ **Completed**

**Tasks:**
- [x] Create `runtime/traces/profiler.ts` with low-level functions:
  - [x] `listTraceFiles()` → GET `/sap/bc/adt/runtime/traces/abaptraces`
  - [x] `getTraceParameters()` → GET `/sap/bc/adt/runtime/traces/abaptraces/parameters`
  - [x] `getTraceParametersForCallstack()` → GET `/sap/bc/adt/runtime/traces/abaptraces/parameters` (callstack aggregation)
  - [x] `getTraceParametersForAmdp()` → GET `/sap/bc/adt/runtime/traces/abaptraces/parameters` (AMDP trace)
  - [x] `listTraceRequests()` → GET `/sap/bc/adt/runtime/traces/abaptraces/requests`
  - [x] `getTraceRequestsByUri(uri)` → GET `/sap/bc/adt/runtime/traces/abaptraces/requests` (with URI filter)
  - [x] `listObjectTypes()` → GET `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`
  - [x] `listProcessTypes()` → GET `/sap/bc/adt/runtime/traces/abaptraces/processtypes`
- [x] Add to `AdtRuntime` → `getProfilerTrace*()` methods (8 methods)
- [x] Create types for trace data structures
- [ ] Add integration tests

#### 3. ABAP Debugger (Standard) Module
**Status:** ✅ **Completed**

**Tasks:**
- [x] Create `runtime/debugger/abap.ts` with low-level functions:
  - [x] `launchDebugger(options)` → GET `/sap/bc/adt/debugger/listeners` (launch relation)
  - [x] `stopDebugger(options)` → GET `/sap/bc/adt/debugger/listeners` (stop relation)
  - [x] `getDebugger(options)` → GET `/sap/bc/adt/debugger/listeners` (get relation)
  - [x] `getMemorySizes(includeAbap?)` → GET `/sap/bc/adt/debugger/memorysizes`
  - [x] `getSystemArea(systemarea, options?)` → GET `/sap/bc/adt/debugger/systemareas/{systemarea}`
  - [x] `synchronizeBreakpoints(checkConflict?)` → GET `/sap/bc/adt/debugger/breakpoints`
  - [x] `getBreakpointStatements()` → GET `/sap/bc/adt/debugger/breakpoints/statements`
  - [x] `getBreakpointMessageTypes()` → GET `/sap/bc/adt/debugger/breakpoints/messagetypes`
  - [x] `getBreakpointConditions()` → GET `/sap/bc/adt/debugger/breakpoints/conditions`
  - [x] `validateBreakpoints()` → GET `/sap/bc/adt/debugger/breakpoints/validations`
  - [x] `getVitBreakpoints()` → GET `/sap/bc/adt/debugger/breakpoints/vit`
  - [x] `getVariableMaxLength(variableName, part, maxLength?)` → GET `/sap/bc/adt/debugger/variables/{variableName}/{part}`
  - [x] `getVariableSubcomponents(variableName, part, component?, line?)` → GET `/sap/bc/adt/debugger/variables/{variableName}/{part}`
  - [x] `getVariableAsCsv(variableName, part, options?)` → GET `/sap/bc/adt/debugger/variables/{variableName}/{part}` (csv relation)
  - [x] `getVariableAsJson(variableName, part, options?)` → GET `/sap/bc/adt/debugger/variables/{variableName}/{part}` (json relation)
  - [x] `getVariableValueStatement(variableName, part, options?)` → GET `/sap/bc/adt/debugger/variables/{variableName}/{part}` (valueStatement relation)
  - [x] `executeDebuggerAction(action, value?)` → GET `/sap/bc/adt/debugger/actions`
  - [x] `getCallStack()` → GET `/sap/bc/adt/debugger/stack`
  - [x] `insertWatchpoint(variableName, condition?)` → GET `/sap/bc/adt/debugger/watchpoints` (insert relation)
  - [x] `getWatchpoints()` → GET `/sap/bc/adt/debugger/watchpoints` (get relation)
  - [x] `executeBatchRequest(requests)` → POST `/sap/bc/adt/debugger/batch`
- [x] Add to `AdtRuntime` → `getAbapDebugger*()` methods (20 methods)
- [x] Create types for debugger session, breakpoints, variables, stack
- [ ] Add integration tests

#### 4. AMDP Debugger Module
**Status:** ✅ **Completed**

**Tasks:**
- [x] Create `runtime/debugger/amdp.ts` with low-level functions:
  - [x] `startAmdpDebugger(options?)` → GET `/sap/bc/adt/amdp/debugger/main` (start relation)
  - [x] `resumeAmdpDebugger(mainId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}` (resume relation)
  - [x] `terminateAmdpDebugger(mainId, hardStop?)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}` (terminate relation)
  - [x] `getAmdpDebuggee(mainId, debuggeeId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}`
  - [x] `getAmdpVariable(mainId, debuggeeId, varname, offset?, length?)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}`
  - [x] `setAmdpVariable(mainId, debuggeeId, varname, setNull?)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}` (setvars relation)
  - [x] `lookupAmdp(mainId, debuggeeId, name)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/lookup`
  - [x] `stepOverAmdp(mainId, debuggeeId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=over`
  - [x] `stepContinueAmdp(mainId, debuggeeId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=continue`
  - [x] `getAmdpBreakpoints(mainId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`
  - [x] `getAmdpBreakpointsLlang(mainId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints` (llang relation)
  - [x] `getAmdpBreakpointsTableFunctions(mainId)` → GET `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints` (tablefunctions relation)
- [x] Create `runtime/debugger/amdpDataPreview.ts`:
  - [x] `getAmdpDataPreview(options)` → GET `/sap/bc/adt/datapreview/amdpdebugger`
  - [x] `getAmdpCellSubstring(options)` → GET `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring`
- [x] Add to `AdtRuntime` → `getAmdpDebugger*()` methods (15 methods)
- [x] Create types for debugger session and state
- [ ] Add integration tests

### Priority 2: Medium Value Modules

#### 5. Cross Trace Module
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `runtime/traces/crossTrace.ts` with low-level functions:
  - [ ] `listTraces(filters?)` → GET `/sap/bc/adt/crosstrace/traces`
  - [ ] `getTrace(traceId, includeSensitiveData?)` → GET `/sap/bc/adt/crosstrace/traces/{traceId}`
  - [ ] `getTraceRecords(traceId)` → GET `/sap/bc/adt/crosstrace/traces/{traceId}/records`
  - [ ] `getTraceRecordContent(traceId, recordNumber)` → GET `/sap/bc/adt/crosstrace/traces/{traceId}/records/{recordNumber}/content`
  - [ ] `getTraceActivations()` → GET `/sap/bc/adt/crosstrace/activations`
- [ ] Add to `AdtRuntime` → `getCrossTrace*()` methods
- [ ] Create types for cross trace data
- [ ] Add integration tests

#### 6. Application Logs Module
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `core/applicationLog/read.ts` with low-level functions:
  - [ ] `getApplicationLogObject(objectName, options?)` → GET `/sap/bc/adt/applicationlog/objects/{object_name}`
  - [ ] `getApplicationLogSource(objectName, options?)` → GET `/sap/bc/adt/applicationlog/objects/{object_name}/source/main`
  - [ ] `validateApplicationLogName(objectName)` → GET `/sap/bc/adt/applicationlog/objects/validation`
- [ ] Add to `AdtUtils` → `getApplicationLog*()` methods
- [ ] Create types for application log data
- [ ] Add integration tests

#### 7. ATC Logs Module
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `core/atc/logs.ts` with low-level functions:
  - [ ] `getCheckFailureLogs(filters?)` → GET `/sap/bc/adt/atc/checkfailures/logs`
  - [ ] `getExecutionLog(executionId)` → GET `/sap/bc/adt/atc/results/{executionId}/log`
- [ ] Add to `AdtUtils` → `getAtcLogs()` methods
- [ ] Create types for ATC log data
- [ ] Add integration tests

### Priority 3: Lower Priority Modules

#### 8. Feed Reader Module
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `core/feeds/read.ts` with low-level functions:
  - [ ] `getFeeds()` → GET `/sap/bc/adt/feeds`
  - [ ] `getFeedVariants()` → GET `/sap/bc/adt/feeds/variants`
- [ ] Add to `AdtUtils` → `getFeeds()` methods
- [ ] Create types for feed data
- [ ] Add integration tests

#### 9. Performance Trace (ST05) Module
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `runtime/traces/st05.ts` with low-level functions:
  - [ ] `getTraceState()` → GET `/sap/bc/adt/st05/trace/state`
  - [ ] `getTraceDirectory()` → GET `/sap/bc/adt/st05/trace/directory`
- [ ] Add to `AdtRuntime` → `getSt05Trace*()` methods
- [ ] Create types for ST05 trace data
- [ ] Add integration tests

#### 10. DDIC Activation Graph Logs
**Status:** ❌ Not Started

**Tasks:**
- [ ] Create `core/ddic/logs.ts` with low-level function:
  - [ ] `getActivationGraph(objectName, objectType, logName?)` → GET `/sap/bc/adt/ddic/logs/activationgraph`
- [ ] Add to `AdtUtils` → `getActivationGraph()` method
- [ ] Create types for activation graph data
- [ ] Add integration tests

---

## Implementation Status Summary

| Module | Priority | Status | Progress |
|--------|----------|--------|----------|
| Memory Snapshots | 1 | ✅ Completed | 90% (tests pending) |
| ABAP Profiler Traces | 1 | ✅ Completed | 90% (tests pending) |
| ABAP Debugger (Standard) | 1 | ✅ Completed | 90% (tests pending) |
| AMDP Debugger | 1 | ✅ Completed | 90% (tests pending) |
| Cross Trace | 2 | ❌ Not Started | 0% |
| Application Logs | 2 | ❌ Not Started | 0% |
| ATC Logs | 2 | ❌ Not Started | 0% |
| Feed Reader | 3 | ❌ Not Started | 0% |
| Performance Trace (ST05) | 3 | ❌ Not Started | 0% |
| DDIC Activation Graph | 3 | ❌ Not Started | 0% |

**Total Progress:** 4/10 modules (40% - Memory Snapshots, ABAP Profiler Traces, ABAP Debugger (Standard), and AMDP Debugger completed, tests pending)

