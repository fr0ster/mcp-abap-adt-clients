/**
 * ADT Object Entities Generator
 *
 * Maps the ADT object entities to the classes and methods that serve them:
 * every `AdtClient.getXxx()` getter with its core module, the standalone
 * clients under `src/clients/`, and the runtime classes under `src/runtime/`.
 *
 * The sources are read with the TypeScript parser (no type checker, no
 * regular expressions), so a getter's overloads, its type parameters, an
 * options-object constructor or a static `create` read the same as a plain
 * method: one name, whatever its signature looks like.
 *
 * Usage:
 *   npm run adt:entities                      # write docs/usage/ADT_OBJECT_ENTITIES.md
 *   npm run adt:entities -- --output <file>   # write another file
 *   npm run check:entities                    # fail when the committed file differs
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.resolve(
  PACKAGE_ROOT,
  'docs/usage/ADT_OBJECT_ENTITIES.md',
);
const ADT_CLIENT_FILE = path.resolve(PACKAGE_ROOT, 'src/clients/AdtClient.ts');
const CORE_ROOT = path.resolve(PACKAGE_ROOT, 'src/core');
const CLIENTS_ROOT = path.resolve(PACKAGE_ROOT, 'src/clients');
const RUNTIME_ROOT = path.resolve(PACKAGE_ROOT, 'src/runtime');

const SKIP_OBJECTS = new Set(['Utils']);

// AdtClient is enumerated separately via its getXxx() factories.
const SKIP_STANDALONE_CLIENTS = new Set(['AdtClient']);

const GETTER_PREFIX = 'get';

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function parse(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function hasModifier(node, kind) {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : [];
  return (modifiers ?? []).some((modifier) => modifier.kind === kind);
}

function isExported(node) {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function exportedClasses(source) {
  return source.statements.filter(
    (statement) =>
      ts.isClassDeclaration(statement) &&
      statement.name !== undefined &&
      isExported(statement),
  );
}

function exportedFunctionNames(source) {
  return source.statements
    .filter(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name !== undefined &&
        isExported(statement),
    )
    .map((statement) => statement.name.text);
}

/**
 * The public methods of a class, static ones included: every overload and
 * the implementation give one name. Private and protected members, `#names`,
 * the constructor and accessors are left out, and so is what a class
 * inherits: its `extends` is listed beside it.
 */
function publicMethodNames(classNode) {
  const names = classNode.members
    .filter((member) => ts.isMethodDeclaration(member))
    .filter(
      (member) =>
        !hasModifier(member, ts.SyntaxKind.PrivateKeyword) &&
        !hasModifier(member, ts.SyntaxKind.ProtectedKeyword),
    )
    .map((member) => member.name)
    .filter((name) => ts.isIdentifier(name))
    .map((name) => name.text);
  return uniqueSorted(names);
}

/** Every name imported from `../core/<dir>/…`, mapped to `<dir>`. */
function coreImports(source) {
  const map = {};
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) continue;
    const prefix = '../core/';
    if (!specifier.text.startsWith(prefix)) continue;
    const moduleDir = specifier.text.slice(prefix.length).split('/')[0];
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      map[element.name.text] = moduleDir;
    }
  }
  return map;
}

