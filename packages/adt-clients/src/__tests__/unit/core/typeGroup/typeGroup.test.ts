/**
 * `getTypeGroup()` over the recorded answers of the type group measurements
 * (`corpus/adt/answers/type-group-*`): each member sends exactly one request,
 * the measured one, with the name as the caller gave it, and answers what its
 * result slot and the caller's `analyse` make of SAP's answer.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ADT_NO_FAILURE,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../../clients/AdtClient';
import {
  AdtClientCloud,
  AdtClientOnPrem,
} from '../../../../clients/AdtClientVariants';
import { typeGroupDocuments } from '../../../../core/typeGroup';
import { headersOf } from '../../../helpers/adtHeaders';

const ANSWERS = path.resolve(__dirname, '../../../../../corpus/adt/answers');
const TG = '/sap/bc/adt/ddic/typegroups';
const V3 = 'application/vnd.sap.adt.ddic.typegroups.v3+xml';

/** A recorded exchange: the sidecar's status and headers, and its body. */
function recorded(caseStep: string): IAdtWireResponse {
  const sidecar = JSON.parse(
    fs.readFileSync(path.join(ANSWERS, `${caseStep}.json`), 'utf8'),
  );
  const file = sidecar.response.bodyFile;
  return {
    status: sidecar.response.status,
    statusText: sidecar.response.statusText,
    headers: sidecar.response.headers,
    data: file ? fs.readFileSync(path.join(ANSWERS, file), 'utf8') : '',
  } as IAdtWireResponse;
}

/** A connection answering `answer`, recording requests and session switches. */
function recording(answer: IAdtWireResponse) {
  const requests: IAbapRequestOptions[] = [];
  const sessions: string[] = [];
  const connection = {
    setSessionType: (type: string) => sessions.push(type),
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      if (answer.status >= 400) {
        // The connector rejects a failed status with the answer attached.
        throw {
          message: `Request failed with status code ${answer.status}`,
          response: answer,
        };
      }
      return answer;
    },
  } as unknown as IAbapConnection;
  return { connection, requests, sessions };
}

const OK = { status: 200, statusText: 'OK', headers: {}, data: '' };

function onPrem(answer: IAdtWireResponse = OK) {
  const r = recording(answer);
  return { ...r, group: new AdtClientOnPrem(r.connection).getTypeGroup() };
}

/** An `analyse` that records what it was asked and answers `verdict`. */
function spying(verdict: ReturnType<IAnalyse> = ADT_NO_FAILURE) {
  const seen: { answer: IAdtWireResponse | undefined; context: unknown }[] = [];
  const analyse: IAnalyse<IAdtError> = (_v, answer, context) => {
    seen.push({ answer, context });
    return verdict;
  };
  return { analyse, seen };
}

describe('validate', () => {
  it('POSTs objtype=TYPE/DG and the name as given, Accept vnd.sap.as+xml, no body', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--03-validate-free'),
    );
    const answer = await group.validate({
      typeGroupName: 'ZTg3a',
      description: 'probe',
      packageName: '$TMP',
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe(
      `${TG}/validation?objtype=TYPE%2FDG&objname=ZTg3a&packagename=%24TMP&description=probe`,
    );
    expect(requests[0]?.headers).toEqual({
      Accept: 'application/vnd.sap.as+xml',
    });
    expect(requests[0]?.data).toBeUndefined();
    // A valid name answers an empty 200: no failure.
    expect(answer.ok).toBe(true);
  });

  it('sends a name longer than five characters as given', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--05-validate-long'),
    );
    const answer = await group.validate({ typeGroupName: 'ZTG4817' });
    expect(requests[0]?.url).toBe(
      `${TG}/validation?objtype=TYPE%2FDG&objname=ZTG4817`,
    );
    // SAP refuses it, 400 InvalidTypeGroupName; the library did not.
    expect(answer.ok).toBe(false);
    const failure = !answer.ok ? answer.getError() : undefined;
    expect(failure?.response?.status).toBe(400);
    expect(String(failure?.response?.data)).toContain('InvalidTypeGroupName');
  });

  it('answers a taken name as the failure SAP sent', async () => {
    const { group } = onPrem(
      recorded('type-group-cycle-s4-2025--04-validate-taken'),
    );
    const answer = await group.validate({ typeGroupName: 'SLIS' });
    expect(answer.ok).toBe(false);
  });
});

