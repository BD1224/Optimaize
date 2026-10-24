// .sql files are bundled as strings (webpack asset/source; tests/sqlTransform.js under Jest)
declare module '*.sql' {
  const sql: string;
  export default sql;
}
