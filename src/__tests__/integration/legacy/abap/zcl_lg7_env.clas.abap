"! Test environment of the adt-clients legacy live checks (SAP_BASIS 7.40 SP04).
"!
"! Prepares and removes, in one call each, what a run of the live checks needs
"! and what a crashed run leaves behind. Run through ABAP Unit by the runner
"! classes ZCL_LG7_ENV_PREPARE / _STATUS / _TEARDOWN (7.40 SP04 has no
"! IF_OO_ADT_CLASSRUN); their test methods hand the report to the caller.
"!
"! SCOPE — the only things this class ever touches:
"! - repository objects whose name starts with ZLG7, ZCL_LG7_, ZIF_LG7_ or
"!   Z_LG7_ AND whose TADIR package is $TMP or ZLG7_TEST (both checked again
"!   right before every delete);
"! - never ZCL_LG7_ENV* (this class and its runners): the TypeScript helper
"!   installs and removes those over ADT;
"! - the package ZLG7_TEST itself, and only when nothing is left in it;
"! - transport requests of the current user whose text starts with
"!   'ZLG7 LEGACY-TEST', and their tasks; a released request is never
"!   selected, and no request is ever released;
"! - enqueue locks of the current user whose argument names an object in scope
"!   or one of those requests;
"! - inactive versions (DWINACTIV) of the current user of objects in scope.
"!
"! Written for 7.40 SP04: classic Open SQL (no host variable escapes), no
"! XCO, no CL_WB_OBJECT_OPERATOR, no /UI2/CL_JSON. Function modules and the
"! package API are called inside TRY with every dynamic-call error caught, so
"! an interface that differs on this release is reported, not dumped.
CLASS zcl_lg7_env DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    CONSTANTS:
      c_package        TYPE devclass VALUE 'ZLG7_TEST',
      c_local_package  TYPE devclass VALUE '$TMP',
      c_request_marker TYPE as4text VALUE 'ZLG7 LEGACY-TEST'.

    TYPES:
      BEGIN OF ty_object,
        object   TYPE trobjtype,
        obj_name TYPE sobj_name,
        devclass TYPE devclass,
      END OF ty_object,
      tt_object TYPE STANDARD TABLE OF ty_object WITH DEFAULT KEY.

    "! @parameter iv_software_component | of package ZLG7_TEST, when prepare creates it
    "! @parameter iv_transport_layer | of package ZLG7_TEST, when prepare creates it
    METHODS constructor
      IMPORTING
        iv_software_component TYPE csequence OPTIONAL
        iv_transport_layer    TYPE csequence OPTIONAL.

    "! Before a run: own locks released; disposable leftovers (in scope, not a
    "! fixture) deleted; their inactive versions dropped; the marked request
    "! (reused while open, else created) and package ZLG7_TEST ensured.
    METHODS prepare.

    "! Read only: the open marked request, the package, the objects in scope.
    METHODS status.

    "! When no longer needed: own locks released; every object in scope
    "! deleted, fixtures included; inactive versions dropped; package ZLG7_TEST
    "! deleted; every marked request of the user deleted.
    METHODS teardown.

    "! One '@@LOG {json}' line per step, then '@@RESULT {json}'.
    METHODS report_lines RETURNING VALUE(rt_lines) TYPE string_table.

    CLASS-METHODS is_own_name
      IMPORTING iv_name       TYPE csequence
      RETURNING VALUE(rv_yes) TYPE abap_bool.
    CLASS-METHODS is_env_name
      IMPORTING iv_name       TYPE csequence
      RETURNING VALUE(rv_yes) TYPE abap_bool.
    CLASS-METHODS is_fixture_name
      IMPORTING iv_name       TYPE csequence
      RETURNING VALUE(rv_yes) TYPE abap_bool.

  PRIVATE SECTION.
    TYPES:
      BEGIN OF ty_log,
        step    TYPE string,
        object  TYPE string,
        status  TYPE string,
        message TYPE string,
      END OF ty_log,
      tt_log     TYPE STANDARD TABLE OF ty_log WITH DEFAULT KEY,
      tt_trkorr  TYPE STANDARD TABLE OF trkorr WITH DEFAULT KEY.

    DATA mt_log TYPE tt_log.
    DATA mv_action TYPE string.
    DATA mv_request TYPE trkorr.
    DATA mv_software_component TYPE string.
    DATA mv_transport_layer TYPE string.

    METHODS add_log
      IMPORTING iv_step    TYPE csequence
                iv_object  TYPE csequence OPTIONAL
                iv_status  TYPE csequence
                iv_message TYPE csequence OPTIONAL.
    METHODS release_locks.
    METHODS marked_requests RETURNING VALUE(rt_requests) TYPE tt_trkorr.
    METHODS ensure_request.
    METHODS create_request RETURNING VALUE(rv_trkorr) TYPE trkorr.
    METHODS delete_requests.
    METHODS objects_in_scope
      IMPORTING iv_keep_fixtures  TYPE abap_bool
      RETURNING VALUE(rt_objects) TYPE tt_object.
    METHODS delete_objects IMPORTING iv_keep_fixtures TYPE abap_bool.
    METHODS delete_one
      IMPORTING is_object        TYPE ty_object
      RETURNING VALUE(rv_status) TYPE string.
    METHODS clean_inactive IMPORTING iv_keep_fixtures TYPE abap_bool.
    METHODS package_exists RETURNING VALUE(rv_yes) TYPE abap_bool.
    METHODS ensure_package.
    METHODS delete_package.
    METHODS purge_deleted_entries.
    METHODS commit.
    CLASS-METHODS owner_of
      IMPORTING iv_name         TYPE csequence
      RETURNING VALUE(rv_owner) TYPE string.
    CLASS-METHODS scope_package_of
      IMPORTING iv_name           TYPE csequence
      RETURNING VALUE(rv_devclass) TYPE devclass.
    CLASS-METHODS in_scope_package
      IMPORTING iv_devclass   TYPE devclass
      RETURNING VALUE(rv_yes) TYPE abap_bool.
    CLASS-METHODS type_rank
      IMPORTING iv_object      TYPE trobjtype
      RETURNING VALUE(rv_rank) TYPE i.
    CLASS-METHODS sy_message RETURNING VALUE(rv_text) TYPE string.
    CLASS-METHODS json_string
      IMPORTING iv_value       TYPE csequence
      RETURNING VALUE(rv_json) TYPE string.
    CLASS-METHODS json_bool
      IMPORTING iv_value       TYPE abap_bool
      RETURNING VALUE(rv_json) TYPE string.
