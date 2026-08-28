# ABAP Unit evidence — `/abapunit/testruns` is synchronous, 2026-08-28

Captured by `scripts/probe-abapunit.ts` on E19 (`RFCSAPRL 816`) **over HTTP and over RFC**,
and by raw `curl` on E77 (`RFCSAPRL 740`). Raw captures stay out of git
(`abapunit-e19*/`, `abapunit-e77*/` are ignored) — these are the responses the reports quote.

The question was whether `POST /sap/bc/adt/abapunit/testruns` answers with a finished result
or with a handle, and whether the media type decides. What settles it is the **root element**
of the response and whether a **`Location`** header is present — not the status code, which is
`200` in every case below.

Request, identical everywhere except the two headers:

```xml
<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit"><external><coverage active="false"/></external><options><uriType value="semantic"/><testDeterminationStrategy sameProgram="true" assignedTests="false"/><testRiskLevels harmless="true" dangerous="true" critical="true"/><testDurations short="true" medium="true" long="true"/><withNavigationUri enabled="true"/></options><adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core"><objectSet kind="inclusive"><adtcore:objectReferences><adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/ZAC_UTST_CLS"/></adtcore:objectReferences></objectSet></adtcore:objectSets></aunit:runConfiguration>
```

## Summary

| capture | Content-Type / Accept | status | root element | `Location` |
|---|---|---|---|---|
| E19, HTTP | `…testruns.config.v4+xml` / `…testruns.result.v2+xml` | 200 | `<aunit:runResult>` | absent |
| E19, HTTP | `application/xml` / `application/xml` | 200 | `<aunit:runResult>` | absent |
| E19, RFC | v4 pair | 200 | `<aunit:runResult>` | absent |
| E19, RFC | `application/xml` | 200 | `<aunit:runResult>` | absent |
| E77, HTTP | v4 pair | 200 | `<aunit:runResult>` | absent |
| E77, HTTP | `application/xml` | 200 | `<aunit:runResult>` | absent |

**Synchronous, confirmed.** The v4 body and the `application/xml` body are byte-identical in
every pair, and the E19-over-RFC body is byte-identical to the E19-over-HTTP one. **The media
type is not the switch, and neither is the wire.** Only the response `Content-Type` echoes the
`Accept` — and on E77 not even that.

## [1] E19 — the typed pair

`POST /sap/bc/adt/abapunit/testruns`
Content-Type: `application/vnd.sap.adt.abapunit.testruns.config.v4+xml`
Accept: `application/vnd.sap.adt.abapunit.testruns.result.v2+xml`
→ **200**, 1060 bytes

```xml
<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit"><program adtcore:uri="/sap/bc/adt/oo/classes/zac_utst_cls" adtcore:type="CLAS/OC" adtcore:name="ZAC_UTST_CLS" uriType="semantic" xmlns:adtcore="http://www.sap.com/adt/core"><testClasses><testClass adtcore:uri="/sap/bc/adt/oo/classes/zac_utst_cls#testclass=LTCL_ZAC_UTST_CLS" adtcore:type="CLAS/OP" adtcore:name="LTCL_ZAC_UTST_CLS" uriType="semantic" navigationUri="/sap/bc/adt/oo/classes/zac_utst_cls/includes/testclasses#type=CLAS%2FOCL;name=LTCL_ZAC_UTST_CLS" durationCategory="short" riskLevel="harmless"><testMethods><testMethod adtcore:uri="/sap/bc/adt/oo/classes/zac_utst_cls#testclass=LTCL_ZAC_UTST_CLS;testmethod=TEST_METHOD" adtcore:type="CLAS/OLI" adtcore:name="TEST_METHOD" executionTime="0" uriType="semantic" navigationUri="…" unit="s"/></testMethods></testClass></testClasses></program></aunit:runResult>
```

Response headers, verbatim:

```json
{
  "content-type": "application/vnd.sap.adt.abapunit.testruns.result.v2+xml; charset=utf-8",
  "content-length": "343",
  "sap-authenticated": "true",
  "sap-adt-saplb": "epbyminsd0654_E19_00",
  "sap-cache-control": "+0",
  "sap-isc-uagent": "0",
  "sap-server": "true",
  "sap-perf-fesrec": "85233.000000"
}
```

No `Location`. Over RFC the header set is smaller and still has no `Location`:

