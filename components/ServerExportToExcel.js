'use client';

import ExportToExcel from '@/components/ExportToExcel';

/**
 * Client wrapper for ExportToExcel usable inside server components.
 * Pass pre-serialized data (JSON.parse(JSON.stringify(...))) from the server component.
 */
export default function ServerExportToExcel({ data, columns, filename, sheetName, className }) {
  return (
    <ExportToExcel
      data={data}
      columns={columns}
      filename={filename}
      sheetName={sheetName}
      className={className}
    />
  );
}
