*&---------------------------------------------------------------------*
*& Fixture of the adt-clients legacy live checks: a report with local
*& tests, one passing and one failing (legacy_unit_runners), read by
*& legacy_refusals_send_nothing. Created and kept current by legacyEnv.ts.
*&---------------------------------------------------------------------*
REPORT zlg7_fx_unit.

CLASS lcl_math DEFINITION FINAL.
  PUBLIC SECTION.
    CLASS-METHODS double
      IMPORTING iv_value        TYPE i
      RETURNING VALUE(rv_value) TYPE i.
ENDCLASS.

CLASS lcl_math IMPLEMENTATION.
  METHOD double.
    rv_value = iv_value * 2.
  ENDMETHOD.
ENDCLASS.

CLASS ltc_math DEFINITION FINAL FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.
  PRIVATE SECTION.
    METHODS passes FOR TESTING.
    METHODS fails FOR TESTING.
ENDCLASS.

CLASS ltc_math IMPLEMENTATION.
  METHOD passes.
    cl_abap_unit_assert=>assert_equals( act = lcl_math=>double( 2 ) exp = 4 ).
  ENDMETHOD.
  METHOD fails.
    cl_abap_unit_assert=>fail( msg = 'Fails on purpose: the live check expects one alert.' ).
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  WRITE / lcl_math=>double( 21 ).
