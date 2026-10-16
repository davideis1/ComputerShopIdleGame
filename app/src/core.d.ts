// The simulation is untyped plain JS (core/*.js, attached to a shared `CS` object).
// Typed wrappers can replace `any` incrementally as screens need them.
declare module '@core' {
  const CS: any;
  export default CS;
}
