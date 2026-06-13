'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {icon && (
        <div className="mb-6 text-zinc-500 opacity-20">
          {React.cloneElement(icon as React.ReactElement, { size: 80 })}
        </div>
      )}
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 max-w-xs mb-8">{description}</p>
      {action}
    </div>
  );
};
