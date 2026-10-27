import { findingsOutside } from '../../helpers/atcFindings';

/** A worklist with one finding per location, as ADT writes the attribute. */
function worklist(...locations: string[]): string {
  return locations
    .map((l) => `<atcfinding:finding atcfinding:location="${l}"/>`)
    .join('');
}

describe('findingsOutside', () => {
  it('counts a finding in another include of the program as outside', () => {
    const w = worklist(
      '/sap/bc/adt/programs/includes/zaber_alv_report_cli/source/main?context=%2fsap%2fbc%2fadt%2fprograms%2fprograms%2fzaber_alv_report#start=12,0',
      '/sap/bc/adt/programs/includes/zaber_alv_report_top/source/main#start=3,0',
    );
    expect(
      findingsOutside(w, '/sap/bc/adt/programs/includes/zaber_alv_report_top'),
    ).toEqual([
      '/sap/bc/adt/programs/includes/zaber_alv_report_cli/source/main?context=%2fsap%2fbc%2fadt%2fprograms%2fprograms%2fzaber_alv_report#start=12,0',
    ]);
  });

  it('keeps a namespaced include inside, whatever the escape case', () => {
    const w = worklist(
      '/sap/bc/adt/programs/includes/%2fnsp%2fzinc/source/main#start=1,0',
    );
    expect(
      findingsOutside(w, '/sap/bc/adt/programs/includes/%2Fnsp%2Fzinc'),
    ).toEqual([]);
  });

  it('tells one class include from another of the same class', () => {
    const w = worklist(
      '/sap/bc/adt/oo/classes/zcl_x/includes/implementations#start=5,0',
    );
    expect(
      findingsOutside(w, '/sap/bc/adt/oo/classes/zcl_x/includes/testclasses'),
    ).toHaveLength(1);
  });

  it('does not take an include whose name only starts the same as inside', () => {
    const w = worklist(
      '/sap/bc/adt/programs/includes/zinc_top2/source/main#start=1,0',
    );
    expect(
      findingsOutside(w, '/sap/bc/adt/programs/includes/zinc_top'),
    ).toHaveLength(1);
  });
});
