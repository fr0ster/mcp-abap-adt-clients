import { objectOutline, readObjectOutline } from '../results/outline';
import { answerFor } from './corpus';

/**
 * The outline reading, against the outlines recorded on premise
 * (2026-11-04) — the same answers, byte for byte apart from the names, came
 * from ABAP cloud for every kind it has.
 */
describe('objectOutline', () => {
  it('reads a class: its root, components and positions', () => {
    const outline = objectOutline(answerFor('read-outline-class'));
    expect(outline.base).toBe(
      '/sap/bc/adt/oo/classes/zmcp_d1_9e25_cl/objectstructure',
    );
    const root = outline.root;
    expect(root?.type).toBe('CLAS/OC');
    expect(root?.name).toBe('ZMCP_D1_9E25_CL');
    expect(root?.visibility).toBe('public');
    expect(root?.final).toBe(true);

    const names = root?.children.map((c) => c.name);
    expect(names).toEqual([
      'ZMCP_D1_9E25_IF',
      'TY_ROW',
      'ATTR',
      'COUNTER',
      'C_MAX',
      'DONE',
      'PUB',
      'PROT',
      'PRIV_ATTR',
      'PRIV',
      'ZMCP_D1_9E25_IF~RUN',
      'ZMCP_D1_9E25_CL',
    ]);

    const pub = root?.children.find((c) => c.name === 'PUB');
    expect(pub?.level).toBe('instance');
    expect(pub?.clifName).toBe('ZMCP_D1_9E25_CL');
    expect(pub?.links.map((l) => l.rel)).toEqual([
      'definitionIdentifier',
      'implementationIdentifier',
      'definitionBlock',
      'implementationBlock',
    ]);
    const identifier = pub?.links[0];
    expect(identifier?.source).toBe('./source/main');
    expect(identifier?.start).toEqual({ line: 12, column: 12 });
    expect(identifier?.end).toEqual({ line: 12, column: 15 });
    expect(identifier?.type).toBe('CLAS/OM');

    const counter = root?.children.find((c) => c.name === 'COUNTER');
    expect(counter?.level).toBe('static');
    expect(counter?.constant).toBe(false);
    const constant = root?.children.find((c) => c.name === 'C_MAX');
    expect(constant?.constant).toBe(true);
    expect(constant?.readOnly).toBe(true);
    const priv = root?.children.find((c) => c.name === 'PRIV');
    expect(priv?.visibility).toBe('private');
  });

  it('reads local components into the includes they point at', () => {
    const root = objectOutline(answerFor('read-outline-local-class')).root;
    const local = root?.children.find((c) => c.name === 'LCL_HELPER');
    expect(local?.unknownType ?? local?.type).toBe('CLAS/OCL');
    const help = local?.children.find((c) => c.name === 'HELP');
    expect(help?.clifName).toBe('LCL_HELPER');
    const [definition, implementation] = help?.links ?? [];
    expect(definition?.source).toBe('./includes/definitions');
    expect(definition?.start).toEqual({ line: 5, column: 12 });
    expect(implementation?.source).toBe('./includes/implementations');
    expect(implementation?.end).toEqual({ line: 3, column: 13 });
  });

  it('reads a program: targets by name, no positions', () => {
    const root = objectOutline(answerFor('read-outline-program')).root;
    expect(root?.unknownType ?? root?.type).toBe('PROG/P');
    const form = root?.children.find((c) => c.name === 'INC_FORM');
    const link = form?.links[0];
    expect(link?.source).toBe(
      '/sap/bc/adt/programs/includes/zmcp_d1_9e25_i01/source/main?context=%2fsap%2fbc%2fadt%2fprograms%2fprograms%2fzmcp_d1_9e25_pr',
    );
    expect(link?.fragment).toBe('type=PROG%2FPU;name=INC_FORM');
    expect(link?.start).toBeUndefined();
    expect(link?.end).toBeUndefined();
    const include = root?.children.find((c) => c.name === 'ZMCP_D1_9E25_I01');
    expect(include?.unknownType ?? include?.type).toBe('PROG/I');
  });

  it('reads a function group: its includes and modules', () => {
    const root = objectOutline(answerFor('read-outline-function-group')).root;
    expect(root?.name).toBe('ZMCP_D19E25');
    const kinds = root?.children.map((c) => c.unknownType ?? c.type);
    expect(kinds).toContain('FUGR/I');
    expect(kinds).toContain('FUGR/FF');
  });

  it('reads an interface', () => {
    const root = objectOutline(answerFor('read-outline-interface')).root;
    expect(root?.unknownType ?? root?.type).toBe('INTF/OI');
    expect(root?.children.length).toBeGreaterThan(0);
  });

  it('reads an exception or nothing as no root', () => {
    expect(readObjectOutline('').root).toBeUndefined();
    expect(
      readObjectOutline(
        '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"/>',
      ).root,
    ).toBeUndefined();
  });
});
