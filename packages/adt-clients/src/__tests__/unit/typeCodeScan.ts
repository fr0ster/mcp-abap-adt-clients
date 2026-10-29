/**
 * The literal scan behind `typeCodeLiterals.test.ts`: an ADT type code in
 * production source is typed by the tables of `@mcp-abap-adt/interfaces-adt`,
 * and a code named in a comment is one of the tables' codes. Shared so every
 * package of this repository holds its own `src` to the same rule, by
 * importing this module by relative path (as `judgedScan.ts` is shared); the
 * root of the scan and the tsconfig its program is built with are the
 * caller's.
 *
 * Everything is read with the TypeScript compiler, never by a regular
 * expression over source:
 *
 * - **Code literals.** A string literal, or a template without
 *   substitutions, whose whole text has the shape of a code — four upper-case
 *   letters or digits, `/`, one to three more — or is a bare code the tables
 *   list (`AUTH`, or the object type of a listed code: `CLAS`, `PROG`,
 *   `DEVC`, …) passes only where the checker's contextual type is made of
 *   codes of the tables alone: `AdtTypeCode`, or a union of some of its
 *   members (`AdtUtilityCode`'s group-only `VIEW/DV` included). A literal
 *   used as a property name passes where the object literal's contextual
 *   type names codes only as its keys and has no index signature
 *   (`Partial<Record<AdtTypeCode, …>>`, through `satisfies`). Where the
 *   compiler types a literal by something other than a contextual type, that
 *   type is read instead: the other operand of `===` / `!==` (a comparison
 *   the compiler refuses when the literal is outside it), the expression of
 *   the `switch` a `case` is in, and, for a literal type, the constraint of
 *   the type parameter it is the type argument of — alone or in a union
 *   (`IObjectReference<'FUGR/FF'>`, `AdtCodes<'FUGR/I' | 'MSAG/NN'>`).
 *   Anything else is a finding.
 * - **Prose.** Every comment — the trivia of every token, as the compiler
 *   reads it — is searched with plain code; a word of the code shape in it
 *   must be a code of the tables, of any variant. A bare code in prose is not
 *   checked: only a listed one is recognised as a code.
 *
 * - **Inside a longer string.** A word of the code shape inside a string
 *   literal, a template without substitutions or a template's text span (an
 *   error message naming `CLAS/OC`, an XML template's `adtcore:type="FUGR/I"`)
 *   is read like prose: it must be a code of the tables.
 *
 * What is not a code but looks like one goes into the caller's allow-list,
 * with its reason; an entry that matches no finding fails too.
 */

import { readdirSync, statSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  ADT_UTILITY_CODES_BASIS_740,
  ADT_UTILITY_CODES_CLOUD,
  ADT_UTILITY_CODES_ONPREM,
} from '@mcp-abap-adt/interfaces-adt';
import * as ts from 'typescript';

/** Every code any table of interfaces-adt lists: API tables and utility tables. */
export const TABLE_CODES: ReadonlySet<string> = new Set([
  ...[ADT_TYPES_ONPREM, ADT_TYPES_CLOUD, ADT_TYPES_BASIS_740].flatMap((table) =>
    Object.values(table).flatMap((entry) =>
      'codes' in entry ? Object.keys(entry.codes) : [],
    ),
  ),
  ...[
    ADT_UTILITY_CODES_ONPREM,
    ADT_UTILITY_CODES_CLOUD,
    ADT_UTILITY_CODES_BASIS_740,
  ].flatMap((table) => Object.keys(table)),
]);

/** The bare codes: a code without `/`, and the object type of every code. */
export const BARE_CODES: ReadonlySet<string> = new Set(
  [...TABLE_CODES].map((code) => {
    const slash = code.indexOf('/');
    return slash < 0 ? code : code.slice(0, slash);
  }),
);

function isCodeCharacter(character: string | undefined): boolean {
  return (
    character !== undefined &&
    ((character >= 'A' && character <= 'Z') ||
      (character >= '0' && character <= '9'))
  );
}

function isWordCharacter(character: string | undefined): boolean {
  return (
    character !== undefined &&
    (isCodeCharacter(character) ||
      (character >= 'a' && character <= 'z') ||
      character === '_')
  );
}

/** Whether `text` as a whole has the shape `XXXX/Y`, `XXXX/YY` or `XXXX/YYY`. */
export function hasCodeShape(text: string): boolean {
  if (text.length < 6 || text.length > 8 || text[4] !== '/') return false;
  for (let index = 0; index < text.length; index += 1)
    if (index !== 4 && !isCodeCharacter(text[index])) return false;
  return true;
}

/** Whether a literal's whole text is a code: the shape, or a bare code. */
export function looksLikeCode(text: string): boolean {
  return hasCodeShape(text) || BARE_CODES.has(text);
}

