// Mock for exceljs
class Workbook {
  constructor() {
    this.creator = '';
    this.created = new Date();
    this.worksheets = [];
  }
  
  addWorksheet(name) {
    const mockWorksheet = {
      name: name || 'Sheet1',
      mergeCells: jest.fn(),
      getCell: jest.fn(() => ({
        value: '',
        font: {},
        alignment: {},
      })),
      addRow: jest.fn(() => ({
        font: {},
        fill: {},
        eachCell: jest.fn(),
      })),
      columns: [],
      getColumn: jest.fn(() => ({ numFmt: '' })),
      eachRow: jest.fn((callback) => {
        // Call callback for a few mock rows
        for (let i = 1; i <= 5; i++) {
          const mockRow = {
            eachCell: jest.fn((cellCallback) => {
              cellCallback({ border: {} });
            }),
          };
          callback(mockRow, i);
        }
      }),
    };
    this.worksheets.push(mockWorksheet);
    return mockWorksheet;
  }
  
  get xlsx() {
    return {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
    };
  }
}

// Export for both CommonJS and ES6 default imports
module.exports = Workbook;
module.exports.default = Workbook;
module.exports.Workbook = Workbook;
