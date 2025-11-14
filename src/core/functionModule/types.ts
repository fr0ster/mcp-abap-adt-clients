/**
 * FunctionModule types
 */

export interface CreateFunctionModuleParams {
  function_group_name: string;
  function_module_name: string;
  source_code: string;
  package_name?: string; // optional: used to auto-create the function group if it doesn't exist
  description?: string;
  transport_request?: string;
  activate?: boolean;
}

export interface UpdateFunctionModuleSourceParams {
  function_group_name: string;
  function_module_name: string;
  source_code: string;
  activate?: boolean;
}

