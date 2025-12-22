/**
 * Error classes for unsupported ADT operations
 *
 * These errors are thrown when an operation is not implemented
 * in ADT for a specific object type.
 */

/**
 * Base error for unsupported ADT operations
 */
export class UnsupportedAdtOperationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly objectType: string,
    message?: string,
  ) {
    super(
      message ||
        `${operation} operation is not implemented in ADT for ${objectType} objects`,
    );
    this.name = 'UnsupportedAdtOperationError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedAdtOperationError);
    }
  }
}

/**
 * Error thrown when create operation is not supported
 */
export class UnsupportedCreateOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Create', objectType);
    this.name = 'UnsupportedCreateOperationError';
  }
}

/**
 * Error thrown when update operation is not supported
 */
export class UnsupportedUpdateOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Update', objectType);
    this.name = 'UnsupportedUpdateOperationError';
  }
}

/**
 * Error thrown when delete operation is not supported
 */
export class UnsupportedDeleteOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Delete', objectType);
    this.name = 'UnsupportedDeleteOperationError';
  }
}

/**
 * Error thrown when activate operation is not supported
 */
export class UnsupportedActivateOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Activate', objectType);
    this.name = 'UnsupportedActivateOperationError';
  }
}

/**
 * Error thrown when check operation is not supported
 */
export class UnsupportedCheckOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Check', objectType);
    this.name = 'UnsupportedCheckOperationError';
  }
}

/**
 * Error thrown when validate operation is not supported
 */
export class UnsupportedValidateOperationError extends UnsupportedAdtOperationError {
  constructor(objectType: string) {
    super('Validate', objectType);
    this.name = 'UnsupportedValidateOperationError';
  }
}
