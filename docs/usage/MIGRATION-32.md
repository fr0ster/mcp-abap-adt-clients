# Migrating to 32.0.0

32.0.0 requires `@mcp-abap-adt/interfaces-adt` `^18.0.0`.
Declare the same range wherever you import its contracts. `adt-strategies`
0.12.0 declares it too; `interfaces-adt-connection` remains `^3.0.0`.
The clients' strategies devDependency remains `^0.10.0`.

## Custom result sets

`IClassResults`, `IProgramResults`, `IFunctionGroupResults` and `IIncludeResults`
now require `enhancementElements` and `enhancementOptions`. Add each with
`rawDocument` (imported from `@mcp-abap-adt/adt-clients`) or your own strategy.
A set spread from `classDocuments`, `programDocuments`, `functionGroupDocuments`
or `includeDocuments` already has them. Both reads answer their XML document
by default, and each member makes one request.

## Enhancement subtypes and creation

Remove code using `enhoxh` or `enhsxs`: `EnhancementType` is now only
`enhoxhb | enhoxhh | enhsxsb`. The removed subtypes answered 500 in the
measured reads; there is no replacement ADT subtype promised for them.
The retained subtype codes are `ENHO/XHB`, `ENHO/XHH` and `ENHS/XSB`.

- For `enhoxhb` create, pass `enhancementSpot`, the existing spot's name.
- For `enhoxhh` create, pass `enhancedObject` (`uri`, `type`, `name`, `program`),
  `enhancementOption` and `enhancementMode`. Read the host's
  `readEnhancementOptions` document and use the option's `enhocore:full_name`.
  Map its `enho:mode` word `static` to `S`, `dynamic` to `D`; create takes codes,
  not those words.
- For include host reads, pass `{ context: 'MAIN_PROGRAM_NAME' }` as the second
  argument to both `readEnhancementElements` and `readEnhancementOptions`.
  The library turns that name into the program URI for the query.

The per-subtype metadata/create content types and XHH source Accept
`text/plain` replace the shared wire type that SAP refused with 406/415.
`ACCEPT_ENHANCEMENT` and `CT_ENHANCEMENT` were internal, never package exports.
No public constant imports need replacing.

See [Enhancements and their hosts](CLIENT_API_REFERENCE.md#enhancements-and-their-hosts)
for class and include reads, a create from an option, and the content-type table.