ENDCLASS.



CLASS zcl_lg7_env IMPLEMENTATION.

  METHOD constructor.
    mv_software_component = to_upper( iv_software_component ).
    mv_transport_layer = to_upper( iv_transport_layer ).
  ENDMETHOD.


  METHOD is_own_name.
    DATA lv_name TYPE string.
    lv_name = to_upper( iv_name ).
    IF lv_name CP 'ZLG7*' OR lv_name CP 'ZCL_LG7_*'
        OR lv_name CP 'ZIF_LG7_*' OR lv_name CP 'Z_LG7_*'.
      rv_yes = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD is_env_name.
    DATA lv_name TYPE string.
    lv_name = to_upper( iv_name ).
    IF lv_name CP 'ZCL_LG7_ENV*'.
      rv_yes = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD is_fixture_name.
    DATA lv_name TYPE string.
    lv_name = to_upper( iv_name ).
    IF lv_name CP 'ZCL_LG7_FX*' OR lv_name CP 'ZLG7_FX*' OR lv_name CP 'Z_LG7_FX*'.
      rv_yes = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD in_scope_package.
    IF iv_devclass = c_local_package OR iv_devclass = c_package.
      rv_yes = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD owner_of.
    " The TADIR object a lock argument word or an inactive entry belongs to:
    " class pool parts (ZCL_X=====CU) to the class, function group programs and
    " includes (SAPLZLG7_X, LZLG7_XT99) to the group, a function module to its
    " group through TFDIR; anything else is its own owner.
    DATA lv_upper TYPE string.
    DATA lv_word TYPE string.
    DATA lv_name TYPE string.
    DATA lv_rest TYPE string.
    DATA lv_length TYPE i.
    DATA lv_pname TYPE tfdir-pname.
    DATA lv_funcname TYPE tfdir-funcname.
    lv_upper = to_upper( iv_name ).
    CONDENSE lv_upper.
    SPLIT lv_upper AT space INTO lv_word lv_rest.
    SPLIT lv_word AT '=' INTO lv_name lv_rest.
    lv_length = strlen( lv_name ).
    IF lv_name CP 'SAPLZLG7*' AND lv_length > 4.
      rv_owner = lv_name+4.
    ELSEIF lv_name CP 'LZLG7*' AND lv_length > 4.
      lv_length = lv_length - 4.
      rv_owner = lv_name+1(lv_length).
    ELSE.
      rv_owner = lv_name.
      IF lv_name CP 'Z_LG7_*' AND lv_length <= 30.
        lv_funcname = lv_name.
        SELECT SINGLE pname FROM tfdir INTO lv_pname WHERE funcname = lv_funcname.
        IF sy-subrc = 0 AND strlen( lv_pname ) > 4.
          rv_owner = lv_pname+4.
        ENDIF.
      ENDIF.
    ENDIF.
  ENDMETHOD.


  METHOD scope_package_of.
    " The package of an owner that is in scope, else initial. The name check
    " and the TADIR package check together: the guard of every step.
    DATA lv_name TYPE sobj_name.
    DATA lv_devclass TYPE devclass.
    IF is_own_name( iv_name ) = abap_false OR strlen( iv_name ) > 40.
      RETURN.
    ENDIF.
    lv_name = iv_name.
    SELECT SINGLE devclass FROM tadir INTO lv_devclass
      WHERE pgmid = 'R3TR' AND obj_name = lv_name AND object <> 'DEVC'.
    IF sy-subrc = 0 AND in_scope_package( lv_devclass ) = abap_true.
      rv_devclass = lv_devclass.
    ENDIF.
  ENDMETHOD.


  METHOD add_log.
    DATA ls_log TYPE ty_log.
    ls_log-step = iv_step.
    ls_log-object = iv_object.
    ls_log-status = iv_status.
    ls_log-message = iv_message.
    " Each line travels as one ABAP Unit alert title: keep it short.
    IF strlen( ls_log-message ) > 160.
      ls_log-message = ls_log-message(160).
    ENDIF.
    APPEND ls_log TO mt_log.
  ENDMETHOD.


  METHOD commit.
    COMMIT WORK AND WAIT.
  ENDMETHOD.


  METHOD prepare.
    mv_action = `prepare`.
    release_locks( ).
    ensure_request( ).
    delete_objects( abap_true ).
    clean_inactive( abap_true ).
    ensure_package( ).
  ENDMETHOD.


  METHOD status.
    DATA lt_requests TYPE tt_trkorr.
    DATA lt_objects TYPE tt_object.
    DATA ls_object TYPE ty_object.
    mv_action = `status`.
    lt_requests = marked_requests( ).
    READ TABLE lt_requests INTO mv_request INDEX 1.
    IF mv_request IS INITIAL.
      add_log( iv_step = `request` iv_status = `NONE` iv_message = `no open marked request` ).
    ELSE.
      add_log( iv_step = `request` iv_object = mv_request iv_status = `OK` ).
    ENDIF.
    lt_objects = objects_in_scope( abap_false ).
    LOOP AT lt_objects INTO ls_object.
      add_log( iv_step = `object` iv_object = |{ ls_object-object } { ls_object-obj_name }|
               iv_status = `PRESENT` iv_message = ls_object-devclass ).
    ENDLOOP.
  ENDMETHOD.


  METHOD teardown.
    DATA lt_requests TYPE tt_trkorr.
    mv_action = `teardown`.
    release_locks( ).
    " The deletions in ZLG7_TEST and of the package itself are recorded on a
    " marked request; it is deleted with the others at the end.
    IF package_exists( ) = abap_true.
      ensure_request( ).
    ELSE.
      lt_requests = marked_requests( ).
      READ TABLE lt_requests INTO mv_request INDEX 1.
    ENDIF.
    delete_objects( abap_false ).
    clean_inactive( abap_false ).
    delete_package( ).
    delete_requests( ).
    purge_deleted_entries( ).
  ENDMETHOD.


  METHOD release_locks.
    " Touches: enqueue entries of sy-uname in sy-mandt whose argument names an
    " object in scope or a marked request. Nothing else is passed to ENQUE_DELETE.
    DATA lt_enq TYPE STANDARD TABLE OF seqg3.
    DATA lt_del TYPE STANDARD TABLE OF seqg3.
    DATA ls_enq TYPE seqg3.
    DATA lt_requests TYPE tt_trkorr.
    DATA lv_request TYPE trkorr.
    DATA lv_arg TYPE string.
    DATA lt_words TYPE string_table.
    DATA lv_word TYPE string.
    DATA lv_hit TYPE abap_bool.
    DATA lv_subrc TYPE sy-subrc.
    DATA lv_offset TYPE i.
    DATA lv_candidate TYPE string.

    TRY.
        CALL FUNCTION 'ENQUEUE_READ'
          EXPORTING
            gclient = sy-mandt
            guname  = sy-uname
          TABLES
            enq     = lt_enq
          EXCEPTIONS
            OTHERS  = 1.
      CATCH cx_sy_dyn_call_error.
        sy-subrc = 2.
    ENDTRY.
    IF sy-subrc <> 0.
      add_log( iv_step = `locks` iv_status = `ERROR` iv_message = `ENQUEUE_READ failed` ).
      RETURN.
    ENDIF.

    lt_requests = marked_requests( ).

    LOOP AT lt_enq INTO ls_enq.
      lv_arg = ls_enq-garg.
      TRANSLATE lv_arg USING '* '.
      CONDENSE lv_arg.
      SPLIT lv_arg AT space INTO TABLE lt_words.
      lv_hit = abap_false.
      LOOP AT lt_words INTO lv_word.
        " A word may carry a prefix of the lock object (%C, a type): look for
        " the start of one of our names inside it.
        CLEAR lv_candidate.
        FIND FIRST OCCURRENCE OF 'SAPLZLG7' IN lv_word MATCH OFFSET lv_offset.
        IF sy-subrc <> 0.
          FIND FIRST OCCURRENCE OF 'LZLG7' IN lv_word MATCH OFFSET lv_offset.
        ENDIF.
        IF sy-subrc <> 0.
          FIND FIRST OCCURRENCE OF 'ZCL_LG7_' IN lv_word MATCH OFFSET lv_offset.
        ENDIF.
        IF sy-subrc <> 0.
          FIND FIRST OCCURRENCE OF 'ZIF_LG7_' IN lv_word MATCH OFFSET lv_offset.
        ENDIF.
        IF sy-subrc <> 0.
          FIND FIRST OCCURRENCE OF 'Z_LG7_' IN lv_word MATCH OFFSET lv_offset.
        ENDIF.
        IF sy-subrc <> 0.
          FIND FIRST OCCURRENCE OF 'ZLG7' IN lv_word MATCH OFFSET lv_offset.
        ENDIF.
        IF sy-subrc = 0.
          lv_candidate = lv_word+lv_offset.
          IF is_env_name( owner_of( lv_candidate ) ) = abap_false
              AND scope_package_of( owner_of( lv_candidate ) ) IS NOT INITIAL.
            lv_hit = abap_true.
          ENDIF.
        ENDIF.
        LOOP AT lt_requests INTO lv_request.
          IF lv_word CS lv_request.
            lv_hit = abap_true.
          ENDIF.
        ENDLOOP.
        IF lv_hit = abap_true.
          EXIT.
        ENDIF.
      ENDLOOP.
      IF lv_hit = abap_true.
        APPEND ls_enq TO lt_del.
        add_log( iv_step = `locks` iv_object = |{ ls_enq-gname } { ls_enq-garg }| iv_status = `RELEASE` ).
      ENDIF.
    ENDLOOP.

    IF lt_del IS INITIAL.
      add_log( iv_step = `locks` iv_status = `OK` iv_message = `no own locks in scope` ).
      RETURN.
    ENDIF.
    TRY.
        CALL FUNCTION 'ENQUE_DELETE'
          EXPORTING
            suppress_syslog_entry = 'X'
          IMPORTING
            subrc                 = lv_subrc
          TABLES
            enq                   = lt_del.
      CATCH cx_sy_dyn_call_error.
        lv_subrc = 99.
    ENDTRY.
    IF lv_subrc = 0.
      add_log( iv_step = `locks` iv_status = `OK` iv_message = |{ lines( lt_del ) } released| ).
    ELSE.
      add_log( iv_step = `locks` iv_status = `ERROR` iv_message = |ENQUE_DELETE subrc { lv_subrc }| ).
    ENDIF.
  ENDMETHOD.


  METHOD marked_requests.
    " Touches nothing: reads the modifiable top-level requests of sy-uname
    " whose text starts with the marker, newest first.
    TYPES:
      BEGIN OF ty_request,
        trkorr  TYPE e070-trkorr,
        as4date TYPE e070-as4date,
        as4time TYPE e070-as4time,
        as4text TYPE e07t-as4text,
      END OF ty_request.
    DATA lt_found TYPE STANDARD TABLE OF ty_request.
    DATA ls_found TYPE ty_request.
    DATA lv_marker TYPE string.
    DATA lv_pattern TYPE string.
    lv_marker = |{ c_request_marker }%|.
    lv_pattern = |{ c_request_marker }*|.
    SELECT e070~trkorr e070~as4date e070~as4time e07t~as4text
      INTO TABLE lt_found
      FROM e070 INNER JOIN e07t ON e07t~trkorr = e070~trkorr
      WHERE e070~as4user = sy-uname
        AND e070~strkorr = space
        AND e070~trfunction = 'K'
        AND ( e070~trstatus = 'D' OR e070~trstatus = 'L' )
        AND e07t~as4text LIKE lv_marker.
    SORT lt_found BY as4date DESCENDING as4time DESCENDING trkorr DESCENDING.
    DELETE ADJACENT DUPLICATES FROM lt_found COMPARING trkorr.
    LOOP AT lt_found INTO ls_found.
      IF ls_found-as4text CP lv_pattern.
        APPEND ls_found-trkorr TO rt_requests.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD ensure_request.
    DATA lt_requests TYPE tt_trkorr.
    lt_requests = marked_requests( ).
    READ TABLE lt_requests INTO mv_request INDEX 1.
    IF mv_request IS NOT INITIAL.
      add_log( iv_step = `request` iv_object = mv_request iv_status = `OK` iv_message = `reused` ).
      RETURN.
    ENDIF.
    mv_request = create_request( ).
  ENDMETHOD.


  METHOD create_request.
    " Touches: one new workbench request (type K) of sy-uname with a task for
    " sy-uname, its text starting with the marker. Never released here.
    DATA ls_header TYPE trwbo_request_header.
    DATA lt_users TYPE scts_users.
    DATA ls_user LIKE LINE OF lt_users.
    DATA lv_text TYPE as4text.
    DATA lx_call TYPE REF TO cx_sy_dyn_call_error.
    lv_text = |{ c_request_marker } { sy-datum } { sy-uzeit }|.
    ls_user-user = sy-uname.
    ls_user-type = 'S'.
    APPEND ls_user TO lt_users.
    TRY.
        CALL FUNCTION 'TR_INSERT_REQUEST_WITH_TASKS'
          EXPORTING
            iv_type           = 'K'
            iv_text           = lv_text
            iv_owner          = sy-uname
            it_users          = lt_users
          IMPORTING
            es_request_header = ls_header
          EXCEPTIONS
            OTHERS            = 1.
      CATCH cx_sy_dyn_call_error INTO lx_call.
        add_log( iv_step = `request` iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
        RETURN.
    ENDTRY.
    IF sy-subrc <> 0.
      add_log( iv_step = `request` iv_status = `ERROR` iv_message = sy_message( ) ).
      RETURN.
    ENDIF.
    commit( ).
    rv_trkorr = ls_header-trkorr.
    add_log( iv_step = `request` iv_object = rv_trkorr iv_status = `CREATED` iv_message = lv_text ).
  ENDMETHOD.


  METHOD delete_requests.
    " Touches: the marked requests of sy-uname (never a released one) and
    " their tasks: object locks of each removed, then each deleted, tasks first.
    DATA lt_requests TYPE tt_trkorr.
    DATA lv_request TYPE trkorr.
    DATA lt_order TYPE tt_trkorr.
    DATA lv_trkorr TYPE trkorr.
    DATA ls_unlock TYPE trwbo_request.
    DATA lx_call TYPE REF TO cx_sy_dyn_call_error.

    lt_requests = marked_requests( ).
    IF lt_requests IS INITIAL.
      add_log( iv_step = `requests` iv_status = `OK` iv_message = `no marked requests` ).
      RETURN.
    ENDIF.
    LOOP AT lt_requests INTO lv_request.
      CLEAR lt_order.
      SELECT trkorr FROM e070 INTO TABLE lt_order WHERE strkorr = lv_request.
      APPEND lv_request TO lt_order.
      LOOP AT lt_order INTO lv_trkorr.
        CLEAR ls_unlock.
        ls_unlock-h-trkorr = lv_trkorr.
        TRY.
            CALL FUNCTION 'TRINT_UNLOCK_REQUEST'
              CHANGING
                cs_request = ls_unlock
              EXCEPTIONS
                OTHERS     = 1.
            IF sy-subrc <> 0.
              add_log( iv_step = `requests` iv_object = lv_trkorr iv_status = `WARN` iv_message = |unlock: { sy_message( ) }| ).
            ENDIF.
          CATCH cx_sy_dyn_call_error INTO lx_call.
            add_log( iv_step = `requests` iv_object = lv_trkorr iv_status = `WARN` iv_message = |unlock: { lx_call->get_text( ) }| ).
        ENDTRY.
        TRY.
            CALL FUNCTION 'TR_DELETE_COMM'
              EXPORTING
                wi_dialog = space
                wi_trkorr = lv_trkorr
              EXCEPTIONS
                OTHERS    = 1.
            IF sy-subrc = 0.
              add_log( iv_step = `requests` iv_object = lv_trkorr iv_status = `DELETED` ).
            ELSE.
              add_log( iv_step = `requests` iv_object = lv_trkorr iv_status = `ERROR` iv_message = sy_message( ) ).
            ENDIF.
          CATCH cx_sy_dyn_call_error INTO lx_call.
            add_log( iv_step = `requests` iv_object = lv_trkorr iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
        ENDTRY.
      ENDLOOP.
    ENDLOOP.
    commit( ).
    CLEAR mv_request.
  ENDMETHOD.


  METHOD objects_in_scope.
    " Touches nothing: TADIR entries (not flagged for deletion) in $TMP or
    " ZLG7_TEST whose name is ours, minus the env classes (and the fixtures,
    " when asked). The LIKE patterns only narrow the read; is_own_name decides.
    DATA lt_found TYPE tt_object.
    DATA ls_found TYPE ty_object.
    SELECT object obj_name devclass FROM tadir INTO TABLE lt_found
      WHERE pgmid = 'R3TR'
        AND ( devclass = c_local_package OR devclass = c_package )
        AND object <> 'DEVC'
        AND delflag = space
        AND ( obj_name LIKE 'ZLG7%' OR obj_name LIKE 'ZCL_LG7%'
              OR obj_name LIKE 'ZIF_LG7%' OR obj_name LIKE 'Z_LG7%' ).
    LOOP AT lt_found INTO ls_found.
      IF is_own_name( ls_found-obj_name ) = abap_false
          OR is_env_name( ls_found-obj_name ) = abap_true.
        CONTINUE.
      ENDIF.
      IF iv_keep_fixtures = abap_true AND is_fixture_name( ls_found-obj_name ) = abap_true.
        CONTINUE.
      ENDIF.
      APPEND ls_found TO rt_objects.
    ENDLOOP.
  ENDMETHOD.


  METHOD type_rank.
    " Dependents first: a class may use an interface, a DDL source nothing here.
    CASE iv_object.
      WHEN 'CLAS'. rv_rank = 10.
      WHEN 'PROG'. rv_rank = 20.
      WHEN 'DDLS'. rv_rank = 30.
      WHEN 'FUGR'. rv_rank = 40.
      WHEN 'INTF'. rv_rank = 50.
      WHEN OTHERS. rv_rank = 90.
    ENDCASE.
  ENDMETHOD.


  METHOD delete_objects.
    TYPES:
      BEGIN OF ty_ranked,
        rank   TYPE i,
        object TYPE ty_object,
      END OF ty_ranked.
    DATA lt_objects TYPE tt_object.
    DATA ls_object TYPE ty_object.
    DATA lt_ranked TYPE STANDARD TABLE OF ty_ranked.
    DATA ls_ranked TYPE ty_ranked.
    DATA lv_status TYPE string.
    DATA lv_deleted TYPE i.

    " Several passes: an object a dependent still blocks goes in the next one.
    DO 3 TIMES.
      lt_objects = objects_in_scope( iv_keep_fixtures ).
      DELETE lt_objects WHERE object = 'DDLS'.
      IF lt_objects IS INITIAL.
        EXIT.
      ENDIF.
      CLEAR lt_ranked.
      LOOP AT lt_objects INTO ls_object.
        ls_ranked-rank = type_rank( ls_object-object ).
        ls_ranked-object = ls_object.
        APPEND ls_ranked TO lt_ranked.
      ENDLOOP.
      SORT lt_ranked BY rank object-obj_name.
      lv_deleted = 0.
      LOOP AT lt_ranked INTO ls_ranked.
        lv_status = delete_one( ls_ranked-object ).
        IF lv_status = `DELETED`.
          lv_deleted = lv_deleted + 1.
        ENDIF.
      ENDLOOP.
      IF lv_deleted = 0.
        EXIT.
      ENDIF.
    ENDDO.

    " DDL sources: no classic delete function module on 7.40 SP04; the
    " TypeScript helper deletes these over ADT (lock, DELETE, unlock — measured).
    lt_objects = objects_in_scope( iv_keep_fixtures ).
    LOOP AT lt_objects INTO ls_object.
      IF ls_object-object = 'DDLS'.
        add_log( iv_step = `objects` iv_object = |{ ls_object-object } { ls_object-obj_name }|
                 iv_status = `LEFT-FOR-ADT` iv_message = ls_object-devclass ).
      ELSE.
        add_log( iv_step = `objects` iv_object = |{ ls_object-object } { ls_object-obj_name }|
                 iv_status = `ERROR` iv_message = `still present after clean-up` ).
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD delete_one.
    " Touches: the one object given, only after the guard read again here —
    " our name, not an env class, TADIR package $TMP or ZLG7_TEST.
    DATA lv_devclass TYPE devclass.
    DATA lv_corrnr TYPE trkorr.
    DATA lv_subrc TYPE sy-subrc.
    DATA ls_clskey TYPE seoclskey.
    DATA lv_program TYPE syrepid.
    DATA lv_area TYPE rs38l-area.
    DATA lv_label TYPE string.
    DATA lx_call TYPE REF TO cx_sy_dyn_call_error.

    lv_label = |{ is_object-object } { is_object-obj_name }|.
    SELECT SINGLE devclass FROM tadir INTO lv_devclass
      WHERE pgmid = 'R3TR' AND object = is_object-object AND obj_name = is_object-obj_name.
    IF sy-subrc <> 0 OR in_scope_package( lv_devclass ) = abap_false
        OR is_own_name( is_object-obj_name ) = abap_false
        OR is_env_name( is_object-obj_name ) = abap_true.
      rv_status = `SKIPPED`.
      add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = `outside the scope` ).
      RETURN.
    ENDIF.
    IF lv_devclass = c_package.
      IF mv_request IS INITIAL.
        rv_status = `ERROR`.
        add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = `no marked request to record the deletion` ).
        RETURN.
      ENDIF.
      lv_corrnr = mv_request.
    ENDIF.

    lv_subrc = 0.
    TRY.
        CASE is_object-object.
          WHEN 'CLAS'.
            ls_clskey-clsname = is_object-obj_name.
            CALL FUNCTION 'SEO_CLASS_DELETE_COMPLETE'
              EXPORTING
                clskey = ls_clskey
              CHANGING
                corrnr = lv_corrnr
              EXCEPTIONS
                OTHERS = 1.
            lv_subrc = sy-subrc.
          WHEN 'INTF'.
            ls_clskey-clsname = is_object-obj_name.
            CALL FUNCTION 'SEO_INTERFACE_DELETE_COMPLETE'
              EXPORTING
                intkey = ls_clskey
              CHANGING
                corrnr = lv_corrnr
              EXCEPTIONS
                OTHERS = 1.
            lv_subrc = sy-subrc.
          WHEN 'PROG'.
            lv_program = is_object-obj_name.
            CALL FUNCTION 'RS_DELETE_PROGRAM'
              EXPORTING
                corrnumber      = lv_corrnr
                program         = lv_program
                suppress_checks = 'X'
                suppress_popup  = 'X'
              EXCEPTIONS
                OTHERS          = 1.
            lv_subrc = sy-subrc.
          WHEN 'FUGR'.
            lv_area = is_object-obj_name.
            CALL FUNCTION 'RS_FUNCTION_POOL_DELETE'
              EXPORTING
                area            = lv_area
                corrnum         = lv_corrnr
                suppress_popups = 'X'
              EXCEPTIONS
                OTHERS          = 1.
            lv_subrc = sy-subrc.
          WHEN OTHERS.
            rv_status = `ERROR`.
            add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = `type not handled; not deleted` ).
            RETURN.
        ENDCASE.
      CATCH cx_sy_dyn_call_error INTO lx_call.
        rv_status = `ERROR`.
        add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = lx_call->get_text( ) ).
        RETURN.
    ENDTRY.
    IF lv_subrc <> 0.
      rv_status = `RETRY`.
      add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = sy_message( ) ).
      RETURN.
    ENDIF.
    commit( ).
    rv_status = `DELETED`.
    add_log( iv_step = `objects` iv_object = lv_label iv_status = rv_status iv_message = lv_devclass ).
  ENDMETHOD.


  METHOD clean_inactive.
    " Touches: DWINACTIV entries of sy-uname whose owner (see owner_of) is in
    " scope — our name, TADIR package $TMP or ZLG7_TEST — and not an env class
    " (nor a fixture, when asked); removed with RS_DELETE_FROM_WORKING_AREA.
    TYPES:
      BEGIN OF ty_inactive,
        object   TYPE dwinactiv-object,
        obj_name TYPE dwinactiv-obj_name,
      END OF ty_inactive.
    DATA lt_inactive TYPE STANDARD TABLE OF ty_inactive.
    DATA ls_inactive TYPE ty_inactive.
    DATA lv_owner TYPE string.
    DATA lv_cleaned TYPE i.
    DATA lx_call TYPE REF TO cx_sy_dyn_call_error.

    SELECT object obj_name FROM dwinactiv INTO TABLE lt_inactive
      WHERE uname = sy-uname
        AND ( obj_name LIKE 'ZLG7%' OR obj_name LIKE 'ZCL_LG7%'
              OR obj_name LIKE 'ZIF_LG7%' OR obj_name LIKE 'Z_LG7%'
              OR obj_name LIKE 'LZLG7%' OR obj_name LIKE 'SAPLZLG7%' ).
    SORT lt_inactive.
    DELETE ADJACENT DUPLICATES FROM lt_inactive.
    LOOP AT lt_inactive INTO ls_inactive.
      lv_owner = owner_of( ls_inactive-obj_name ).
      IF is_env_name( lv_owner ) = abap_true OR scope_package_of( lv_owner ) IS INITIAL.
        CONTINUE.
      ENDIF.
      IF iv_keep_fixtures = abap_true AND is_fixture_name( lv_owner ) = abap_true.
        CONTINUE.
      ENDIF.
      TRY.
          CALL FUNCTION 'RS_DELETE_FROM_WORKING_AREA'
            EXPORTING
              object    = ls_inactive-object
              obj_name  = ls_inactive-obj_name
              immediate = 'X'.
          lv_cleaned = lv_cleaned + 1.
          add_log( iv_step = `inactive` iv_object = |{ ls_inactive-object } { ls_inactive-obj_name }| iv_status = `REMOVED` ).
        CATCH cx_sy_dyn_call_error INTO lx_call.
          add_log( iv_step = `inactive` iv_object = |{ ls_inactive-object } { ls_inactive-obj_name }| iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
      ENDTRY.
    ENDLOOP.
    commit( ).
    IF lv_cleaned = 0.
      add_log( iv_step = `inactive` iv_status = `OK` iv_message = `no own inactive versions in scope` ).
    ENDIF.
  ENDMETHOD.


  METHOD package_exists.
    DATA lv_devclass TYPE devclass.
    SELECT SINGLE devclass FROM tdevc INTO lv_devclass WHERE devclass = c_package.
    IF sy-subrc = 0.
      rv_yes = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD ensure_package.
    " Touches: package ZLG7_TEST only, created when missing, on the marked
    " request, with the software component and transport layer it was given.
    DATA ls_data TYPE scompkdtln.
    DATA lo_package TYPE REF TO if_package.
    DATA lx_call TYPE REF TO cx_root.
    FIELD-SYMBOLS <lv_field> TYPE any.

    IF package_exists( ) = abap_true.
      add_log( iv_step = `package` iv_object = c_package iv_status = `OK` iv_message = `exists` ).
      RETURN.
    ENDIF.
    IF mv_request IS INITIAL OR mv_software_component IS INITIAL OR mv_transport_layer IS INITIAL.
      add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR`
               iv_message = `needs the marked request, a software component and a transport layer` ).
      RETURN.
    ENDIF.

    " Fields set by name: a field this release lacks is reported (its name as
    " the object), not a syntax error.
    DEFINE set_field.
      ASSIGN COMPONENT &1 OF STRUCTURE ls_data TO <lv_field>.
      IF sy-subrc = 0.
        <lv_field> = &2.
      ELSE.
        add_log( iv_step = `package` iv_object = &1 iv_status = `WARN` iv_message = `field missing on this release` ).
      ENDIF.
    END-OF-DEFINITION.
    set_field 'DEVCLASS' c_package.
    set_field 'CTEXT' 'adt-clients legacy live checks (disposable)'.
    set_field 'DLVUNIT' mv_software_component.
    set_field 'PDEVCLASS' mv_transport_layer.
    set_field 'KORRFLAG' 'X'.
    set_field 'AS4USER' sy-uname.
    set_field 'MASTERLANG' sy-langu.

    TRY.
        CALL METHOD ('CL_PACKAGE_FACTORY')=>('CREATE_NEW_PACKAGE')
          EXPORTING
            i_suppress_dialog = abap_true
          IMPORTING
            e_package         = lo_package
          CHANGING
            c_package_data    = ls_data
          EXCEPTIONS
            OTHERS            = 1.
        IF sy-subrc <> 0 OR lo_package IS NOT BOUND.
          add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |create: { sy_message( ) }| ).
          RETURN.
        ENDIF.
        CALL METHOD lo_package->('SAVE')
          EXPORTING
            i_transport_request = mv_request
            i_suppress_dialog   = abap_true
          EXCEPTIONS
            OTHERS              = 1.
        IF sy-subrc <> 0.
          add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |save: { sy_message( ) }| ).
          RETURN.
        ENDIF.
        CALL METHOD lo_package->('SET_CHANGEABLE')
          EXPORTING
            i_changeable = abap_false
          EXCEPTIONS
            OTHERS       = 1.
      CATCH cx_sy_dyn_call_error cx_sy_ref_is_initial INTO lx_call.
        add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
        RETURN.
    ENDTRY.
    commit( ).
    add_log( iv_step = `package` iv_object = c_package iv_status = `CREATED` iv_message = mv_request ).
  ENDMETHOD.


  METHOD delete_package.
    " Touches: package ZLG7_TEST only, and only when no object is left in it;
    " the deletion is recorded on the marked request.
    DATA lo_package TYPE REF TO if_package.
    DATA lv_count TYPE i.
    DATA lx_call TYPE REF TO cx_root.

    IF package_exists( ) = abap_false.
      add_log( iv_step = `package` iv_object = c_package iv_status = `OK` iv_message = `not present` ).
      RETURN.
    ENDIF.
    SELECT COUNT(*) FROM tadir INTO lv_count
      WHERE devclass = c_package AND object <> 'DEVC' AND delflag = space.
    IF lv_count > 0.
      add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |{ lv_count } object(s) still in it; not deleted| ).
      RETURN.
    ENDIF.
    IF mv_request IS INITIAL.
      add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = `no marked request to record the deletion` ).
      RETURN.
    ENDIF.
    TRY.
        CALL METHOD ('CL_PACKAGE_FACTORY')=>('LOAD_PACKAGE')
          EXPORTING
            i_package_name = c_package
            i_force_reload = abap_true
          IMPORTING
            e_package      = lo_package
          EXCEPTIONS
            OTHERS         = 1.
        IF sy-subrc <> 0 OR lo_package IS NOT BOUND.
          add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |load: { sy_message( ) }| ).
          RETURN.
        ENDIF.
        CALL METHOD lo_package->('SET_CHANGEABLE')
          EXPORTING
            i_changeable      = abap_true
            i_suppress_dialog = abap_true
          EXCEPTIONS
            OTHERS            = 1.
        CALL METHOD lo_package->('DELETE')
          EXPORTING
            i_suppress_dialog = abap_true
          EXCEPTIONS
            OTHERS            = 1.
        IF sy-subrc <> 0.
          add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |delete: { sy_message( ) }| ).
          CALL METHOD lo_package->('SET_CHANGEABLE')
            EXPORTING
              i_changeable = abap_false
            EXCEPTIONS
              OTHERS       = 1.
          RETURN.
        ENDIF.
        CALL METHOD lo_package->('SAVE')
          EXPORTING
            i_transport_request = mv_request
            i_suppress_dialog   = abap_true
          EXCEPTIONS
            OTHERS              = 1.
        IF sy-subrc <> 0.
          add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = |save: { sy_message( ) }| ).
          RETURN.
        ENDIF.
      CATCH cx_sy_dyn_call_error cx_sy_ref_is_initial INTO lx_call.
        add_log( iv_step = `package` iv_object = c_package iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
        RETURN.
    ENDTRY.
    commit( ).
    add_log( iv_step = `package` iv_object = c_package iv_status = `DELETED` ).
  ENDMETHOD.


  METHOD purge_deleted_entries.
    " Touches: TADIR entries flagged for deletion that belonged to ZLG7_TEST
    " (and the package's own entry) with our names. A deleted object keeps such
    " an entry until its request is released; the marked requests are deleted
    " instead, so the entry is dropped here.
    DATA lt_flagged TYPE tt_object.
    DATA ls_flagged TYPE ty_object.
    DATA lx_call TYPE REF TO cx_sy_dyn_call_error.
    SELECT object obj_name devclass FROM tadir INTO TABLE lt_flagged
      WHERE pgmid = 'R3TR' AND delflag = 'X'
        AND ( devclass = c_package OR ( object = 'DEVC' AND obj_name = c_package ) ).
    LOOP AT lt_flagged INTO ls_flagged.
      IF is_own_name( ls_flagged-obj_name ) = abap_false OR is_env_name( ls_flagged-obj_name ) = abap_true.
        CONTINUE.
      ENDIF.
      TRY.
          CALL FUNCTION 'TR_TADIR_INTERFACE'
            EXPORTING
              wi_delete_tadir_entry = 'X'
              wi_test_modus         = ' '
              wi_tadir_pgmid        = 'R3TR'
              wi_tadir_object       = ls_flagged-object
              wi_tadir_obj_name     = ls_flagged-obj_name
            EXCEPTIONS
              OTHERS                = 1.
          IF sy-subrc = 0.
            add_log( iv_step = `tadir` iv_object = |{ ls_flagged-object } { ls_flagged-obj_name }| iv_status = `REMOVED` ).
          ELSE.
            add_log( iv_step = `tadir` iv_object = |{ ls_flagged-object } { ls_flagged-obj_name }| iv_status = `ERROR` iv_message = sy_message( ) ).
          ENDIF.
        CATCH cx_sy_dyn_call_error INTO lx_call.
          add_log( iv_step = `tadir` iv_object = |{ ls_flagged-object } { ls_flagged-obj_name }| iv_status = `ERROR` iv_message = lx_call->get_text( ) ).
      ENDTRY.
    ENDLOOP.
    commit( ).
  ENDMETHOD.


  METHOD sy_message.
    IF sy-msgid IS INITIAL.
      rv_text = |subrc { sy-subrc }|.
      RETURN.
    ENDIF.
    MESSAGE ID sy-msgid TYPE 'I' NUMBER sy-msgno
      WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4 INTO rv_text.
    rv_text = |{ sy-msgid }/{ sy-msgno } { rv_text }|.
  ENDMETHOD.


  METHOD json_string.
    " A JSON string literal. < > & are written as \u escapes so the line
    " survives being carried in XML unchanged in meaning.
    DATA lv_cr TYPE c LENGTH 1.
    lv_cr = cl_abap_char_utilities=>cr_lf.
    rv_json = iv_value.
    REPLACE ALL OCCURRENCES OF `\` IN rv_json WITH `\\`.
    REPLACE ALL OCCURRENCES OF `"` IN rv_json WITH `\"`.
    REPLACE ALL OCCURRENCES OF `<` IN rv_json WITH `<`.
    REPLACE ALL OCCURRENCES OF `>` IN rv_json WITH `>`.
    REPLACE ALL OCCURRENCES OF `&` IN rv_json WITH `&`.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>newline IN rv_json WITH `\n`.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>horizontal_tab IN rv_json WITH `\t`.
    REPLACE ALL OCCURRENCES OF lv_cr IN rv_json WITH `\r`.
    rv_json = |"{ rv_json }"|.
  ENDMETHOD.


  METHOD json_bool.
    IF iv_value = abap_true.
      rv_json = `true`.
    ELSE.
      rv_json = `false`.
    ENDIF.
  ENDMETHOD.


  METHOD report_lines.
    DATA ls_log TYPE ty_log.
    DATA lv_index TYPE i.
    DATA lv_errors TYPE i.
    DATA lv_ok TYPE abap_bool.
    DATA lv_line TYPE string.
    LOOP AT mt_log INTO ls_log.
      lv_index = sy-tabix.
      IF ls_log-status = `ERROR`.
        lv_errors = lv_errors + 1.
      ENDIF.
      lv_line = |@@LOG \{"n":{ lv_index },"step":{ json_string( ls_log-step ) },"object":{ json_string( ls_log-object ) },|
             && |"status":{ json_string( ls_log-status ) },"message":{ json_string( ls_log-message ) }\}|.
      APPEND lv_line TO rt_lines.
    ENDLOOP.
    IF lv_errors = 0.
      lv_ok = abap_true.
    ENDIF.
    lv_line = |@@RESULT \{"ok":{ json_bool( lv_ok ) },"action":{ json_string( mv_action ) },|
           && |"request":{ json_string( mv_request ) },"package":{ json_string( c_package ) },|
           && |"packageExists":{ json_bool( package_exists( ) ) },"errors":{ lv_errors },"lines":{ lines( mt_log ) }\}|.
    APPEND lv_line TO rt_lines.
  ENDMETHOD.

ENDCLASS.
