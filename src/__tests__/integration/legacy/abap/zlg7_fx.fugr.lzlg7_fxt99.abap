* Test include of the fixture function group ZLG7_FX: one test passes, one
* fails on purpose, so a group or module run answers two methods, one alert.
CLASS ltc_module DEFINITION FINAL FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.
  PRIVATE SECTION.
    METHODS passes FOR TESTING.
    METHODS fails FOR TESTING.
ENDCLASS.


CLASS ltc_module IMPLEMENTATION.

  METHOD passes.
    CALL FUNCTION 'Z_LG7_FX_UNIT'.
    cl_abap_unit_assert=>assert_subrc( exp = 0 act = sy-subrc ).
  ENDMETHOD.

  METHOD fails.
    cl_abap_unit_assert=>fail( msg = 'Fails on purpose: the live check expects one alert.' ).
  ENDMETHOD.

ENDCLASS.
