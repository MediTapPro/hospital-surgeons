import type { ReactNode } from 'react';
import { cn } from '../../_lib/utils';

export type AdminDataTableColumn<T> = {
  id: string;
  label: string;
  widthClassName: string;
  cell: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  sticky?: 'right';
};

type AdminDataTableProps<T> = {
  columns: AdminDataTableColumn<T>[];
  data: T[];
  emptyMessage: string;
  getRowKey: (row: T) => string;
  minWidthClassName: string;
};

export function AdminDataTable<T>({
  columns,
  data,
  emptyMessage,
  getRowKey,
  minWidthClassName,
}: AdminDataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full table-fixed text-sm', minWidthClassName)}>
        <colgroup>
          {columns.map((column) => <col key={column.id} className={column.widthClassName} />)}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  'whitespace-nowrap px-5 py-4 text-left font-semibold text-slate-700',
                  column.sticky === 'right' && 'sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-4 text-center shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]',
                  column.headerClassName,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={getRowKey(row)} className="transition-colors hover:bg-teal-50/40">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-5 py-4 align-middle',
                      column.sticky === 'right' && 'sticky right-0 z-10 border-l border-slate-200 bg-white px-4 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]',
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
