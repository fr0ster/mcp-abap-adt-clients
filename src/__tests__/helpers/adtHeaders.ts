/**
 * The `Accept` / `Content-Type` pair a test passes to a member that takes
 * `options.headers` (interfaces-adt 19.0.0, adt-clients 36.0.0).
 *
 * Since 36.0.0 those members send the caller's pair and choose none of their
 * own, so a test has to say what goes on the wire. These are the pairs the
 * implementations sent before 36.0.0 (recorded from 35.0.0 against a stub
 * connection), so a live run asks SAP exactly what it asked before. Where a
 * request carried only one of the two headers, or neither, the missing value
 * is completed here — marked below, and not measured against a system.
 *
 * Before 36.0.0 a few members read the client's `contentTypes` provider
 * (the legacy client sets `AdtContentTypesBase`); `headersOf` does the same,
 * so a legacy run keeps its v1 types and its non-Unicode `text/plain`.
 */

import type {
  EnhancementType,
  IAdtContentTypes,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import { ENHANCEMENT_CONTENT_TYPES } from '../../constants/contentTypes';

/** A pair for a unit test that only needs the call to compile and run. */
export const TEST_HEADERS: IAdtHeaders = {
  accept: 'application/x-test-accept',
  contentType: 'application/x-test-content-type',
};

/** Keyed `<implementing class>.<member>`. */
const SENT_BEFORE_36: Record<string, IAdtHeaders> = {
  'AbapDebugger.getChildVariables': {
    accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables',
    contentType:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables',
  },
  'AbapDebugger.getVariables': {
    accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables',
    contentType:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables',
  },
  'AbapDebugger.setBreakpoints': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AbapDebugger.setDebuggerSettings': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AbapDebugger.syncBreakpoints': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtAbapGitClient.checkExternalRepo': {
    accept: 'application/abapgit.adt.repo.info.ext.response.v2+xml',
    contentType: 'application/abapgit.adt.repo.info.ext.request.v2+xml',
  },
  'AdtAbapGitClient.link': {
    accept: 'application/abapgit.adt.repo.v3+xml',
    contentType: 'application/abapgit.adt.repo.v3+xml',
  },
  'AdtAbapGitClient.pull': {
    accept: 'application/abapgit.adt.repo.v3+xml',
    contentType: 'application/abapgit.adt.repo.v3+xml',
  },
  'AdtAccessControl.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtAccessControl.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtAccessControl.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtAccessControl.create': {
    accept: 'application/vnd.sap.adt.dclSource+xml',
    contentType: 'application/vnd.sap.adt.dclSource+xml',
  },
  'AdtAccessControl.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtAccessControl.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtAppendStructure.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtAppendStructure.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtAppendStructure.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtAppendStructure.create': {
    accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
    contentType: 'application/vnd.sap.adt.structures.v2+xml',
  },
  'AdtAppendStructure.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtAppendStructure.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtAuthorizationField.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtAuthorizationField.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtAuthorizationField.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtAuthorizationField.create': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtAuthorizationField.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtAuthorizationField.updateMetadata': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtBehaviorDefinition.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtBehaviorDefinition.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtBehaviorDefinition.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtBehaviorDefinition.create': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtBehaviorDefinition.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtBehaviorDefinition.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtBehaviorImplementation.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtBehaviorImplementation.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtBehaviorImplementation.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtBehaviorImplementation.create': {
    accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
    contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
  },
  'AdtBehaviorImplementation.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtBehaviorImplementation.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtClass.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtClass.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtClass.create': {
    accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
    contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
  },
  'AdtClass.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtClass.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtClassLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtClassLegacy.update': {
    accept: 'text/plain',
    contentType: 'text/plain',
  },
  'AdtClassMemberBase.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtDataElement.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtDataElement.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtDataElement.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtDataElement.create': {
    accept:
      'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    contentType: 'application/vnd.sap.adt.dataelements.v2+xml',
  },
  'AdtDataElement.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtDataElement.updateMetadata': {
    accept:
      'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    contentType: 'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
  },
  'AdtDdicTableType.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtDdicTableType.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtDdicTableType.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtDdicTableType.create': {
    accept: 'application/vnd.sap.adt.tabletype.v1+xml',
    contentType: 'application/vnd.sap.adt.tabletype.v1+xml',
  },
  'AdtDdicTableType.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtDdicTableType.updateMetadata': {
    accept: 'application/vnd.sap.adt.tabletype.v1+xml',
    contentType: 'application/vnd.sap.adt.tabletype.v1+xml',
  },
  'AdtDdl.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtDdl.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtDdl.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtDdl.create': {
    accept:
      'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml',
    contentType: 'application/vnd.sap.adt.ddlSource+xml',
  },
  'AdtDdl.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtDdl.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtDdlLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtDomain.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtDomain.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtDomain.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtDomain.create': {
    accept:
      'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml',
    contentType: 'application/vnd.sap.adt.domains.v2+xml',
  },
  'AdtDomain.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtDomain.updateMetadata': {
    accept:
      'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml',
    contentType: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
  },
  'AdtEnhancement.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtEnhancement.check': {
    accept: 'application/vnd.sap.adt.checkrun.v1+xml',
    contentType: 'application/vnd.sap.adt.checkrun.v1+xml',
  },
  'AdtEnhancement.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtEnhancement.create': {
    accept: 'application/vnd.sap.adt.enh.enhoxhh.v3+xml',
    contentType: 'application/vnd.sap.adt.enh.enhoxhh.v3+xml',
  },
  'AdtEnhancement.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtEnhancement.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtEnhancement.updateMetadata': {
    accept: 'application/vnd.sap.adt.enh.enhoxhh.v3+xml',
    contentType: 'application/vnd.sap.adt.enh.enhoxhh.v3+xml',
  },
  'AdtFeatureToggle.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtFeatureToggle.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtFeatureToggle.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtFeatureToggle.checkState': {
    accept: 'application/vnd.sap.adt.toggle.check.result.v1+asjson',
    contentType: 'application/vnd.sap.adt.toggle.check.parameters.v1+asjson',
  },
  'AdtFeatureToggle.create': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtFeatureToggle.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  // completed for 36.0.0: accept was not sent
  'AdtFeatureToggle.update': {
    accept: 'application/vnd.sap.adt.toggle.content.v2+json',
    contentType: 'application/vnd.sap.adt.toggle.content.v2+json',
  },
  'AdtFeatureToggle.updateMetadata': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtFunctionGroup.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtFunctionGroup.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtFunctionGroup.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  // completed for 36.0.0: accept was not sent
  'AdtFunctionGroup.create': {
    accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
    contentType: 'application/vnd.sap.adt.functions.groups.v3+xml',
  },
  'AdtFunctionGroup.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtFunctionGroup.updateMetadata': {
    accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
    contentType:
      'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtFunctionGroupLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtFunctionInclude.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtFunctionInclude.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtFunctionInclude.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtFunctionInclude.create': {
    accept:
      'application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml',
    contentType: 'application/vnd.sap.adt.functions.fincludes.v2+xml',
  },
  'AdtFunctionInclude.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtFunctionInclude.update': {
    accept: 'text/plain',
    contentType: 'text/plain',
  },
  'AdtFunctionInclude.updateMetadata': {
    accept:
      'application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml',
    contentType: 'application/vnd.sap.adt.functions.fincludes.v2+xml',
  },
  'AdtFunctionModule.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtFunctionModule.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtFunctionModule.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtFunctionModule.create': {
    accept: 'application/vnd.sap.adt.functions.fmodules+xml',
    contentType: 'application/vnd.sap.adt.functions.fmodules+xml',
  },
  'AdtFunctionModule.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtFunctionModule.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtFunctionModuleLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtInclude.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtInclude.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtInclude.create': {
    accept: 'application/vnd.sap.adt.programs.includes.v2+xml',
    contentType: 'application/vnd.sap.adt.programs.includes.v2+xml',
  },
  'AdtInclude.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtInclude.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtInterface.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtInterface.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtInterface.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtInterface.create': {
    accept: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
    contentType: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
  },
  'AdtInterface.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtInterface.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtInterfaceLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtLocalDefinitions.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtLocalDefinitions.delete': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalDefinitions.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalMacros.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtLocalMacros.delete': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalMacros.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalTestClass.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtLocalTestClass.delete': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalTestClass.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalTypes.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtLocalTypes.delete': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtLocalTypes.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtMessageClass.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  // completed for 36.0.0: accept was not sent
  'AdtMessageClass.create': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtMessageClass.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  // completed for 36.0.0: accept was not sent
  'AdtMessageClass.updateMetadata': {
    accept: 'application/vnd.sap.adt.mc.messageclass+xml',
    contentType: 'application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent
  'AdtMessageClassMessage.create': {
    accept: 'application/vnd.sap.adt.mc.messageclass+xml',
    contentType: 'application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent
  'AdtMessageClassMessage.delete': {
    accept: 'application/vnd.sap.adt.mc.messageclass+xml',
    contentType: 'application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent
  'AdtMessageClassMessage.update': {
    accept: 'application/vnd.sap.adt.mc.messageclass+xml',
    contentType: 'application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8',
  },
  'AdtMetadataExtension.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtMetadataExtension.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtMetadataExtension.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtMetadataExtension.create': {
    accept: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
    contentType: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
  },
  // completed for 36.0.0: contentType was not sent
  'AdtMetadataExtension.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtMetadataExtension.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtPackage.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtPackage.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtPackage.create': {
    accept:
      'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
    contentType: 'application/vnd.sap.adt.packages.v2+xml',
  },
  'AdtPackage.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtPackage.updateMetadata': {
    accept:
      'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
    contentType: 'application/vnd.sap.adt.packages.v2+xml',
  },
  'AdtProgram.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtProgram.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtProgram.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtProgram.create': {
    accept: 'application/vnd.sap.adt.programs.programs.v2+xml',
    contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
  },
  'AdtProgram.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtProgram.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtProgramLegacy.delete': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtRequest.addObject': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  'AdtRequest.changeTaskType': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  // completed for 36.0.0: accept was not sent, contentType was not sent
  'AdtRequest.checkDeletion': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'application/vnd.sap.adt.transportorganizer.v1+xml',
  },
  'AdtRequest.create': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  'AdtRequest.createTask': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  // completed for 36.0.0: contentType was not sent
  'AdtRequest.delete': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'application/vnd.sap.adt.transportorganizer.v1+xml',
  },
  'AdtRequest.moveObjects': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  'AdtRequest.removeObject': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'text/plain',
  },
  'AdtRequest.updateMetadata': {
    accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    contentType: 'application/vnd.sap.adt.transportorganizer.v1+xml',
  },
  'AdtScalarFunction.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtScalarFunction.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtScalarFunction.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtScalarFunction.create': {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  },
  'AdtScalarFunction.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtScalarFunction.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtScalarFunctionImplementation.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtScalarFunctionImplementation.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtScalarFunctionImplementation.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtScalarFunctionImplementation.create': {
    accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml',
    contentType: 'application/vnd.sap.adt.blues.v2+xml',
  },
  'AdtScalarFunctionImplementation.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtScalarFunctionImplementation.update': {
    accept: 'application/json',
    contentType: 'application/json',
  },
  'AdtScalarFunctionImplementation.updateMetadata': {
    accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml',
    contentType: 'application/vnd.sap.adt.blues.v2+xml; charset=utf-8',
  },
  'AdtServiceBinding.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtServiceBinding.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtServiceBinding.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtServiceBinding.create': {
    accept:
      'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
    contentType:
      'application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
  },
  'AdtServiceBinding.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtServiceBinding.update': {
    accept:
      'application/xml, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage',
    contentType: 'application/xml',
  },
  'AdtServiceDefinition.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtServiceDefinition.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtServiceDefinition.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtServiceDefinition.create': {
    accept: 'application/vnd.sap.adt.ddic.srvd.v1+xml',
    contentType: 'application/vnd.sap.adt.ddic.srvd.v1+xml',
  },
  'AdtServiceDefinition.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtServiceDefinition.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtStructure.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtStructure.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtStructure.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtStructure.create': {
    accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
    contentType: 'application/vnd.sap.adt.structures.v2+xml',
  },
  'AdtStructure.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtStructure.update': {
    accept: 'application/xml, application/json, text/plain, */*',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtTable.activate': {
    accept: 'application/xml',
    contentType: 'application/vnd.sap.adt.activation+xml',
  },
  'AdtTable.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtTable.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtTable.create': {
    accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml',
    contentType: 'application/vnd.sap.adt.tables.v2+xml',
  },
  'AdtTable.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtTable.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtTransformation.activate': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtTransformation.check': {
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  },
  'AdtTransformation.checkDeletion': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtTransformation.create': {
    accept: 'application/vnd.sap.adt.transformations+xml',
    contentType: 'application/vnd.sap.adt.transformations+xml',
  },
  'AdtTransformation.delete': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtTransformation.update': {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtUtils.activateObjectsGroup': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AdtUtils.checkDeletionGroup': {
    accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  },
  'AdtUtils.deleteObjectsGroup': {
    accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
  },
  'AdtUtils.fetchNodeStructure': {
    accept:
      'application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
    contentType: 'application/vnd.sap.as+xml; charset=UTF-8; dataname=null',
  },
  'AdtUtils.getSqlQuery': {
    accept: 'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtUtils.getTableContents': {
    accept: 'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
    contentType: 'text/plain; charset=utf-8',
  },
  'AdtUtils.getVirtualFoldersContents': {
    accept: 'application/vnd.sap.adt.repository.virtualfolders.result.v1+xml',
    contentType:
      'application/vnd.sap.adt.repository.virtualfolders.request.v1+xml',
  },
  'AdtUtils.getWhereUsed': {
    accept: 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml',
    contentType:
      'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
  },
  'AdtUtils.getWhereUsedScope': {
    accept:
      'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml',
    contentType:
      'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml',
  },
  'AdtUtilsLegacy.activateObjectsGroup': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'AmdpDebugger.getDataPreview': {
    accept: 'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
    contentType: 'text/plain',
  },
  'ClassExecutor.scheduleTrace': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'ProgramExecutor.scheduleTrace': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
  'TraceScheduling.scheduleTrace': {
    accept: 'application/xml',
    contentType: 'application/xml',
  },
};

