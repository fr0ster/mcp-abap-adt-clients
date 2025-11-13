/**
 * FunctionGroup types
 */

export interface CreateFunctionGroupParams {
  function_group_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  activate?: boolean;
}

