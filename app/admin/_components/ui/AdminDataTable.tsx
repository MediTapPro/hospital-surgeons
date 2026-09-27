import type { ReactNode } from 'react';
import { cn } from '../../_lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

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
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
    disabled?: boolean;
    client?: boolean;
  };
};

export function AdminDataTable<T>({
  columns,
  data,
  emptyMessage,
  getRowKey,
  minWidthClassName,
  pagination,
}: AdminDataTableProps<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const visibleData = pagination?.client
    ? data.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
    : data;

  return (
    <div>
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
            {visibleData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleData.map((row) => (
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
      {pagination && (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {pagination.total === 0 ? 'No records' : `Page ${pagination.page} of ${totalPages} · ${pagination.total} total`}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 whitespace-nowrap">
              <span>Rows</span>
              <Select value={String(pagination.pageSize)} onValueChange={(value) => pagination.onPageSizeChange(Number(value))} disabled={pagination.disabled}>
                <SelectTrigger className="h-9 w-[78px]"><SelectValue /></SelectTrigger>
                <SelectContent>{(pagination.pageSizeOptions || [10, 20, 25, 50, 100]).map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <Button variant="outline" size="sm" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.disabled || pagination.page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))} disabled={pagination.disabled || pagination.page >= totalPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