```json
{"~server_protocol": "HTTP/1.1", "content-type": "application/vnd.sap.adt.abapunit.testruns.result.v2+xml; charset=utf-8"}
```

## [2] E19 — the legacy media types, same URL

Content-Type and Accept both `application/xml` → **200**, 1060 bytes, body byte-identical to
[1]. Response `content-type: application/xml; charset=utf-8`.

## Alerts — `kind` carries the distinction, `severity` does not

The fixture's test class was given three methods: one passing, one failing assertion, one
uncaught exception. Same run, HTTP and RFC byte-identical, 3027 bytes:

```xml
<alert kind="failedAssertion" severity="critical"><title>Critical Assertion Error: 'Failing_Assert: ASSERT_TRUE'</title><details><detail text="True expected"/><detail text="Test 'LTCL_ZAC_UTST_CLS-&gt;FAILING_ASSERT' in Main Program 'ZAC_UTST_CLS==================CP'"/></details><stack><stackEntry adtcore:uri="/sap/bc/adt/oo/classes/zac_utst_cls/includes/testclasses#start=12,0;end=12,0" adtcore:type="CLAS/OCN/testclasses" adtcore:name="ZAC_UTST_CLS" adtcore:description="Include: &lt;ZAC_UTST_CLS==================CCAU&gt; Line: &lt;12&gt; (FAILING_ASSERT)"/></stack></alert>
```

```xml
<alert kind="exception" severity="critical"><title>Exception Error &lt;COMPUTE_INT_ZERODIVIDE&gt;</title><details><detail text="Division by zero"/><detail text="Test 'LTCL_ZAC_UTST_CLS-&gt;UNCAUGHT_EXCEPTION' in Main Program 'ZAC_UTST_CLS==================CP'"/></details><stack><stackEntry adtcore:uri="/sap/bc/adt/oo/classes/zac_utst_cls/includes/testclasses#start=17,0;end=17,0" adtcore:type="CLAS/OCN/testclasses" adtcore:name="ZAC_UTST_CLS" adtcore:description="Include: &lt;ZAC_UTST_CLS==================CCAU&gt; Line: &lt;17&gt;"/></stack></alert>
```

**A failed assertion and a short dump both come back `severity="critical"`.** A parser
classifying on severity cannot tell them apart and reports the dump as a failed test. `kind`
is the field that carries it. One release (`816`); "across releases" stays unevidenced.

The methods that produced these:

```abap
METHOD failing_assert.
  cl_abap_unit_assert=>assert_true( abap_false ).
ENDMETHOD.

METHOD uncaught_exception.
  DATA lv_zero TYPE i VALUE 0.
  DATA lv_result TYPE i.
  lv_result = 1 / lv_zero.
ENDMETHOD.
```

The fixture was deleted afterwards; the config change that produced it was reverted.

## E77 — synchronous on legacy too, and a third alert shape

`POST /sap/bc/adt/abapunit/testruns` against `CL_OCS_LOG` (a class with no tests), both media
type pairs → **200**, `content-type: application/xml` in both cases, no `Location`, bodies
byte-identical:

```xml
<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit"><alerts><alert kind="noTestClasses" severity="tolerable"><title>Program [CL_OCS_LOG====================CP] does not contain test classes</title><details><detail text="You can find further informations in document &lt;CHAP&gt; &lt;SAUNIT_NO_TEST_CLASS&gt;"><link rel=""/></detail></details><stack/></alert></alerts></aunit:runResult>
```

`AdtUnitTestLegacy` owns this URL and treats it as **async**. On the one legacy system
available it is synchronous.

Note E77 also ignores the typed `Accept` entirely, answering `application/xml` for both — so
on legacy the media type is not merely not-a-switch, it is not honoured.

## The async path, for contrast

`integration/core/unitTest/UnitTest` on E19 — `validate → create → update → activate → read →
run → getStatus → getResult` — **passes over HTTP and over RFC**. The claim that the async
`/runs` flow "fails on 7.5x backends" is not reproduced here; E19 is `816`, so the 7.5x range
itself remains untested.

On E77 the same suite never reaches `run()`: `POST /sap/bc/adt/oo/classes` answers **403,
"Resource CLASS ZAC_UTST_CLS could not be locked"**, identically with `TEST_MCP` and with
`$TMP` — so not a missing transport — and the class did not exist beforehand (`GET` → 404), so
not a stale lock either.
