# Migrating to 27.0.0

27.0.0 finishes #109: every factory of `AdtClient` answers a contract. Three of
them answered their concrete class until now, and the service binding loses
three members. Nothing else changed.

## 1. Factories answer contracts

| Factory | Answered | Answers now |
|---|---|---|
| `getUtils()` | `AdtUtils` | `IUtilsContract<typeof utilDocuments>` |
| `getFeatureToggle()` | `AdtFeatureToggle` | `IFeatureToggleContract<typeof featureToggleDocuments>` |
| `getServiceBinding()` | `AdtServiceBinding` | `IServiceBindingContract<typeof serviceDocuments>` |

Each composition holds every method its class has, so every call compiles as
before. What stops compiling is a variable typed by the class:

```typescript
// before
const utils: AdtUtils = client.getUtils();
// after — name the contract, or let the type be inferred
const utils = client.getUtils();
```

## 2. `@mcp-abap-adt/interfaces-adt` 13.2

adt-clients depends on `@mcp-abap-adt/interfaces-adt` `^13.2.0`, which adds the
two service binding atoms and `IServiceGroupParams`. If your package imports
`interfaces-adt` too, declare `^13.2.0` so npm installs one copy:
`npm ls @mcp-abap-adt/interfaces-adt` must show one version.
`@mcp-abap-adt/adt-strategies` 0.8.1 declares the same range.

## 3. Service binding members removed

| Removed | Instead |
|---|---|
| `generateServiceBinding(params)` | `getServiceGroup({ objectname, serviceType, servicename, serviceversion, srvdname })` — the same request; it never generated anything |
| `classifyServiceBinding(params)` | nothing — the request it sent was answered `405`; it returns once Eclipse's request is recorded |
| `getService()` | `getServiceBinding()` |

The types `IGenerateServiceBindingParams` and `IClassifyServiceBindingParams`
and the result slots `generation` and `classification` are gone with them. A
result set spreading `serviceDocuments` is unaffected; one that names those
two slots drops them.
