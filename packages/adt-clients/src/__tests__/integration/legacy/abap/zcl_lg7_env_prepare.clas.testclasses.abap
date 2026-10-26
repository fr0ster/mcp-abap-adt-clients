"! The prepare action of the legacy test environment, run by ABAP Unit.
"!
"! The report reaches the caller as alerts: each line of
"! ZCL_LG7_ENV->report_lines( ) ('@@LOG {json}' per step, then
"! '@@RESULT {json}') is one cl_abap_unit_assert=>fail with level
"! TOLERABLE and QUIT NO — the alert title is the only text a testruns answer
"! carries back, TOLERABLE marks it as a report rather than a defect, and
"! QUIT NO lets every line through in order.
"! The two literals are filled in from the test configuration by the
"! TypeScript helper (legacyEnv.ts) before this include is written; the
"! helper admits only A-Z, 0-9, _ and / in them.
CLASS ltc_prepare DEFINITION FINAL FOR TESTING
  RISK LEVEL DANGEROUS
  DURATION LONG.
  PRIVATE SECTION.
    "! Not 'teardown' or 'setup': those names are ABAP Unit's fixture methods.
    METHODS run_prepare FOR TESTING.
ENDCLASS.


CLASS ltc_prepare IMPLEMENTATION.

  METHOD run_prepare.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    DATA lt_lines TYPE string_table.
    DATA lv_line TYPE string.
    CREATE OBJECT lo_env
      EXPORTING
        iv_software_component = '{{SOFTWARE_COMPONENT}}'
        iv_transport_layer    = '{{TRANSPORT_LAYER}}'.
    lo_env->prepare( ).
    lt_lines = lo_env->report_lines( ).
    LOOP AT lt_lines INTO lv_line.
      cl_abap_unit_assert=>fail(
        msg   = lv_line
        level = if_aunit_constants=>tolerable
        quit  = if_aunit_constants=>no ).
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
