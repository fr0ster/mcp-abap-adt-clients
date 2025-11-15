/**
 * Example: Using ClassBuilder with Promise chaining
 *
 * Demonstrates:
 * - Method chaining with .then()
 * - Error handling with .catch()
 * - Cleanup with .finally()
 * - Result storage in builder state
 * - Chain interruption on error
 */

import { createAbapConnection, SapConfig, ILogger } from '@mcp-abap-adt/connection';
import { ClassBuilder, ClassBuilderLogger } from '../../core/class';

// Example logger for connection (ILogger interface)
const connectionLogger: ILogger = {
  debug: (message: string, meta?: any) => console.log(message, meta),
  info: (message: string, meta?: any) => console.log(message, meta),
  warn: (message: string, meta?: any) => console.warn(message, meta),
  error: (message: string, meta?: any) => console.error(message, meta),
  csrfToken: (action: string, token?: string) => console.log(`CSRF ${action}:`, token),
};

// Example logger for ClassBuilder (ClassBuilderLogger interface)
const builderLogger: ClassBuilderLogger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

// Example 1: Basic Promise chaining
async function example1(
  className: string = process.env.TEST_CLASS_NAME || 'ZCL_TEST',
  packageName: string = process.env.TEST_PACKAGE_NAME || process.env.SAP_PACKAGE || '',
  transportRequest?: string,
  sourceCode?: string
) {
  const config: SapConfig = {
    url: process.env.SAP_URL!,
    authType: (process.env.SAP_AUTH_TYPE as 'basic' | 'jwt') || 'basic',
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
    ...(process.env.SAP_CLIENT && { client: process.env.SAP_CLIENT }),
    ...(process.env.SAP_JWT_TOKEN && { jwtToken: process.env.SAP_JWT_TOKEN }),
  };
  const connection = createAbapConnection(config, connectionLogger);

  const builder = new ClassBuilder(connection, builderLogger, {
    className,
    packageName,
    transportRequest: transportRequest || process.env.SAP_TRANSPORT_REQUEST,
  });

  if (sourceCode) {
    builder.setCode(sourceCode);
  }

  // Promise chain - переривається при першій помилці
  await builder
    .validate()
    .then(b => {
      console.log('Validation result:', b.getValidationResult());
      return b.create();
    })
    .then(b => {
      console.log('Create result:', b.getCreateResult()?.status);
      return b.lock();
    })
    .then(b => {
      console.log('Lock handle:', b.getLockHandle());
      return b.update();
    })
    .then(b => {
      console.log('Update result:', b.getUpdateResult()?.status);
      return b.check();
    })
    .then(b => {
      console.log('Check result:', b.getCheckResult()?.status);
      return b.unlock();
    })
    .then(b => {
      console.log('Unlock result:', b.getUnlockResult()?.status);
      return b.activate();
    })
    .then(b => {
      console.log('Activate result:', b.getActivateResult()?.status);
      console.log('All results:', b.getResults());
    })
    .catch(error => {
      // Обробка помилок - виконується при першій помилці
      console.error('Operation failed:', error);
      console.error('Errors in chain:', builder.getErrors());

      // Cleanup при помилці - перевірити чи клас заблокований
      if (builder.getLockHandle()) {
        console.log('Attempting to unlock class after error...');
        builder.unlock().catch(unlockError => {
          console.error('Failed to unlock during error cleanup:', unlockError);
        });
      }
    })
    .finally(() => {
      // Cleanup - завжди виконується, навіть при помилці
      console.log('Cleanup: ensuring class is unlocked');

      // Фінальна перевірка та cleanup
      if (builder.getLockHandle()) {
        builder.unlock().catch(console.error);
      }
    });
}

