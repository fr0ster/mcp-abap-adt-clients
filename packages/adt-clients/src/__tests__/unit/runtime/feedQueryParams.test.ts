import { buildFeedQueryParams } from '../../../runtime/feeds/read';

function paramsOf(query: string): URLSearchParams {
  return new URLSearchParams(query.replace(/^\?/, ''));
}

describe('buildFeedQueryParams', () => {
  it('answers nothing for no options', () => {
    expect(buildFeedQueryParams()).toBe('');
    expect(buildFeedQueryParams({})).toBe('');
  });

  it('turns the user into a query on the attribute it is given', () => {
    expect(
      paramsOf(buildFeedQueryParams({ user: ' DEVELOPER ' })).get('$query'),
    ).toBe('and ( equals ( user , DEVELOPER ) )');
    expect(
      paramsOf(buildFeedQueryParams({ user: 'DEVELOPER' }, 'username')).get(
        '$query',
      ),
    ).toBe('and ( equals ( username , DEVELOPER ) )');
  });

  it('sends a stated query as given, and the user does not replace it', () => {
    const query =
      'and ( equals ( user , DEVELOPER ) , contains ( runtimeError , CONVT ) )';
    const params = paramsOf(
      buildFeedQueryParams({ user: 'OTHER', query, maxResults: 20 }),
    );
    expect(params.get('$query')).toBe(query);
    expect(params.get('$top')).toBe('20');
  });

  it('falls back to the user when the query is blank', () => {
    expect(
      paramsOf(buildFeedQueryParams({ user: 'DEVELOPER', query: '  ' })).get(
        '$query',
      ),
    ).toBe('and ( equals ( user , DEVELOPER ) )');
  });

  it('passes the paging bounds through', () => {
    const params = paramsOf(
      buildFeedQueryParams({ from: '20260901000000', to: '20260930235959' }),
    );
    expect(params.get('from')).toBe('20260901000000');
    expect(params.get('to')).toBe('20260930235959');
    expect(params.has('$query')).toBe(false);
  });
});
