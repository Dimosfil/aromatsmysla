declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export interface QueryResults {
    columns: string[];
    values: unknown[][];
  }

  export interface Statement {
    bind(values?: Record<string, unknown> | unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: Record<string, unknown> | unknown[]): Database;
    exec(sql: string): QueryResults[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