/** The class on the prototype chain that implements `member`. */
function ownerOf(handler: object, member: string): string | undefined {
  let proto: object | null = Object.getPrototypeOf(handler);
  while (proto && proto !== Object.prototype) {
    if (Object.hasOwn(proto, member)) {
      return (proto as { constructor: { name: string } }).constructor.name;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

/** What a member read from the client's provider before 36.0.0. */
function fromProvider(
  key: string,
  provider: IAdtContentTypes,
): IAdtHeaders | undefined {
  const source = (base: IAdtHeaders): IAdtHeaders => ({
    accept: base.accept,
    contentType: provider.sourceArtifactContentType(),
  });
  switch (key) {
    case 'AdtClass.create':
      return provider.classCreate();
    case 'AdtProgram.create':
      return provider.programCreate();
    case 'AdtInclude.create':
      return provider.includeCreate();
    case 'AdtFunctionGroup.create': {
      const pair = provider.functionGroupCreate();
      return { accept: pair.contentType, contentType: pair.contentType };
    }
    case 'AdtFunctionGroup.updateMetadata':
      return provider.functionGroupUpdate();
    case 'AdtClass.update':
    case 'AdtInterface.update':
    case 'AdtFunctionModule.update':
    case 'AdtLocalTestClass.update':
    case 'AdtLocalTestClass.delete':
    case 'AdtLocalTypes.update':
    case 'AdtLocalTypes.delete':
    case 'AdtLocalDefinitions.update':
    case 'AdtLocalDefinitions.delete':
    case 'AdtLocalMacros.update':
    case 'AdtLocalMacros.delete':
      return source(SENT_BEFORE_36[key] as IAdtHeaders);
    case 'AdtFunctionInclude.update': {
      const unicode = provider.sourceArtifactContentType().includes('utf-8');
      return {
        accept: 'text/plain',
        contentType: unicode ? 'text/plain; charset=utf-8' : 'text/plain',
      };
    }
    default:
      return undefined;
  }
}

/** The pair for `<implementing class>.<member>`, as recorded. */
export function headersFor(key: string): IAdtHeaders {
  const pair = SENT_BEFORE_36[key];
  if (!pair) throw new Error(`No recorded headers for ${key}`);
  return pair;
}

/**
 * The pair `handler.member` sent before 36.0.0. A handler that answers
 * without a request (a legacy refusal) gets `TEST_HEADERS`: nothing is sent.
 * An enhancement's `create` and `updateMetadata` need the `config`, whose
 * subtype chose the type.
 */
export function headersOf(
  handler: object,
  member: string,
  config?: object,
): IAdtHeaders {
  const owner = ownerOf(handler, member);
  if (!owner) return TEST_HEADERS;
  const key = `${owner}.${member}`;
  // An enhancement's own document has a type per subtype: before 36.0.0
  // `create` and `updateMetadata` chose it from the config.
  if (
    owner === 'AdtEnhancement' &&
    (member === 'create' || member === 'updateMetadata') &&
    config &&
    'enhancementType' in config &&
    config.enhancementType
  ) {
    const media =
      ENHANCEMENT_CONTENT_TYPES[config.enhancementType as EnhancementType];
    return { accept: media, contentType: media };
  }
  const provider = (handler as { contentTypes?: IAdtContentTypes })
    .contentTypes;
  return (
    (provider && fromProvider(key, provider)) ??
    SENT_BEFORE_36[key] ??
    TEST_HEADERS
  );
}