/** The words of the code shape in a piece of prose, each with its offset. */
export function codeShapedWords(
  text: string,
): { word: string; offset: number }[] {
  const words: { word: string; offset: number }[] = [];
  for (let slash = 4; slash < text.length; slash += 1) {
    if (text[slash] !== '/') continue;
    const start = slash - 4;
    if (isWordCharacter(text[start - 1])) continue;
    let end = slash + 1;
    while (end < text.length && isWordCharacter(text[end])) end += 1;
    const word = text.slice(start, end);
    if (hasCodeShape(word)) words.push({ word, offset: start });
  }
  return words;
}

/** Whether a type is made of codes of the tables alone. */
function codesOnly(type: ts.Type, checker: ts.TypeChecker): boolean {
  const base =
    type.flags & ts.TypeFlags.TypeParameter
      ? checker.getBaseConstraintOfType(type)
      : type;
  if (!base) return false;
  const members = checker.getNonNullableType(base);
  const parts = members.isUnion() ? members.types : [members];
  return (
    parts.length > 0 &&
    parts.every((part) => part.isStringLiteral() && TABLE_CODES.has(part.value))
  );
}

/** Whether an object type names codes only as its keys. */
function keyedByCodes(type: ts.Type, checker: ts.TypeChecker): boolean {
  const members = checker.getNonNullableType(type);
  const parts = members.isUnion() ? members.types : [members];
  return parts.every(
    (part) =>
      checker.getIndexInfosOfType(part).length === 0 &&
      checker.getPropertiesOfType(part).length > 0 &&
      checker
        .getPropertiesOfType(part)
        .every((property) => TABLE_CODES.has(property.getName())),
  );
}

/** The operators that compare: their other operand types the literal. */
const EQUALITY: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * A literal type passes as a type argument — alone or in a union — whose
 * type parameter is constrained to codes of the tables
 * (`IObjectReference<'FUGR/FF'>`, `AdtCodes<'FUGR/I' | 'MSAG/NN'>`).
 */
function literalTypeVerdict(
  literalType: ts.LiteralTypeNode,
  checker: ts.TypeChecker,
): string | undefined {
  let node: ts.Node = literalType;
  while (
    node.parent &&
    (ts.isUnionTypeNode(node.parent) || ts.isParenthesizedTypeNode(node.parent))
  )
    node = node.parent;
  const reference = node.parent;
  if (
    reference &&
    ts.isTypeReferenceNode(reference) &&
    reference.typeArguments
  ) {
    const index = reference.typeArguments.indexOf(node as ts.TypeNode);
    const named = checker.getSymbolAtLocation(reference.typeName);
    const symbol =
      named && named.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(named)
        : named;
    const declaration = symbol?.declarations?.find(
      (
        candidate,
      ): candidate is
        | ts.TypeAliasDeclaration
        | ts.InterfaceDeclaration
        | ts.ClassDeclaration =>
        ts.isTypeAliasDeclaration(candidate) ||
        ts.isInterfaceDeclaration(candidate) ||
        ts.isClassDeclaration(candidate),
    );
    const parameter = declaration?.typeParameters?.[index];
    const constraint = parameter?.constraint
      ? checker.getTypeFromTypeNode(parameter.constraint)
      : undefined;
    if (constraint && codesOnly(constraint, checker)) return undefined;
  }
  return 'a literal type outside a type argument constrained to the code types';
}

/** Why a code literal does not pass, or `undefined` when it does. */
function literalVerdict(
  literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  checker: ts.TypeChecker,
): string | undefined {
  const parent = literal.parent;
  if (
    parent &&
    (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) &&
    parent.name === literal
  ) {
    const owner = parent.parent;
    const contextual =
      owner && ts.isObjectLiteralExpression(owner)
        ? checker.getContextualType(owner)
        : undefined;
    if (contextual && keyedByCodes(contextual, checker)) return undefined;
    return 'a property name whose object is not keyed by the code types';
  }
  if (parent && ts.isLiteralTypeNode(parent))
    return literalTypeVerdict(parent, checker);
  if (
    parent &&
    ts.isBinaryExpression(parent) &&
    EQUALITY.has(parent.operatorToken.kind)
  ) {
    const other = parent.left === literal ? parent.right : parent.left;
    const compared = checker.getTypeAtLocation(other);
    if (codesOnly(compared, checker)) return undefined;
    return `compared with ${checker.typeToString(compared)}, which is not made of codes of the tables`;
  }
  if (parent && ts.isCaseClause(parent) && parent.expression === literal) {
    const switched = checker.getTypeAtLocation(parent.parent.parent.expression);
    if (codesOnly(switched, checker)) return undefined;
    return `a case of a switch over ${checker.typeToString(switched)}, which is not made of codes of the tables`;
  }
  const contextual = checker.getContextualType(literal);
  if (!contextual) return 'no contextual type';
  if (codesOnly(contextual, checker)) return undefined;
  return `contextual type ${checker.typeToString(contextual)} is not made of codes of the tables`;
}

/**
 * The name of the type alias a literal's contextual type is, or whose
 * declaration it is a member of, if any: a
 * literal typed by a vocabulary that looks like codes and is not one
 * (`AbapUnitRunObjectType`) is allowed once, by the type's name, not per
 * literal.
 */
