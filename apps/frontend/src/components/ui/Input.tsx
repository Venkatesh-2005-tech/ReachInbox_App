import React from 'react';
import { classNames } from '@/lib/utils';

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, helpText, className, id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={classNames(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
            'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            error ? 'border-red-300' : 'border-gray-300',
            props.disabled ? 'bg-gray-50 text-gray-500' : 'bg-white',
            className,
          )}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  },
);

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, helpText, className, id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          {...props}
          className={classNames(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
            'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            error ? 'border-red-300' : 'border-gray-300',
            props.disabled ? 'bg-gray-50 text-gray-500' : 'bg-white',
            className,
          )}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  },
);
