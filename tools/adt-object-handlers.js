/**
 * ADT Object Handlers Generator
 *
 * Scans core modules and clients to map ADT object types to classes and methods.
 *
 * Usage:
 *   node tools/adt-object-handlers.js
 *   node tools/adt-object-handlers.js --output docs/usage/ADT_OBJECT_HANDLERS.md
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '../docs/usage/ADT_OBJECT_HANDLERS.md',
);

const CLIENT_FILES = {
  adt: path.resolve(__dirname, '../src/clients/AdtClient.ts'),
  readOnly: path.resolve(__dirname, '../src/clients/ReadOnlyClient.ts'),
  crud: path.resolve(__dirname, '../src/clients/CrudClient.ts'),
};

const SKIP_OBJECTS = new Set(['Utils']);
const SKIP_METHOD_BASES = new Set(['ObjectsGroup']);
const METHOD_BASE_ALIASES = {
  BehaviorImplementationMainSource: 'BehaviorImplementation',
  ClassDefinitions: 'Class',
  ClassLocalTypes: 'Class',
  ClassMacros: 'Class',
  ClassTestIncludes: 'Class',
  Transport: 'Request',
};
const CORE_ROOT = path.resolve(__dirname, '../src/core');

function readFileSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function extractExportedClasses(text) {
  const classRegex = /export\s+class\s+([A-Za-z0-9_]+)/g;
  const classes = [];
  let match = null;

  while ((match = classRegex.exec(text)) !== null) {
    classes.push(match[1]);
  }

  return classes;
}

function extractExportedFunctions(text) {
  const funcRegex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  const functions = [];
  let match = null;

  while ((match = funcRegex.exec(text)) !== null) {
    functions.push(match[1]);
  }

  return functions;
}

function extractImports(text) {
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/core\/([^'"]+)['"]/g;
  const map = {};
  let match = null;

  while ((match = importRegex.exec(text)) !== null) {
    const names = match[1]
      .split(',')
      .map((name) => name.replace(/\btype\b/g, '').trim())
      .filter(Boolean);
    const modulePath = match[2].trim();
    const moduleDir = modulePath.split('/')[0];

    names.forEach((name) => {
      map[name] = moduleDir;
    });
  }

  return map;
}

function extractMethodBases(text, prefix) {
  const regex = new RegExp(
    `^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?${prefix}([A-Za-z0-9_]+)\\s*\\(`,
    'gm',
  );
  const bases = [];
  let match = null;

  while ((match = regex.exec(text)) !== null) {
    bases.push(match[1]);
  }

  return uniqueSorted(bases);
}

function listModuleClasses(modulePath) {
  if (!fs.existsSync(modulePath)) {
    return [];
  }

  const entries = fs
    .readdirSync(modulePath)
    .filter((entry) => entry.endsWith('.ts'));

  const classes = entries.flatMap((entry) => {
    const filePath = path.join(modulePath, entry);
    const text = readFileSafe(filePath);
    return extractExportedClasses(text);
  });

  return uniqueSorted(classes);
}

function listCoreFunctions(modulePath, fileNames) {
  const targetFiles =
    fileNames ??
    fs
      .readdirSync(modulePath)
      .filter(
        (entry) =>
          entry.endsWith('.ts') &&
          entry !== 'index.ts' &&
          entry !== 'types.ts',
      );

  const functions = targetFiles.flatMap((fileName) => {
    const filePath = path.join(modulePath, fileName);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const text = readFileSafe(filePath);
    const exported = extractExportedFunctions(text);
    return exported.map((fn) => `${fileName}:${fn}`);
  });

  return uniqueSorted(functions);
}

function methodExists(text, methodName) {
  const methodRegex = new RegExp(`\\b${methodName}\\s*\\(`);
  return methodRegex.test(text);
}

function extractCrudMethods(text) {
  const methods = [];
  ['create', 'update', 'delete'].forEach((prefix) => {
    const bases = extractMethodBases(text, prefix);
    bases.forEach((base) => {
      methods.push({ prefix, base });
    });
  });

  return methods;
}

function listCoreModules() {
  if (!fs.existsSync(CORE_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(CORE_ROOT)
    .filter((entry) => fs.statSync(path.join(CORE_ROOT, entry)).isDirectory())
    .filter((entry) => entry !== 'shared');
}

function resolveModuleDir(className, importMap, methodBase, moduleDirs) {
  if (importMap[className]) {
    return importMap[className];
  }

  const baseLower = methodBase.toLowerCase();
  const match = moduleDirs.find((dir) => dir.toLowerCase() === baseLower);
  return match ?? 'unknown';
}

function normalizeBase(base) {
  return METHOD_BASE_ALIASES[base] ?? base;
}

function collectObjects(clientText) {
  const importMap = extractImports(clientText.adt);
  const moduleDirs = listCoreModules();
  const methodBases = new Set();
  const crudMethods = extractCrudMethods(clientText.crud);

  extractMethodBases(clientText.adt, 'get').forEach((base) => {
    if (!SKIP_OBJECTS.has(base)) {
      methodBases.add(base);
    }
  });

  extractMethodBases(clientText.readOnly, 'read').forEach((base) => {
    methodBases.add(base);
  });

  crudMethods.forEach(({ base }) => {
    const normalized = normalizeBase(base);
    if (!SKIP_METHOD_BASES.has(normalized)) {
      methodBases.add(normalized);
    }
  });

  const objects = Array.from(methodBases).map((methodBase) => {
    const className = `Adt${methodBase}`;
    const moduleDir = resolveModuleDir(
      className,
      importMap,
      methodBase,
      moduleDirs,
    );
    const id = methodBase.replace(/^[A-Z]/, (letter) => letter.toLowerCase());

    return {
      id,
      label: methodBase,
      moduleDir,
      methodBase,
    };
  });

  return objects.sort((a, b) => a.label.localeCompare(b.label));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let output = DEFAULT_OUTPUT;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--output' && args[i + 1]) {
      output = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'ADT Object Handlers Generator',
          '',
          'Usage:',
          '  node tools/adt-object-handlers.js',
          '  node tools/adt-object-handlers.js --output docs/usage/ADT_OBJECT_HANDLERS.md',
        ].join('\n'),
      );
      process.exit(0);
    }
  }

  return { output };
}

function generateMarkdown(objects, clientText) {
  const lines = [];
  const crudMethods = extractCrudMethods(clientText.crud);
  const crudMethodsByBase = new Map();

  crudMethods.forEach(({ prefix, base }) => {
    const normalized = normalizeBase(base);
    if (SKIP_METHOD_BASES.has(normalized)) {
      return;
    }
    const list = crudMethodsByBase.get(normalized) ?? [];
    list.push(`${prefix}${base}`);
    crudMethodsByBase.set(normalized, list);
  });

  lines.push('# ADT Object Handlers');
  lines.push('');
  lines.push(
    '_Generated by `tools/adt-object-handlers.js`. Do not edit by hand._',
  );
  lines.push('');

  objects.forEach((object) => {
    const modulePath = path.resolve(
      __dirname,
      '../src/core',
      object.moduleDir,
    );
    const classes =
      object.moduleDir === 'unknown' ? [] : listModuleClasses(modulePath);
    const functions =
      object.moduleDir === 'unknown' ? [] : listCoreFunctions(modulePath);
    const clientMethods = [];
    const adtMethod = `get${object.methodBase}`;
    if (methodExists(clientText.adt, adtMethod)) {
      clientMethods.push(`AdtClient.${adtMethod}`);
    }

    const readOnlyMethod = `read${object.methodBase}`;
    if (methodExists(clientText.readOnly, readOnlyMethod)) {
      clientMethods.push(`ReadOnlyClient.${readOnlyMethod}`);
    }

    const crudMethodsForBase = uniqueSorted(
      crudMethodsByBase.get(object.methodBase) ?? [],
    );
    crudMethodsForBase.forEach((method) => {
      if (methodExists(clientText.crud, method)) {
        clientMethods.push(`CrudClient.${method}`);
      }
    });

    lines.push(`## ${object.label}`);
    lines.push(`- Core module: \`${object.moduleDir}\``);
    lines.push(
      `- Core classes: ${classes.length ? classes.map((name) => `\`${name}\``).join(', ') : '—'}`,
    );
    lines.push(
      `- Client methods: ${clientMethods.length ? clientMethods.map((name) => `\`${name}\``).join(', ') : '—'}`,
    );
    lines.push(
      `- Core functions: ${functions.length ? functions.map((name) => `\`${name}\``).join(', ') : '—'}`,
    );
    lines.push('');
  });

  return lines.join('\n');
}

function main() {
  const { output } = parseArgs(process.argv);
  const clientText = {
    adt: readFileSafe(CLIENT_FILES.adt),
    readOnly: readFileSafe(CLIENT_FILES.readOnly),
    crud: readFileSafe(CLIENT_FILES.crud),
  };

  const objects = collectObjects(clientText);
  const markdown = generateMarkdown(objects, clientText);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${markdown}\n`, 'utf-8');
}

main();
