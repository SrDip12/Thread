// El runtime Edge expone process.env, pero TS no lo conoce sin @types/node
// (que no corresponde a Edge). Declaración mínima para tipar las env vars de /api.
declare const process: { env: Record<string, string | undefined> }
