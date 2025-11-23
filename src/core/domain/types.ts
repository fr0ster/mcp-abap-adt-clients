/**
 * Domain module type definitions
 */

export interface FixedValue {
  low: string;
  text: string;
}

// Low-level function parameters (snake_case)
export interface CreateDomainParams {
  domain_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  activate?: boolean;
  fixed_values?: FixedValue[];
}

export interface UpdateDomainParams {
  domain_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  activate?: boolean;
  fixed_values?: FixedValue[];
}

export interface DeleteDomainParams {
  domain_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface DomainBuilderConfig {
  domainName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  fixed_values?: FixedValue[];
}

export interface DomainBuilderState {
  validationResult?: any;
  createResult?: any;
  lockHandle?: string;
  updateResult?: any;
  checkResult?: any;
  unlockResult?: any;
  activateResult?: any;
  deleteResult?: any;
  readResult?: any;
  transportResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}
