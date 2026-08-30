/**
 * What a Markdown document imports, read by the TypeScript parser.
 *
 * This exists because reading imports with a regular expression kept being
 * wrong, and each time in a way that made a line *invisible* rather than
 * mis-parsed — which a gate reports as success. Three found by review, in the
 * same matcher: `import type { … }` unread; a specifier in double quotes
 * unread; and before those, names measured against the wrong package. A fourth
 * was waiting in any import wrapped across lines.
 *
 * So the extraction is no longer a pattern over prose. Each fenced TypeScript
 * block is parsed as TypeScript, and the import declarations are read from the
 * syntax tree. Quoting, line breaks, `type` modifiers, aliases and
 * import-looking text inside comments or strings are then the parser's problem,
 * and it already knows the answers.
 *
 * Only *named* bindings are reported: `import X from` and `import * as X` bind
 * a name the consumer chooses, and there is nothing in them to check against a
 * package's export list.
 */

const ts = require('typescript');

/** Fenced blocks that hold TypeScript, with the line each one starts on. */
function typescriptBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let inside = null;

  lines.forEach((line, index) => {
    const fence = /^\s*```+\s*([A-Za-z0-9_-]*)\s*$/.exec(line);
    if (!fence) {
      if (inside) inside.body.push(line);
      return;
    }
    if (inside) {
      blocks.push({
        text: inside.body.join('\n'),
        startLine: inside.startLine,
      });
      inside = null;
      return;
    }
    const language = fence[1].toLowerCase();
    if (language === 'ts' || language === 'typescript' || language === 'tsx') {
      // +2: the fence line itself is 1-based, the body starts after it.
      inside = { body: [], startLine: index + 2 };
    }
  });

  // An unterminated fence still holds code worth checking.
  if (inside) {
    blocks.push({ text: inside.body.join('\n'), startLine: inside.startLine });
  }
  return blocks;
}

/**
 * Every named import in a document.
 *
 * @param {string} markdown
 * @returns {Array<{specifier: string, names: string[], line: number}>}
 */
function importsIn(markdown) {
  const found = [];

  for (const block of typescriptBlocks(markdown)) {
    // A doc snippet is a fragment, so parse errors are expected and ignored;
    // the parser still yields the import declarations it did understand.
    const source = ts.createSourceFile(
      'snippet.ts',
      block.text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;

      const names = bindings.elements.map((element) =>
        // `X as Y` imports X; the local alias is the consumer's business.
        (element.propertyName ?? element.name).getText(source),
      );
      if (names.length === 0) continue;

      const within = source.getLineAndCharacterOfPosition(
        statement.getStart(source),
      ).line;
      found.push({
        specifier: statement.moduleSpecifier.text,
        names,
        line: block.startLine + within,
      });
    }
  }

  return found;
}

module.exports = { importsIn, typescriptBlocks };
