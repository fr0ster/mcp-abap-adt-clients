/**
 * ADT Content-Type / Accept header provider
 *
 * Base class provides v1 headers (universal, works on all systems).
 * Modern subclass overrides with v2+ for newer systems (S/4 HANA, BTP).
 *
 * Each method returns { accept, contentType } for a specific operation.
 * Accept can contain multiple values (comma-separated), Content-Type is always single.
 */

export interface IAdtHeaders {
  accept: string;
  contentType: string;
}

export interface IAdtContentTypes {
  // Program
  programCreate(): IAdtHeaders;
  programRead(): IAdtHeaders;

  // Class
  classCreate(): IAdtHeaders;
  classRead(): IAdtHeaders;

  // Interface
  interfaceCreate(): IAdtHeaders;

  // Domain
  domainCreate(): IAdtHeaders;
  domainRead(): IAdtHeaders;
  domainUpdate(): IAdtHeaders;

  // Data Element
  dataElementCreate(): IAdtHeaders;
  dataElementRead(): IAdtHeaders;
  dataElementUpdate(): IAdtHeaders;

  // Structure
  structureCreate(): IAdtHeaders;

  // Table
  tableCreate(): IAdtHeaders;

  // Package
  packageCreate(): IAdtHeaders;
  packageRead(): IAdtHeaders;
  packageUpdate(): IAdtHeaders;

  // Function Group
  functionGroupCreate(): IAdtHeaders;
  functionGroupUpdate(): IAdtHeaders;

  // Source code artifact content type (used in checkRun XML payload)
  // Unicode systems: 'text/plain; charset=utf-8'
  // Non-unicode legacy systems: 'text/plain'
  sourceArtifactContentType(): string;
}

/**
 * Base content types — v1 headers, works on all SAP systems including older BASIS
 */
export class AdtContentTypesBase implements IAdtContentTypes {
  programCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.programs.programs+xml',
      contentType: 'application/vnd.sap.adt.programs.programs+xml',
    };
  }

  programRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.programs.programs.v3+xml, application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
      contentType: 'application/vnd.sap.adt.programs.programs+xml',
    };
  }

  classCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.oo.classes+xml',
      contentType: 'application/vnd.sap.adt.oo.classes+xml',
    };
  }

  classRead(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.oo.classes+xml',
      contentType: 'application/vnd.sap.adt.oo.classes+xml',
    };
  }

  interfaceCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.oo.interfaces+xml',
      contentType: 'application/vnd.sap.adt.oo.interfaces+xml',
    };
  }

  domainCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.domains.v1+xml',
      contentType: 'application/vnd.sap.adt.domains.v1+xml',
    };
  }

  domainRead(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.domains.v1+xml',
      contentType: 'application/vnd.sap.adt.domains.v1+xml',
    };
  }

  domainUpdate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.domains.v1+xml',
      contentType: 'application/vnd.sap.adt.domains.v1+xml; charset=utf-8',
    };
  }

  dataElementCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.dataelements.v1+xml',
      contentType: 'application/vnd.sap.adt.dataelements.v1+xml',
    };
  }

  dataElementRead(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.dataelements.v1+xml',
      contentType: 'application/vnd.sap.adt.dataelements.v1+xml',
    };
  }

  dataElementUpdate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.dataelements.v1+xml',
      contentType: 'application/vnd.sap.adt.dataelements.v1+xml; charset=utf-8',
    };
  }

  structureCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.structures.v1+xml',
      contentType: 'application/vnd.sap.adt.structures.v1+xml',
    };
  }

  tableCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.tables.v1+xml',
      contentType: 'application/vnd.sap.adt.tables.v1+xml',
    };
  }

  packageCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v1+xml',
    };
  }

  packageRead(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v1+xml',
    };
  }

  packageUpdate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v1+xml',
    };
  }

  functionGroupCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.functions.groups+xml',
      contentType: 'application/vnd.sap.adt.functions.groups+xml',
    };
  }

  functionGroupUpdate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.functions.groups+xml',
      contentType: 'application/vnd.sap.adt.functions.groups+xml; charset=utf-8',
    };
  }

  sourceArtifactContentType(): string {
    return 'text/plain';
  }
}

/**
 * Modern content types — v2+ headers for S/4 HANA, BTP, and newer BASIS systems.
 * Accept includes both new and old versions for compatibility.
 * Content-Type uses the newest version.
 */
export class AdtContentTypesModern extends AdtContentTypesBase {
  override classCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes+xml',
      contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
    };
  }

  override classRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes+xml',
      contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
    };
  }

  override interfaceCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces+xml',
      contentType: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
    };
  }

  override programCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
      contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
    };
  }

  override programRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
      contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
    };
  }

  override domainCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
      contentType: 'application/vnd.sap.adt.domains.v2+xml',
    };
  }

  override domainRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml',
      contentType: 'application/vnd.sap.adt.domains.v2+xml',
    };
  }

  override domainUpdate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
      contentType: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
    };
  }

  override dataElementCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
      contentType: 'application/vnd.sap.adt.dataelements.v2+xml',
    };
  }

  override dataElementRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml',
      contentType: 'application/vnd.sap.adt.dataelements.v2+xml',
    };
  }

  override dataElementUpdate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
      contentType:
        'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
    };
  }

  override structureCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
      contentType: 'application/vnd.sap.adt.structures.v2+xml',
    };
  }

  override tableCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml',
      contentType: 'application/vnd.sap.adt.tables.v2+xml',
    };
  }

  override packageCreate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v2+xml',
    };
  }

  override packageRead(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v2+xml',
    };
  }

  override packageUpdate(): IAdtHeaders {
    return {
      accept:
        'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      contentType: 'application/vnd.sap.adt.packages.v2+xml',
    };
  }

  override functionGroupCreate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
      contentType: 'application/vnd.sap.adt.functions.groups.v3+xml',
    };
  }

  override functionGroupUpdate(): IAdtHeaders {
    return {
      accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
      contentType:
        'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
    };
  }

  override sourceArtifactContentType(): string {
    return 'text/plain; charset=utf-8';
  }
}
