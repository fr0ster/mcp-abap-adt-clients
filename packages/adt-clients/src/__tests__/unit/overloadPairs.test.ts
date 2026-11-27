/**
 * D3 of #304: every member generic in its failure type — an `E extends
 * IAdtError = IAdtError` type parameter — is declared as the interfaces'
 * overload pair, in front of its implementation:
 *
 * - a generic one, `<…, E extends IAdtError>`, whose options name
 *   `analyse: IAnalyse<E>` and whose answer is `E | IAdtError` (C3);
 * - then a plain one, with no `E`, answering the library's own failure.
 *
 * A member with overloads of its own (one per `wait`, an upsert and a
 * removal) has the pair for each. The implementation answers `E | IAdtError`.
 * An abstract member is the pair itself.
 *
 * Checked over the source (tests excluded) with the TypeScript parser.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

const SRC = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__') return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

type Declaration = ts.MethodDeclaration | ts.FunctionDeclaration;

const isDeclaration = (node: ts.Node): node is Declaration =>
  ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node);

/** The failure bases: the library's, and abapGit's new forms' (`FactsAnswer`). */
const BASES = new Set(['IAdtError', 'IAbapGitStructuredError']);

/** The failure type parameter, `E extends <base>`, with its default when given. */
function failureParameter(
  node: Declaration,
  sf: ts.SourceFile,
): ts.TypeParameterDeclaration | undefined {
  return node.typeParameters?.find(
    (tp) => tp.name.text === 'E' && BASES.has(tp.constraint?.getText(sf) ?? ''),
  );
}

/** Whether `E` reaches the declaration through an argument typed `X<…E…>`. */
const takesE = (node: Declaration, sf: ts.SourceFile) =>
  node.parameters.some((p) => /[<,]\s*E\s*[>,]/.test(textOf(p.type, sf)));

/** What the generic overload answers: abapGit's through its `FactsAnswer`. */
const answersBoth = (node: Declaration, sf: ts.SourceFile) => {
  const answer = textOf(node.type, sf);
  return (
    answer.includes('E | IAdtError') ||
    answer.includes('E | IAbapGitStructuredError') ||
    answer.startsWith('FactsAnswer<')
  );
};

const textOf = (node: ts.Node | undefined, sf: ts.SourceFile) =>
  (node?.getText(sf) ?? '').replace(/\s+/g, ' ');

/** What is wrong with one generic overload and the plain one after it. */
function pairProblems(
  generic: Declaration | undefined,
  plain: Declaration | undefined,
  sf: ts.SourceFile,
): string[] {
  const problems: string[] = [];
  const e = generic && failureParameter(generic, sf);
  if (!generic || !e) return ['no generic overload'];
  if (e.default) problems.push('the generic overload defaults E');
  if (
    !generic.parameters.some((p) => {
      const type = textOf(p.type, sf);
      // In the options, or the argument itself (a helper's `analyse`).
      const own =
        p.name.getText(sf) === 'analyse' &&
        !p.questionToken &&
        (type === 'IAnalyse<E>' || /^IAbapGitFactsAnalyse<.*, E>$/.test(type));
      return (
        own ||
        type.includes('analyse: IAnalyse<E>') ||
        /analyse: IAbapGitFactsAnalyse<.*, E>/.test(type)
      );
    })
  )
    problems.push('the generic overload does not require analyse');
  if (!answersBoth(generic, sf))
    problems.push('the generic overload does not answer E | IAdtError');
  if (!plain || plain.body) return [...problems, 'no plain overload'];
  if (failureParameter(plain, sf))
    problems.push('the plain overload is generic in E');
  return problems;
}

function findings(): string[] {
  const out: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const sf = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const where = (node: ts.Node) =>
      `${relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    const check = (siblings: readonly ts.Node[]): void => {
      siblings.forEach((node, i) => {
        if (!isDeclaration(node)) return;
        const e = failureParameter(node, sf);
        const name = node.name?.getText(sf);
        // An implementation, or an abstract member's group: the declarations
        // of the same name right before it.
        const isAbstract = (node.modifiers ?? []).some(
          (m) => m.kind === ts.SyntaxKind.AbstractKeyword,
        );
        const last =
          node.body !== undefined ||
          (isAbstract &&
            !(
              isDeclaration(siblings[i + 1] ?? node) &&
              siblings[i + 1] !== undefined &&
              (siblings[i + 1] as Declaration).name?.getText(sf) === name
            ));
        if (!last) return;
        const group: Declaration[] = [];
        for (let k = node.body ? i - 1 : i; k >= 0; k--) {
          const prev = siblings[k];
          if (
            !prev ||
            !isDeclaration(prev) ||
            prev.body ||
            prev.name?.getText(sf) !== name
          )
            break;
          group.unshift(prev);
        }
        const generic = group.some((d) => failureParameter(d, sf));
        // Only a failure type a caller may leave out (`E = IAdtError`), given
        // through an argument: a builder (`failed(error: E)`) is not one.
        if (!(e?.default && takesE(node, sf)) && !generic) return;
        if (node.body && !answersBoth(node, sf))
          out.push(
            `${where(node)} ${name}: the implementation does not answer E | IAdtError`,
          );
        if (group.length === 0 || group.length % 2 !== 0) {
          out.push(`${where(node)} ${name}: not declared as overload pairs`);
          return;
        }
        for (let k = 0; k < group.length; k += 2)
          for (const problem of pairProblems(group[k], group[k + 1], sf))
            out.push(`${where(group[k] ?? node)} ${name}: ${problem}`);
      });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isClassLike(node)) check(node.members);
      if (ts.isSourceFile(node)) check(node.statements);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

describe('a member generic in its failure is the overload pair', () => {
  it('generic with analyse required, then plain, for every such member', () => {
    expect(findings()).toEqual([]);
  });
});