// Example 2: Error handling with specific error types
async function example2(
  className: string = process.env.TEST_CLASS_NAME || 'ZCL_TEST',
  packageName: string = process.env.TEST_PACKAGE_NAME || process.env.SAP_PACKAGE || '',
  sourceCode?: string
) {
  const config: SapConfig = {
    url: process.env.SAP_URL!,
    authType: (process.env.SAP_AUTH_TYPE as 'basic' | 'jwt') || 'basic',
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
    ...(process.env.SAP_CLIENT && { client: process.env.SAP_CLIENT }),
    ...(process.env.SAP_JWT_TOKEN && { jwtToken: process.env.SAP_JWT_TOKEN }),
  };
  const connection = createAbapConnection(config, connectionLogger);

  const builder = new ClassBuilder(connection, builderLogger, {
    className,
    packageName,
    transportRequest: process.env.SAP_TRANSPORT_REQUEST,
  });

  if (sourceCode) {
    builder.setCode(sourceCode);
  }

  try {
    await builder
      .validate()
      .then(b => b.create())
      .then(b => b.lock())
      .then(b => b.update())
      .then(b => b.check())
      .then(b => b.unlock())
      .then(b => b.activate());

    // Успішне виконання
    console.log('All operations completed successfully');
    console.log('Final state:', builder.getState());
  } catch (error: any) {
    // Обробка помилок
    if (error.message?.includes('validation')) {
      console.error('Validation error:', error);
    } else if (error.message?.includes('create')) {
      console.error('Create error:', error);
    } else {
      console.error('Unknown error:', error);
    }

    // Отримати всі помилки з ланцюга
    const errors = builder.getErrors();
    console.error('All errors:', errors);

    // Cleanup при помилці
    if (builder.getLockHandle()) {
      try {
        await builder.unlock();
      } catch (unlockError) {
        console.error('Failed to unlock during cleanup:', unlockError);
      }
    }
  }
}

// Example 3: Conditional execution
async function example3(
  className: string = process.env.TEST_CLASS_NAME || 'ZCL_TEST',
  packageName: string = process.env.TEST_PACKAGE_NAME || process.env.SAP_PACKAGE || '',
  sourceCode?: string,
  skipUpdate: boolean = process.env.SKIP_UPDATE === 'true'
) {
  const config: SapConfig = {
    url: process.env.SAP_URL!,
    authType: (process.env.SAP_AUTH_TYPE as 'basic' | 'jwt') || 'basic',
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
    ...(process.env.SAP_CLIENT && { client: process.env.SAP_CLIENT }),
    ...(process.env.SAP_JWT_TOKEN && { jwtToken: process.env.SAP_JWT_TOKEN }),
  };
  const connection = createAbapConnection(config, connectionLogger);

  const builder = new ClassBuilder(connection, builderLogger, {
    className,
    packageName,
    transportRequest: process.env.SAP_TRANSPORT_REQUEST,
  });

  if (sourceCode) {
    builder.setCode(sourceCode);
  }

  await builder
    .validate()
    .then(b => {
      const validationResult = b.getValidationResult();
      if (validationResult?.valid) {
        return b.create();
      } else {
        throw new Error(`Validation failed: ${validationResult?.message}`);
      }
    })
    .then(b => b.lock())
    .then(b => {
      // Умовна логіка
      if (!skipUpdate) {
        return b.update();
      } else {
        console.log('Skipping update');
        return b;
      }
    })
    .then(b => b.check())
    .then(b => b.unlock())
    .then(b => b.activate())
    .catch(error => {
      console.error('Chain interrupted:', error);
    })
    .finally(() => {
      // Cleanup завжди виконується
      console.log('Cleanup completed');
    });
}

// Example 4: Parallel operations after chain
async function example4(
  className: string = process.env.TEST_CLASS_NAME || 'ZCL_TEST',
  packageName: string = process.env.TEST_PACKAGE_NAME || process.env.SAP_PACKAGE || '',
  sourceCode?: string
) {
  const config: SapConfig = {
    url: process.env.SAP_URL!,
    authType: (process.env.SAP_AUTH_TYPE as 'basic' | 'jwt') || 'basic',
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
    ...(process.env.SAP_CLIENT && { client: process.env.SAP_CLIENT }),
    ...(process.env.SAP_JWT_TOKEN && { jwtToken: process.env.SAP_JWT_TOKEN }),
  };
  const connection = createAbapConnection(config, connectionLogger);

  const builder = new ClassBuilder(connection, builderLogger, {
    className,
    packageName,
    transportRequest: process.env.SAP_TRANSPORT_REQUEST,
  });

  if (sourceCode) {
    builder.setCode(sourceCode);
  }

  await builder
    .validate()
    .then(b => b.create())
    .then(b => b.lock())
    .then(b => b.update())
    .then(b => b.unlock())
    .then(b => b.activate())
    .then(async (b) => {
      // Після успішного виконання можна виконати паралельні операції
      const results = await Promise.all([
        b.check('active'),
        // Інші операції
      ]);
      return b;
    })
    .catch(error => {
      console.error('Error:', error);
    })
    .finally(() => {
      console.log('Done');
    });
}

export { example1, example2, example3, example4 };

