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

const MarkdownIt = require('markdown-it');
const ts = require('typescript');

const fenceParser = new MarkdownIt();

/** Languages whose fenced blocks are TypeScript for our purposes. */
const TYPESCRIPT_LANGUAGES = new Set(['ts', 'typescript', 'tsx']);

/**
 * Fenced blocks that hold TypeScript, with the line each one starts on.
 *
 * The fences are found by a Markdown parser, not by matching lines. The
 * hand-rolled version this replaces read only a backtick fence whose info
 * string was a bare language word, so `~~~typescript` and
 * ```` ```ts title="example" ```` never reached the TypeScript parser at all —
 * the same failure as the import matcher it was written to replace, one line
 * higher up. CommonMark also allows fences longer than three characters and
 * indented by up to three spaces, and fences nested in lists and blockquotes;
 * all of that is the parser's business.
 *
 * The info string's first word names the language, per CommonMark, so
 * `ts title="example"` is TypeScript.
 */
function typescriptBlocks(source) {
  const blocks = [];

  for (const token of fenceParser.parse(source, {})) {
    if (token.type !== 'fence' || !token.map) continue;
    const language = token.info.trim().split(/\s+/)[0].toLowerCase();
    if (!TYPESCRIPT_LANGUAGES.has(language)) continue;
    // `map[0]` is the 0-based line of the opening fence; the body starts on
    // the next one, and the report is 1-based.
    blocks.push({ text: token.content, startLine: token.map[0] + 2 });
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
