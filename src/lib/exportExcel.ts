/**
 * Genera y descarga un archivo Excel (.xlsx) desde datos en el navegador.
 * Usa formato SpreadsheetML (XML) que Excel, Google Sheets y Numbers abren nativamente.
 */

function escapeXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportToExcel(
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml +=
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += `<Worksheet ss:Name="${escapeXml(sheetName)}">\n<Table>\n`;

  // Header row
  xml += "<Row>\n";
  for (const h of headers) {
    xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
  }
  xml += "</Row>\n";

  // Data rows
  for (const row of rows) {
    xml += "<Row>\n";
    for (const cell of row) {
      if (cell == null || cell === "") {
        xml += '<Cell><Data ss:Type="String"></Data></Cell>\n';
      } else if (typeof cell === "number") {
        xml += `<Cell><Data ss:Type="Number">${cell}</Data></Cell>\n`;
      } else if (typeof cell === "boolean") {
        xml += `<Cell><Data ss:Type="String">${cell ? "Sí" : "No"}</Data></Cell>\n`;
      } else {
        xml += `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>\n`;
      }
    }
    xml += "</Row>\n";
  }

  xml += "</Table>\n</Worksheet>\n</Workbook>";

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xls") ? fileName : `${fileName}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