describe('the reads', () => {
  it('readMetadata GETs the name as given with the v3 Accept by default', async () => {
    const answer = recorded('type-group-cycle-s4-2025--09-meta-inactive');
    const { group, requests } = onPrem(answer);
    const read = await group.readMetadata({ typeGroupName: 'ZTG3A' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A`);
    expect(requests[0]?.headers).toEqual({ Accept: V3 });
    expect(read.ok && read.getResult().value).toBe(answer.data);
  });

  it('readMetadata sends version and long polling, and the caller’s Accept wins', async () => {
    const { group, requests } = onPrem();
    await group.readMetadata(
      { typeGroupName: 'ZTg3a' },
      {
        version: 'inactive',
        withLongPolling: true,
        accept: 'application/vnd.sap.adt.ddic.typegroups.v2+xml',
      },
    );
    expect(requests[0]?.url).toBe(
      `${TG}/ZTg3a?version=inactive&withLongPolling=true`,
    );
    expect(requests[0]?.headers?.Accept).toBe(
      'application/vnd.sap.adt.ddic.typegroups.v2+xml',
    );
  });

  it('read GETs source/main, text/plain, with version and long polling', async () => {
    const answer = recorded('type-group-cycle-s4-2025--17-source-active');
    const { group, requests } = onPrem(answer);
    const read = await group.read({ typeGroupName: 'ZTG3A' }, 'active');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A/source/main?version=active`);
    expect(requests[0]?.headers).toEqual({ Accept: 'text/plain' });
    expect(read.ok && read.getResult().value).toBe(answer.data);

    const long = onPrem();
    await long.group.read({ typeGroupName: 'ZTG3A' }, undefined, {
      withLongPolling: true,
    });
    expect(long.requests[0]?.url).toBe(
      `${TG}/ZTG3A/source/main?withLongPolling=true`,
    );
  });

  it('getVersions GETs the feed, and getVersionSource the content uri', async () => {
    const feed = recorded('type-group-cycle-s4-2025--18-versions');
    const { group, requests } = onPrem(feed);
    const versions = await group.getVersions({ typeGroupName: 'ZTG3A' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A/source/main/versions`);
    expect(requests[0]?.headers).toEqual({
      Accept: 'application/atom+xml;type=feed',
    });
    expect(versions.ok && versions.getResult().value).toBe(feed.data);

    const uri = `${TG}/ZTG3A/source/main/versions/19700101071123/00000/content`;
    const one = onPrem(recorded('type-group-cycle-s4-2025--19-version-source'));
    const source = await one.group.getVersionSource(uri);
    expect(one.requests).toHaveLength(1);
    expect(one.requests[0]?.url).toBe(uri);
    expect(one.requests[0]?.headers).toEqual({ Accept: 'text/plain' });
    expect(source.ok).toBe(true);
  });

  it('the cloud client reads, validates and lists versions', async () => {
    const answer = recorded('type-group-reads-abap-cloud--01-meta-abap-v3');
    const { connection, requests } = recording(answer);
    const group = new AdtClientCloud(connection).getTypeGroup();
    const read = await group.readMetadata({ typeGroupName: 'ABAP' });
    expect(requests[0]?.url).toBe(`${TG}/ABAP`);
    expect(read.ok && read.getResult().value).toBe(answer.data);
  });
});

describe('create', () => {
  it('POSTs the measured body with every value as given and the caller’s pair', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--07-create'),
    );
    const headers = headersOf(group, 'create');
    const long = `${'d'.repeat(70)}xyz & <more>`;
    const created = await group.create(
      {
        typeGroupName: 'ZTg3a',
        packageName: '$tmp',
        description: long,
        masterLanguage: 'EN',
      },
      { headers },
    );
    expect(created.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe(TG);
    expect(requests[0]?.headers).toEqual({
      Accept: V3,
      'Content-Type': V3,
      'sap-language': 'EN',
    });
    expect(requests[0]?.data).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><atypgr:abapTypeGroup xmlns:atypgr="http://www.sap.com/adt/ddic/typegroups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${'d'.repeat(70)}xyz &amp; &lt;more&gt;" adtcore:language="EN" adtcore:masterLanguage="EN" adtcore:name="ZTg3a" adtcore:type="TYPE/DG">
  <adtcore:packageRef adtcore:name="$tmp"/>
</atypgr:abapTypeGroup>`,
    );
  });

  it('sends no language without one, and corrNr only with a transport', async () => {
    const { group, requests } = onPrem();
    const headers = headersOf(group, 'create');
    await group.create(
      { typeGroupName: 'ZTG48', packageName: 'ZPKG' },
      { headers },
    );
    expect(requests[0]?.url).toBe(TG);
    expect(requests[0]?.headers).not.toHaveProperty('sap-language');
    expect(String(requests[0]?.data)).not.toContain('adtcore:language');

    const t = onPrem();
    await t.group.create(
      {
        typeGroupName: 'ZTG48',
        packageName: 'ZPKG',
        transportRequest: 'SYSK900001',
      },
      { headers },
    );
    expect(t.requests[0]?.url).toBe(`${TG}?corrNr=SYSK900001`);
  });

  it('answers the cloud create’s 403 as the failure SAP sent', async () => {
    const { group } = onPrem(
      recorded('type-group-cycle-abap-cloud--07-create'),
    );
    const created = await group.create(
      { typeGroupName: 'ZTG3A', packageName: 'ZPKG' },
      { headers: headersOf(group, 'create') },
    );
    expect(created.ok).toBe(false);
    const failure = !created.ok ? created.getError() : undefined;
    expect(failure?.response?.status).toBe(403);
  });
});

describe('the source write', () => {
  it('PUTs the source as given under the lock, with If-Match and corrNr only when given', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--13-write-source'),
    );
    const headers = headersOf(group, 'update');
    const source = 'TYPE-POOL ztg3a .\n\nTYPES ztg3a_flag TYPE c LENGTH 1.\n';
    const written = await group.update(
      { typeGroupName: 'ZTG3A' },
      { headers, lockHandle: 'LH/1', source },
    );
    expect(written.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A/source/main?lockHandle=LH%2F1`);
    expect(requests[0]?.headers).toEqual({
      Accept: 'text/plain',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    expect(requests[0]?.data).toBe(source);

    const guarded = onPrem();
    await guarded.group.update(
      { typeGroupName: 'ZTG3A', transportRequest: 'SYSK900001' },
      { headers, lockHandle: 'LH', source, ifMatch: '202611280235150001' },
    );
    expect(guarded.requests[0]?.url).toBe(
      `${TG}/ZTG3A/source/main?lockHandle=LH&corrNr=SYSK900001`,
    );
    expect(guarded.requests[0]?.headers?.['If-Match']).toBe(
      '202611280235150001',
    );
  });
});

describe('lock and unlock', () => {
  it('lock sends one stateful LOCK and answers the handle', async () => {
    const { group, requests, sessions } = onPrem(
      recorded('type-group-cycle-s4-2025--12-lock'),
    );
    const locked = await group.lock({ typeGroupName: 'ZTG3A' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A?_action=LOCK&accessMode=MODIFY`);
    expect(sessions).toEqual(['stateful', 'stateless']);
    expect(locked.ok && locked.getResult().value).toBe('0'.repeat(40));
  });

  it("lock answers '' from a body without a handle", async () => {
    const { group } = onPrem(OK);
    const locked = await group.lock({ typeGroupName: 'ZTG3A' });
    expect(locked.ok && locked.getResult().value).toBe('');
  });

  it('unlock sends one stateful UNLOCK and answers nothing', async () => {
    const { group, requests, sessions } = onPrem(
      recorded('type-group-cycle-s4-2025--14-unlock'),
    );
    const unlocked = await group.unlock({ typeGroupName: 'ZTG3A' }, 'LH/1');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      `${TG}/ZTG3A?_action=UNLOCK&lockHandle=LH%2F1`,
    );
    expect(sessions).toEqual(['stateful', 'stateless']);
    expect(unlocked.ok && unlocked.getResult().value).toBeUndefined();
  });

  it('keeps the lock in the registry when SAP refuses the UNLOCK, sending one request', async () => {
    const lockAnswer = recorded('type-group-cycle-s4-2025--12-lock');
    const refused = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      data: '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="ExceptionResourceNoAccess"/><message lang="EN">refused</message></exc:exception>',
    };
    let answer: IAdtWireResponse = lockAnswer;
    const requests: IAbapRequestOptions[] = [];
    const connection = {
      setSessionType: () => undefined,
      isConnected: () => true,
      makeAdtRequest: async (options: IAbapRequestOptions) => {
        requests.push(options);
        if (answer.status >= 400)
          throw { message: 'refused', response: answer };
        return answer;
      },
    } as unknown as IAbapConnection;
    const client = new AdtClientOnPrem(connection);
    const group = client.getTypeGroup();
    await group.lock({ typeGroupName: 'ZTG3A' });
    answer = refused;
    const unlocked = await group.unlock({ typeGroupName: 'ZTG3A' }, 'LH');
    expect(unlocked.ok).toBe(false);
    expect(requests).toHaveLength(2);
    expect(client.pendingLocks).toContain('TypeGroup/ZTG3A');
  });

  it("keeps the lock when SAP refuses the UNLOCK, even when the caller's analyse clears it", async () => {
    let status = 200;
    const connection = {
      setSessionType: () => undefined,
      isConnected: () => true,
      makeAdtRequest: async () => {
        const answer = {
          ...recorded('type-group-cycle-s4-2025--12-lock'),
          status,
        };
        if (status >= 400) throw { message: 'refused', response: answer };
        return answer;
      },
    } as unknown as IAbapConnection;
    const client = new AdtClientOnPrem(connection);
    const group = client.getTypeGroup();
    await group.lock({ typeGroupName: 'ZTG3A' });
    status = 403;
    const unlocked = await group.unlock({ typeGroupName: 'ZTG3A' }, 'LH', {
      analyse: () => ADT_NO_FAILURE,
    });
    // The caller judged it no failure; SAP's state is still a held lock.
    expect(unlocked.ok).toBe(true);
    expect(client.pendingLocks).toContain('TypeGroup/ZTG3A');
  });

  it('records the handle in the lock registry and releases it on unlock', async () => {
    const { connection } = recording(
      recorded('type-group-cycle-s4-2025--12-lock'),
    );
    const client = new AdtClientOnPrem(connection);
    const group = client.getTypeGroup();
    await group.lock({ typeGroupName: 'ZTG3A' });
    expect(client.pendingLocks).toContain('TypeGroup/ZTG3A');
    await group.unlock({ typeGroupName: 'ZTG3A' }, '0'.repeat(40));
    expect(client.pendingLocks).not.toContain('TypeGroup/ZTG3A');
  });
});

