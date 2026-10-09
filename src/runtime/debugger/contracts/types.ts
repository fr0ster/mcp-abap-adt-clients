/**
 * The two runtime base shapes the debugger and memory-snapshot contracts
 * extend. @mcp-abap-adt/interfaces carried them until 30.0.0 (#64), which
 * moved these contracts to this research branch; nothing published declares
 * them any more.
 */
export interface IRuntimeAnalysisObject<TKind extends string = string> {
  readonly kind: TKind;
}

export interface IListableRuntimeObject<
  TResult,
  TOptions = undefined,
  TKind extends string = string,
> extends IRuntimeAnalysisObject<TKind> {
  list(options?: TOptions): Promise<TResult>;
}
