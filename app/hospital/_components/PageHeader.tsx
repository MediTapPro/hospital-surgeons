import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-slate-600">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

