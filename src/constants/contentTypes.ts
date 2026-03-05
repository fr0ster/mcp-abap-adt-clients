/**
 * Centralized ADT content type constants
 *
 * Convention:
 * - ACCEPT_* — Accept headers (may include version fallback via commas)
 * - CT_*     — Content-Type headers (single specific version)
 */

// =============================================================================
// Cross-cutting (shared across object types)
// =============================================================================

// Source code
export const ACCEPT_SOURCE = 'text/plain';
export const CT_SOURCE = 'text/plain; charset=utf-8';

// Lock
export const ACCEPT_LOCK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';

// Check
export const ACCEPT_CHECK_MESSAGES =
  'application/vnd.sap.adt.checkmessages+xml';
export const CT_CHECK_OBJECTS = 'application/vnd.sap.adt.checkobjects+xml';

// Deletion
export const ACCEPT_DELETION_CHECK =
  'application/vnd.sap.adt.deletion.check.response.v1+xml';
export const CT_DELETION_CHECK =
  'application/vnd.sap.adt.deletion.check.request.v1+xml';
export const ACCEPT_DELETION =
  'application/vnd.sap.adt.deletion.response.v1+xml';
export const CT_DELETION = 'application/vnd.sap.adt.deletion.request.v1+xml';

// Activation
export const ACCEPT_ACTIVATION = 'application/xml';
export const CT_ACTIVATION = 'application/vnd.sap.adt.activation+xml';

// Validation
export const ACCEPT_VALIDATION = 'application/vnd.sap.as+xml';

// Transport
export const ACCEPT_TRANSPORT =
  'application/vnd.sap.adt.transportorganizer.v1+xml';
export const ACCEPT_TRANSPORT_CHECK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData';
export const CT_TRANSPORT_CHECK =
  'application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData';

// Unit Test
export const CT_UNIT_TEST_RUN =
  'application/vnd.sap.adt.api.abapunit.run.v2+xml';
export const ACCEPT_UNIT_TEST_STATUS =
  'application/vnd.sap.adt.api.abapunit.run-status.v1+xml';
export const ACCEPT_UNIT_TEST_RESULT =
  'application/vnd.sap.adt.api.abapunit.run-result.v1+xml';
export const ACCEPT_JUNIT_RESULT =
  'application/vnd.sap.adt.api.junit.run-result.v1+xml';

// Discovery
export const ACCEPT_DISCOVERY = 'application/atomsvc+xml';

// Repository
export const ACCEPT_NODE_STRUCTURE =
  'application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml';

// Virtual Folders
export const ACCEPT_VIRTUAL_FOLDERS =
  'application/vnd.sap.adt.repository.virtualfolders.result.v1+xml';
export const CT_VIRTUAL_FOLDERS =
  'application/vnd.sap.adt.repository.virtualfolders.request.v1+xml';

// Where-Used
export const ACCEPT_WHERE_USED_RESULT =
  'application/vnd.sap.adt.repository.usagereferences.result.v1+xml';
export const CT_WHERE_USED_REQUEST =
  'application/vnd.sap.adt.repository.usagereferences.request.v1+xml';
export const ACCEPT_WHERE_USED_SCOPE =
  'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml';
export const CT_WHERE_USED_SCOPE =
  'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml';

// Data Preview
export const ACCEPT_DATA_PREVIEW =
  'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml';

// =============================================================================
// Per-object-type (metadata read/create)
// =============================================================================

// Classes
export const ACCEPT_CLASS =
  'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes.v1+xml';
export const CT_CLASS = 'application/vnd.sap.adt.oo.classes.v4+xml';

// Interfaces
export const ACCEPT_INTERFACE =
  'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces.v4+xml, application/vnd.sap.adt.oo.interfaces.v3+xml, application/vnd.sap.adt.oo.interfaces.v2+xml, application/vnd.sap.adt.oo.interfaces+xml';
export const CT_INTERFACE = 'application/vnd.sap.adt.oo.interfaces.v5+xml';

// Programs
export const ACCEPT_PROGRAM =
  'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs.v1+xml';
export const CT_PROGRAM = 'application/vnd.sap.adt.programs.programs.v2+xml';

// Function Groups
export const ACCEPT_FUNCTION_GROUP =
  'application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml';
export const CT_FUNCTION_GROUP =
  'application/vnd.sap.adt.functions.groups.v3+xml';

// Function Modules
export const ACCEPT_FUNCTION_MODULE =
  'application/vnd.sap.adt.functions.fmodules+xml, application/vnd.sap.adt.functions.fmodules.v2+xml, application/vnd.sap.adt.functions.fmodules.v3+xml';
export const CT_FUNCTION_MODULE =
  'application/vnd.sap.adt.functions.fmodules+xml';

// Tables
export const ACCEPT_TABLE =
  'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml';
export const CT_TABLE = 'application/vnd.sap.adt.tables.v2+xml';

// Table Types
export const ACCEPT_TABLE_TYPE =
  'application/vnd.sap.adt.tabletypes.v2+xml, application/vnd.sap.adt.tabletypes.v1+xml, application/vnd.sap.adt.blues.v1+xml';
export const CT_TABLE_TYPE = 'application/vnd.sap.adt.tabletype.v1+xml';

// Domains
export const ACCEPT_DOMAIN =
  'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml';
export const CT_DOMAIN = 'application/vnd.sap.adt.domains.v2+xml';

// Data Elements
export const ACCEPT_DATA_ELEMENT =
  'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml';
export const CT_DATA_ELEMENT = 'application/vnd.sap.adt.dataelements.v2+xml';

// Structures
export const ACCEPT_STRUCTURE =
  'application/vnd.sap.adt.structures.v2+xml, application/vnd.sap.adt.structures.v1+xml';
export const CT_STRUCTURE = 'application/vnd.sap.adt.structures.v2+xml';

// Views (CDS DDLS)
export const ACCEPT_VIEW =
  'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml';
export const ACCEPT_VIEW_METADATA = 'application/vnd.sap.adt.ddlSource+xml';
export const CT_VIEW = 'application/vnd.sap.adt.ddlSource+xml';

// Packages
export const ACCEPT_PACKAGE =
  'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml';
export const CT_PACKAGE = 'application/vnd.sap.adt.packages.v2+xml';

// Behavior Definitions
export const CT_BEHAVIOR_DEFINITION = 'application/vnd.sap.adt.blues.v1+xml';

// Service Definitions
export const CT_SERVICE_DEFINITION = 'application/vnd.sap.adt.ddic.srvd.v1+xml';

// Metadata Extensions
export const CT_METADATA_EXTENSION = 'application/vnd.sap.adt.ddic.ddlx.v1+xml';

// Access Controls
export const CT_ACCESS_CONTROL = 'application/vnd.sap.adt.dclSource+xml';

// Enhancements
export const ACCEPT_ENHANCEMENT =
  'application/vnd.sap.adt.enhancements.v1+xml, application/xml';
export const CT_ENHANCEMENT = 'application/vnd.sap.adt.enhancements.v1+xml';

// =============================================================================
// Validation (per-object-type)
// =============================================================================

export const ACCEPT_VALIDATION_CLASS_NAME =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check';

// System Information
export const ACCEPT_SYSTEM_INFO = 'application/json';