function tsFiles(directory, { recursive }) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (recursive && entry.name !== '__tests__') {
        files.push(...tsFiles(entryPath, { recursive }));
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(entryPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function listModuleClasses(modulePath) {
  return uniqueSorted(
    tsFiles(modulePath, { recursive: false }).flatMap((filePath) =>
      exportedClasses(parse(filePath)).map((node) => node.name.text),
    ),
  );
}

function listCoreFunctions(modulePath) {
  return uniqueSorted(
    tsFiles(modulePath, { recursive: false })
      .filter((filePath) => {
        const base = path.basename(filePath);
        return base !== 'index.ts' && base !== 'types.ts';
      })
      .flatMap((filePath) => {
        const fileName = path.basename(filePath);
        return exportedFunctionNames(parse(filePath)).map(
          (name) => `${fileName}:${name}`,
        );
      }),
  );
}

function listCoreModules() {
  if (!fs.existsSync(CORE_ROOT)) return [];
  return fs
    .readdirSync(CORE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name);
}

function resolveModuleDir(className, importMap, methodBase, moduleDirs) {
  if (importMap[className]) return importMap[className];
  const baseLower = methodBase.toLowerCase();
  const match = moduleDirs.find((dir) => dir.toLowerCase() === baseLower);
  return match ?? 'unknown';
}

function adtClientClass(source) {
  const node = exportedClasses(source).find(
    (candidate) => candidate.name.text === 'AdtClient',
  );
  if (node === undefined) {
    throw new Error(`no exported class AdtClient in ${ADT_CLIENT_FILE}`);
  }
  return node;
}

function collectObjects() {
  const source = parse(ADT_CLIENT_FILE);
  const importMap = coreImports(source);
  const moduleDirs = listCoreModules();

  const methodBases = publicMethodNames(adtClientClass(source))
    .filter(
      (name) =>
        name.startsWith(GETTER_PREFIX) && name.length > GETTER_PREFIX.length,
    )
    .map((name) => name.slice(GETTER_PREFIX.length))
    .filter((base) => !SKIP_OBJECTS.has(base));

  return methodBases
    .map((methodBase) => ({
      label: methodBase,
      methodBase,
      moduleDir: resolveModuleDir(
        `Adt${methodBase}`,
        importMap,
        methodBase,
        moduleDirs,
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function listClasses(directory, { recursive, skip }) {
  const classes = [];
  for (const filePath of tsFiles(directory, { recursive })) {
    for (const node of exportedClasses(parse(filePath))) {
      if (skip.has(node.name.text)) continue;
      const extended = (node.heritageClauses ?? []).find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
      );
      classes.push({
        className: node.name.text,
        extends: extended?.types.map((type) => type.getText()).join(', '),
        file: path.relative(PACKAGE_ROOT, filePath).split(path.sep).join('/'),
        methods: publicMethodNames(node),
      });
    }
  }
  return classes.sort((a, b) => a.className.localeCompare(b.className));
}

function codeList(names) {
  return names.length ? names.map((name) => `\`${name}\``).join(', ') : '—';
}

function classSection(lines, heading, intro, classes) {
  if (classes.length === 0) return;
  lines.push(`## ${heading}`);
  lines.push('');
  lines.push(intro);
  lines.push('');
  for (const entry of classes) {
    lines.push(`### ${entry.className}`);
    lines.push(`- Source: \`${entry.file}\``);
    if (entry.extends !== undefined) {
      lines.push(`- Extends: \`${entry.extends}\``);
    }
    lines.push(`- Public methods: ${codeList(entry.methods)}`);
    lines.push('');
  }
}

function generateMarkdown() {
  const lines = [];
  lines.push('# ADT Object Entities');
  lines.push('');
  lines.push(
    '_Generated by `tools/adt-object-entities.js` (`npm run adt:entities`). Do not edit by hand; `npm run check:entities` fails when it is stale._',
  );
  lines.push('');

  for (const object of collectObjects()) {
    const known = object.moduleDir !== 'unknown';
    const modulePath = path.resolve(CORE_ROOT, object.moduleDir);
    lines.push(`## ${object.label}`);
    lines.push(`- Core module: \`${object.moduleDir}\``);
    lines.push(
      `- Core classes: ${codeList(known ? listModuleClasses(modulePath) : [])}`,
    );
    lines.push(
      `- Client methods: ${codeList([`AdtClient.${GETTER_PREFIX}${object.methodBase}`])}`,
    );
    lines.push(
      `- Core functions: ${codeList(known ? listCoreFunctions(modulePath) : [])}`,
    );
    lines.push('');
  }

  classSection(
    lines,
    'Standalone Clients',
    'Top-level client classes instantiated directly (not via `AdtClient.getXxx()`). They live under `src/clients/` alongside `AdtClient` and wrap non-`IAdtObject` surfaces.',
    listClasses(CLIENTS_ROOT, {
      recursive: false,
      skip: SKIP_STANDALONE_CLIENTS,
    }),
  );

  classSection(
    lines,
    'Runtime Classes',
    'Classes under `src/runtime/`. Most are handed out by `AdtRuntimeClient`; a class no client hands out is built with its static `create`.',
    listClasses(RUNTIME_ROOT, { recursive: true, skip: new Set() }),
  );

  return `${lines.join('\n').trimEnd()}\n`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let output = DEFAULT_OUTPUT;
  let check = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--output' && args[i + 1]) {
      output = path.resolve(args[i + 1]);
      i += 1;
    } else if (arg === '--check') {
      check = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'ADT Object Entities Generator',
          '',
          'Usage:',
          '  npm run adt:entities',
          '  npm run adt:entities -- --output docs/usage/ADT_OBJECT_ENTITIES.md',
          '  npm run check:entities   (--check: compare, write nothing)',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }

  return { output, check };
}

function main() {
  const { output, check } = parseArgs(process.argv);
  const markdown = generateMarkdown();
  const relative = path.relative(process.cwd(), output);

  if (check) {
    const committed = fs.existsSync(output)
      ? fs.readFileSync(output, 'utf-8')
      : '';
    if (committed !== markdown) {
      process.stderr.write(
        `check:entities — ${relative} is stale; run \`npm run adt:entities\` in packages/adt-clients.\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`check:entities — ${relative} matches the sources.\n`);
    return;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown, 'utf-8');
}

main();
