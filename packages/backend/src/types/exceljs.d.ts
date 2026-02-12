declare module 'exceljs' {
  export default class Workbook {
    creator: string;
    created: Date;
    addWorksheet(name: string): any;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
    };
  }
}
