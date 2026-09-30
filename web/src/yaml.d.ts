/** YAML files are imported as plain data (see the yaml plugin in vite.config.ts). */
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
