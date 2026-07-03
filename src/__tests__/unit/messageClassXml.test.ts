import {
  buildMessageClassXml,
  parseMessageClass,
} from '../../core/messageClass/xml';

// class with an UNKNOWN root attr (mc:futureflag) + two messages, one carrying extra attrs
const XML = `<?xml version="1.0" encoding="utf-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="Desc" adtcore:language="DE" adtcore:masterLanguage="DE" adtcore:masterSystem="TRL" adtcore:responsible="U1" mc:futureflag="X"><adtcore:packageRef adtcore:name="ZP"/><mc:messages adtcore:name="" mc:documented="false" mc:msgno="001" mc:msgtext="T1" mc:selfexplainatory="true"/><mc:messages mc:documented="true" mc:msgno="002" mc:msgtext="T2"/></mc:messageClass>`;

describe('parseMessageClass', () => {
  it('parses named fields + rawAttrs (class and messages)', () => {
    const c = parseMessageClass(XML);
    expect(c.name).toBe('ZT');
    expect(c.description).toBe('Desc');
    expect(c.masterLanguage).toBe('DE');
    expect(c.packageName).toBe('ZP');
    expect(c.rawAttrs?.['mc:futureflag']).toBe('X');
    expect(c.messages.map((m) => m.msgno)).toEqual(['001', '002']);
    expect(c.messages[0].msgtext).toBe('T1');
    expect(c.messages[0].rawAttrs?.['mc:documented']).toBe('false');
  });
});

describe('buildMessageClassXml round-trip preservation', () => {
  it('changing one message keeps other message + class attrs verbatim', () => {
    const c = parseMessageClass(XML);
    // change ONLY msg 001 text
    c.messages[0].msgtext = 'CHANGED';
    const out = buildMessageClassXml(c, {
      messageLockHandles: { '001': 'LH1' },
    });
    const re = parseMessageClass(out);
    // class-level future attr preserved
    expect(re.rawAttrs?.['mc:futureflag']).toBe('X');
    expect(re.masterLanguage).toBe('DE');
    // target message: text changed, other attrs kept
    const m1 = re.messages.find((m) => m.msgno === '001')!;
    expect(m1.msgtext).toBe('CHANGED');
    expect(m1.rawAttrs?.['mc:documented']).toBe('false');
    // untouched message preserved
    const m2 = re.messages.find((m) => m.msgno === '002')!;
    expect(m2.msgtext).toBe('T2');
    expect(m2.rawAttrs?.['mc:documented']).toBe('true');
    // lock handle emitted on the target
    expect(out).toContain('mc:lockhandle="LH1"');
    // namespaces appear exactly once (rawAttrs must not duplicate xmlns:*)
    expect(out.match(/xmlns:mc=/g)).toHaveLength(1);
    expect(out.match(/xmlns:adtcore=/g)).toHaveLength(1);
  });

  it('omits a deleted message', () => {
    const c = parseMessageClass(XML);
    c.messages = c.messages.filter((m) => m.msgno !== '002');
    const out = buildMessageClassXml(c);
    expect(out).not.toContain('mc:msgno="002"');
    expect(out).toContain('mc:msgno="001"');
  });

  it('preserves an unknown/future namespace declaration + its attr (stays bound)', () => {
    const withNs = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:foo="urn:foo" adtcore:name="ZT" adtcore:type="MSAG/N" foo:bar="baz"><adtcore:packageRef adtcore:name="ZP"/></mc:messageClass>`;
    const out = buildMessageClassXml(parseMessageClass(withNs));
    // foo:bar kept AND its xmlns:foo declaration kept (no unbound prefix)
    expect(out).toContain('foo:bar="baz"');
    expect(out).toContain('xmlns:foo="urn:foo"');
    // template-owned namespaces still exactly once
    expect(out.match(/xmlns:mc=/g)).toHaveLength(1);
    expect(out.match(/xmlns:adtcore=/g)).toHaveLength(1);
  });
});
