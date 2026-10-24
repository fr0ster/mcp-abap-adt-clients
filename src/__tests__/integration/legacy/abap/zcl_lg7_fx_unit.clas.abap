"! Fixture of the adt-clients legacy live checks: a class with local tests,
"! one passing and one failing (legacy_unit_runners), read by
"! legacy_refusals_send_nothing. Created and kept current by legacyEnv.ts.
CLASS zcl_lg7_fx_unit DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS double
      IMPORTING iv_value        TYPE i
      RETURNING VALUE(rv_value) TYPE i.
ENDCLASS.



CLASS zcl_lg7_fx_unit IMPLEMENTATION.

  METHOD double.
    rv_value = iv_value * 2.
  ENDMETHOD.

ENDCLASS.