function contextualAlias(
  literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  checker: ts.TypeChecker,
): string | undefined {
  // A member of the alias's own declaration: `type X = 'A' | 'B'`.
  if (literal.parent && ts.isLiteralTypeNode(literal.parent)) {
    let node: ts.Node = literal.parent;
    while (
      node.parent &&
      (ts.isUnionTypeNode(node.parent) ||
        ts.isParenthesizedTypeNode(node.parent))
    )
      node = node.parent;
    return node.parent &&
      ts.isTypeAliasDeclaration(node.parent) &&
      node.parent.type === node
      ? node.parent.name.text
      : undefined;
  }
  const contextual = checker.getContextualType(literal);
  const alias = contextual
    ? checker.getNonNullableType(contextual).aliasSymbol
    : undefined;
  return alias?.getName();
}

export interface ITypeCodeFinding {
  /**
   * `<file relative to the root>:<literal or word>` — the allow-list key; for
   * a literal whose contextual type is a type alias, `type:<alias>`.
   */
  readonly key: string;
  /** The finding as listed: file, line, text and why. */
  readonly line: string;
}

function finding(
  root: string,
  source: ts.SourceFile,
  position: number,
  text: string,
  why: string,
  linesInto = 0,
): ITypeCodeFinding {
  const file = relative(root, source.fileName);
  const { line } = source.getLineAndCharacterOfPosition(position);
  return {
    key: `${file}:${text}`,
    line: `${file}:${line + 1 + linesInto} '${text}' — ${why}`,
  };
}

/** The line breaks in `text` before `offset`: the line of a word inside a literal. */
function newlinesBefore(text: string, offset: number): number {
  let count = 0;
  for (let index = 0; index < offset; index += 1)
    if (text[index] === '\n') count += 1;
  return count;
}

/** The findings of one source file: its code literals and its comments. */
function findingsOf(
  root: string,
  source: ts.SourceFile,
  checker: ts.TypeChecker,
): ITypeCodeFinding[] {
  const findings: ITypeCodeFinding[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      looksLikeCode(node.text) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExportDeclaration(node.parent)
    ) {
      const why = literalVerdict(node, checker);
      if (why !== undefined) {
        const typed = finding(
          root,
          source,
          node.getStart(source),
          node.text,
          why,
        );
        const alias = contextualAlias(node, checker);
        findings.push(
          alias === undefined ? typed : { ...typed, key: `type:${alias}` },
        );
      }
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      // A code inside a longer text — a message, an XML template's span —
      // is read like prose: it must be a code of the tables.
      const start = node.getStart(source);
      for (const { word, offset } of codeShapedWords(node.text))
        if (!TABLE_CODES.has(word))
          findings.push(
            finding(
              root,
              source,
              start,
              word,
              'inside a string, not a code of the tables',
              newlinesBefore(node.text, offset),
            ),
          );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  for (const comment of commentRangesOf(source)) {
    const text = source.text.slice(comment.pos, comment.end);
    for (const { word, offset } of codeShapedWords(text))
      if (!TABLE_CODES.has(word))
        findings.push(
          finding(
            root,
            source,
            comment.pos + offset,
            word,
            'named in a comment, not a code of the tables',
          ),
        );
  }
  return findings;
}

/**
 * The comments of a source file: the leading and trailing trivia of every
 * token, read through the compiler, each comment once.
 */
function commentRangesOf(source: ts.SourceFile): ts.CommentRange[] {
  const comments: ts.CommentRange[] = [];
  const seen = new Set<number>();
  const collect = (ranges: ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      comments.push(range);
    }
  };
  const visit = (node: ts.Node): void => {
    collect(ts.getLeadingCommentRanges(source.text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(source.text, node.getEnd()));
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  return comments;
}

/** Production source under a directory: `.ts`, outside tests and fixtures. */
export function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory())
      return name.startsWith('__') || name.includes('fixture')
        ? []
        : productionFiles(full);
    return name.endsWith('.ts') && !name.endsWith('.d.ts') ? [full] : [];
  });
}

/**
 * Every finding of the scan over `files`, typed through `tsconfig`.
 * `virtual` adds in-memory files (path → text), for the scan's own tests.
 */
export function typeCodeFindings(
  root: string,
  tsconfig: string,
  files: readonly string[],
  virtual: ReadonlyMap<string, string> = new Map(),
): ITypeCodeFinding[] {
  const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(tsconfig),
  );
  const options = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (name) => virtual.get(name) ?? readFile(name);
  host.fileExists = (name) => virtual.has(name) || fileExists(name);
  host.getSourceFile = (name, language, ...rest) => {
    const text = virtual.get(name);
    return text !== undefined
      ? ts.createSourceFile(name, text, language, true)
      : getSourceFile(name, language, ...rest);
  };
  const roots = [...files, ...virtual.keys()];
  const program = ts.createProgram(roots, options, host);
  const checker = program.getTypeChecker();
  return roots.flatMap((file) => {
    const source = program.getSourceFile(file);
    return source ? findingsOf(root, source, checker) : [];
  });
}
