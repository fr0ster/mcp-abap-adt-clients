"! The status action of the legacy test environment, run by ABAP Unit.
"!
"! The report reaches the caller as alerts: each line of
"! ZCL_LG7_ENV->report_lines( ) ('@@LOG {json}' per step, then
"! '@@RESULT {json}') is one cl_abap_unit_assert=>fail with level
"! TOLERABLE and QUIT NO — the alert title is the only text a testruns answer
"! carries back, TOLERABLE marks it as a report rather than a defect, and
"! QUIT NO lets every line through in order.
"! Nothing in this include comes from the configuration.
CLASS ltc_status DEFINITION FINAL FOR TESTING
  RISK LEVEL DANGEROUS
  DURATION LONG.
  PRIVATE SECTION.
    "! Not 'teardown' or 'setup': those names are ABAP Unit's fixture methods.
    METHODS run_status FOR TESTING.
ENDCLASS.


CLASS ltc_status IMPLEMENTATION.

  METHOD run_status.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    DATA lt_lines TYPE string_table.
    DATA lv_line TYPE string.
    CREATE OBJECT lo_env.
    lo_env->status( ).
    lt_lines = lo_env->report_lines( ).
    LOOP AT lt_lines INTO lv_line.
      cl_abap_unit_assert=>fail(
        msg   = lv_line
        level = if_aunit_constants=>tolerable
        quit  = if_aunit_constants=>no ).
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
