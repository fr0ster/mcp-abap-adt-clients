# Goal: an activation activates, or says it did not

## Goal

Activating an ABAP object through adt-clients activates it on every system ADT serves,
SAP_BASIS 751 included (fr0ster/mcp-abap-adt#351). When the system does not activate it,
the caller learns that the activation did not happen; it is never answered as a success.

## Invariants

- **A system's answer that activates nothing is not a success.** An answer listing the
  objects still inactive (`ioc:inactiveObjects`), or any answer that does not state the
  activation, reaches the caller as "not activated", with
  the objects named. Neither the library nor the server turns it into success.
- **An endpoint is used only where the system offers it.** Group activation goes to
  `/sap/bc/adt/activation/runs` only when the system's discovery lists it; otherwise it goes
  to `/sap/bc/adt/activation`. Nothing is tried in order to find out (no retry on `404`).
- **The caller chooses the next step.** The library takes no second step on its own: it
  activates no object the caller did not name, because the list a preaudit returns may hold
  other inactive objects. What ADT itself offers as the next step — activating named
  references with `preauditRequested=false` — is available to the caller on every path,
  the single-object path included.
- **A refusal stays a refusal.** An answer with an error message (`chkl:messages` with
  `type="E"`) is a failed activation with its messages, on every path.
- **Every system that activates today still activates,** with the same requests: the
  systems that offer `/activation/runs` keep using it.
- **Measured, not assumed.** Each behaviour is pinned by a unit test on a recorded answer.
  It is measured live on the systems we have: an S/4HANA 2025 system and a 7.40 system. For
  751 the issue's measurements are the record; we have no 751 system.

## Out of scope

- A backport to 23.x. Older versions are marked deprecated on npm instead (owner).
- Changing which objects an activation includes, or the activation's options beyond what
  the invariants require.
