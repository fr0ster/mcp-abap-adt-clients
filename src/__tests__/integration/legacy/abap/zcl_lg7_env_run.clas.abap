"! Runs the actions of ZCL_LG7_ENV by hand, in SAP GUI, where ABAP Unit may not
"! run the runner classes (SAUNIT_CLIENT_SETUP limits the risk level below
"! DANGEROUS). Each static method creates ZCL_LG7_ENV, calls one action and
"! returns ZCL_LG7_ENV->report_lines( ): '@@LOG {json}' per step, then
"! '@@RESULT {json}' (ok, request, packageExists). Holds nothing else.
"!
"! Call it from SE24: ZCL_LG7_ENV_RUN -> Test (F8) -> the method -> Execute (F8)
"! -> double-click RT_LINES. Log on to SAP GUI as the .env's SAP_USERNAME, in
"! client SAP_CLIENT: every action works for sy-uname ($TMP objects by TADIR
"! author, locks, the request and its task), and the npm steps run as that
"! user. With legacy_env.runner: manual in the overlay, the order is:
"! 1. npm run legacy:setup: installs ZCL_LG7_ENV and this class over ADT,
"!    deletes the configured DDL sources a crashed run left in $TMP, creates
"!    or refreshes the fixtures;
"! 2. PREPARE (the overlay's legacy_env.software_component and
"!    transport_layer): own locks, leftovers, inactive versions, the marked
"!    request, package ZLG7_TEST; its @@RESULT names the request;
"! 3. the live checks, with LEGACY_ENV_REQUEST set to that request;
"!    STATUS at any time (reads only);
"! 4. TEARDOWN: own locks, every object in scope (fixtures included; DDL
"!    sources are left for ADT), inactive versions; the request is kept;
"! 5. npm run legacy:teardown: deletes the configured DDL sources over ADT;
"! 6. REMOVE: package ZLG7_TEST, every marked request of the user;
"! 7. npm run legacy:uninstall: deletes the env classes over ADT, this one
"!    included.
"! If step 1 fails on a lock or a leftover, run PREPARE and step 1 again.
CLASS zcl_lg7_env_run DEFINITION PUBLIC FINAL CREATE PRIVATE.
  PUBLIC SECTION.
    "! @parameter iv_software_component | of package ZLG7_TEST, when prepare creates it
    "! @parameter iv_transport_layer | of package ZLG7_TEST, when prepare creates it
    CLASS-METHODS prepare
      IMPORTING
        iv_software_component TYPE dlvunit
        iv_transport_layer    TYPE devlayer
      RETURNING VALUE(rt_lines) TYPE string_table.

    CLASS-METHODS status
      RETURNING VALUE(rt_lines) TYPE string_table.

    CLASS-METHODS teardown
      RETURNING VALUE(rt_lines) TYPE string_table.

    CLASS-METHODS remove
      RETURNING VALUE(rt_lines) TYPE string_table.
ENDCLASS.



CLASS zcl_lg7_env_run IMPLEMENTATION.

  METHOD prepare.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    CREATE OBJECT lo_env
      EXPORTING
        iv_software_component = iv_software_component
        iv_transport_layer    = iv_transport_layer.
    lo_env->prepare( ).
    rt_lines = lo_env->report_lines( ).
  ENDMETHOD.


  METHOD status.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    CREATE OBJECT lo_env.
    lo_env->status( ).
    rt_lines = lo_env->report_lines( ).
  ENDMETHOD.


  METHOD teardown.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    CREATE OBJECT lo_env.
    lo_env->teardown( ).
    rt_lines = lo_env->report_lines( ).
  ENDMETHOD.


  METHOD remove.
    DATA lo_env TYPE REF TO zcl_lg7_env.
    CREATE OBJECT lo_env.
    lo_env->remove( ).
    rt_lines = lo_env->report_lines( ).
  ENDMETHOD.

ENDCLASS.
