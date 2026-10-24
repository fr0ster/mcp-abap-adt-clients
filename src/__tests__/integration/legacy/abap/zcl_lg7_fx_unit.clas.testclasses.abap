* Tests of the fixture ZCL_LG7_FX_UNIT: one passes, one fails on purpose,
* so a run answers two methods and one alert.
CLASS ltc_double DEFINITION FINAL FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.
  PRIVATE SECTION.
    METHODS passes FOR TESTING.
    METHODS fails FOR TESTING.
ENDCLASS.


CLASS ltc_double IMPLEMENTATION.

  METHOD passes.
    DATA lo_cut TYPE REF TO zcl_lg7_fx_unit.
    CREATE OBJECT lo_cut.
    cl_abap_unit_assert=>assert_equals( act = lo_cut->double( 2 ) exp = 4 ).
  ENDMETHOD.

  METHOD fails.
    cl_abap_unit_assert=>fail( msg = 'Fails on purpose: the live check expects one alert.' ).
  ENDMETHOD.

ENDCLASS.
