# Task 6.1 — Delete-Message Fix Report

## Summary

Fixed a confirmed correctness bug in `AdtMessageClassMessage.delete`: the previous
implementation omitted the target message from the class PUT body, which SAP ignores
(a class PUT only upserts messages that are present). The correct ADT mechanism is to
emit the target message inside `<mc:deletedmessages>` carrying its message lock handle,
while all other messages remain in `<mc:messages>`.

## Files Changed

| File | Change |
|---|---|
| `src/core/messageClass/xml.ts` | Extend `buildMessageClassXml` opts with `deletedMsgnos?: string[]`; emit flagged messages as `<mc:deletedmessages>` instead of `<mc:messages>` |
| `src/core/messageClass/AdtMessageClassMessage.ts` | Rewrite `delete` to use LOCK_MSG + lockClassForMessage (msgNo+onSave) + PUT with `<mc:deletedmessages>` + unlock both handles; drop unused `lockMessageClass` import |
| `src/__tests__/unit/messageClassXml.test.ts` | Add test: two-message class + `deletedMsgnos:['001']` produces `<mc:deletedmessages>` for 001 with lockhandle, `<mc:messages>` for 002 |
| `src/__tests__/unit/messageClassMessage.test.ts` | Update CLASS_XML to two messages (001+002); rewrite delete test to assert `<mc:deletedmessages>` contract, full lock chain (LOCK_MSG + class LOCK + UNLOCK + UNLOCK_ALL), no HTTP DELETE |
| `docs/superpowers/specs/2026-07-02-message-class-design.md` | Update delete-message flow to `<mc:deletedmessages>` mechanism; update `buildMessageClassXml` opts description |
| `docs/superpowers/plans/2026-07-02-message-class.md` | Replace "PUT without message" description with confirmed `<mc:deletedmessages>` + lockhandle contract |

## Unit Test Run

Command:
```
SAP_URL= npx jest src/__tests__/unit/messageClassXml.test.ts src/__tests__/unit/messageClassMessage.test.ts
```

Output:
```
PASS src/__tests__/unit/messageClassMessage.test.ts
PASS src/__tests__/unit/messageClassXml.test.ts

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
Time:        0.263 s
```

## Build Output

Command: `npm run build`

```
Checked 637 files in 241ms. No fixes applied.
```

Build: clean (0 errors, 0 warnings).

## Commit Hash

See git log — committed on branch `docs/message-class-spec`.