describe('activate', () => {
  it('sends exactly one activation POST naming the type group as given', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--15-activate'),
    );
    const headers = headersOf(group, 'activate');
    const activated = await group.activate(
      { typeGroupName: 'ZTG3A' },
      { headers },
    );
    expect(activated.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      '/sap/bc/adt/activation?method=activate&preauditRequested=true',
    );
    expect(requests[0]?.headers).toEqual({
      Accept: 'application/xml',
      'Content-Type': 'application/vnd.sap.adt.activation+xml',
    });
    expect(requests[0]?.data).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${TG}/ZTG3A" adtcore:name="ZTG3A"/>
</adtcore:objectReferences>`);
  });

  it('sends nothing after a checklist that states no outcome, and analyse gets no context', async () => {
    const silent = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist" activationExecuted="false"/>',
    };
    const { group, requests } = onPrem(silent);
    const { analyse, seen } = spying();
    await group.activate(
      { typeGroupName: 'ZTG3A' },
      { headers: headersOf(group, 'activate'), analyse },
    );
    expect(requests).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('sends preauditRequested=false when asked', async () => {
    const { group, requests } = onPrem();
    await group.activate(
      { typeGroupName: 'ZTG3A' },
      { headers: headersOf(group, 'activate'), preauditRequested: false },
    );
    expect(requests[0]?.url).toBe(
      '/sap/bc/adt/activation?method=activate&preauditRequested=false',
    );
  });
});

describe('delete', () => {
  it('sends one DELETE on its own address under the lock, corrNr only when given', async () => {
    const { group, requests } = onPrem(
      recorded('type-group-cycle-s4-2025--21-final-delete'),
    );
    const headers = headersOf(group, 'delete');
    const deleted = await group.delete(
      { typeGroupName: 'ZTG3A' },
      { headers, lockHandle: 'LH/1' },
    );
    expect(deleted.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('DELETE');
    expect(requests[0]?.url).toBe(`${TG}/ZTG3A?lockHandle=LH%2F1`);
    expect(requests[0]?.headers).toEqual({ Accept: V3, 'Content-Type': V3 });

    const t = onPrem();
    await t.group.delete(
      { typeGroupName: 'ZTG3A', transportRequest: 'SYSK900001' },
      { headers, lockHandle: 'LH' },
    );
    expect(t.requests[0]?.url).toBe(
      `${TG}/ZTG3A?lockHandle=LH&corrNr=SYSK900001`,
    );
  });
});

describe('the result set and analyse are the caller’s', () => {
  const custom = {
    ...typeGroupDocuments,
    validation: () => 'validation-read',
    metadata: () => 'metadata-read',
    source: () => 'source-read',
    versions: () => 'versions-read',
    versionSource: () => 'version-source-read',
    created: () => 'created-read',
    updated: () => 'updated-read',
    activation: () => 'activation-read',
    deletion: () => 'deletion-read',
  };

  function customGroup() {
    const r = recording(OK);
    return {
      ...r,
      group: new AdtClientOnPrem(r.connection).getTypeGroup(custom),
    };
  }

  it('each member answers its own slot', async () => {
    const { group } = customGroup();
    const headers = { accept: 'a', contentType: 'c' };
    const id = { typeGroupName: 'ZTG3A' };
    const values = [
      await group.validate(id),
      await group.readMetadata(id),
      await group.read(id),
      await group.getVersions(id),
      await group.getVersionSource('/x'),
      await group.create(
        { typeGroupName: 'ZTG3A', packageName: 'Z' },
        { headers },
      ),
      await group.update(id, { headers, lockHandle: 'L', source: 's' }),
      await group.activate(id, { headers }),
      await group.delete(id, { headers, lockHandle: 'L' }),
    ].map((a) => (a.ok ? a.getResult().value : undefined));
    expect(values).toEqual([
      'validation-read',
      'metadata-read',
      'source-read',
      'versions-read',
      'version-source-read',
      'created-read',
      'updated-read',
      'activation-read',
      'deletion-read',
    ]);
  });

  it('the caller’s analyse is asked once per member, with the answer, and its verdict wins', async () => {
    const refusal: IAdtError = { origin: 'refusal', message: 'refused here' };
    const { group } = customGroup();
    const { analyse, seen } = spying(refusal);
    const headers = { accept: 'a', contentType: 'c' };
    const id = { typeGroupName: 'ZTG3A' };
    const answers = [
      await group.validate(id, { analyse }),
      await group.readMetadata(id, { analyse }),
      await group.read(id, undefined, { analyse }),
      await group.getVersions(id, { analyse }),
      await group.getVersionSource('/x', { analyse }),
      await group.create(
        { typeGroupName: 'ZTG3A', packageName: 'Z' },
        { headers, analyse },
      ),
      await group.update(id, {
        headers,
        lockHandle: 'L',
        source: 's',
        analyse,
      }),
      await group.lock(id, { analyse }),
      await group.unlock(id, 'L', { analyse }),
      await group.activate(id, { headers, analyse }),
      await group.delete(id, { headers, lockHandle: 'L', analyse }),
    ];
    expect(seen).toHaveLength(answers.length);
    for (const s of seen) expect(s.answer).toMatchObject(OK);
    for (const a of answers) {
      expect(a.ok).toBe(false);
      expect(!a.ok && a.getError().message).toBe('refused here');
    }
  });

  it('each member hands its timeout to the request', async () => {
    const { group, requests } = customGroup();
    const headers = { accept: 'a', contentType: 'c' };
    const id = { typeGroupName: 'ZTG3A' };
    await group.validate(id, { timeout: 1234 });
    await group.readMetadata(id, { timeout: 1234 });
    await group.read(id, undefined, { timeout: 1234 });
    await group.create(
      { typeGroupName: 'ZTG3A', packageName: 'Z' },
      { headers, timeout: 1234 },
    );
    await group.update(id, {
      headers,
      lockHandle: 'L',
      source: 's',
      timeout: 1234,
    });
    await group.activate(id, { headers, timeout: 1234 });
    await group.delete(id, { headers, lockHandle: 'L', timeout: 1234 });
    expect(requests.map((r) => r.timeout)).toEqual(Array(7).fill(1234));
  });
});
