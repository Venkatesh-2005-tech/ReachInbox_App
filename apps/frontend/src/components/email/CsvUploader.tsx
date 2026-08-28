'use client';

import React, { useRef } from 'react';
import Papa from 'papaparse';
import { parseCsvEmails } from '@/lib/utils';

interface CsvUploaderProps {
  onParsed: (valid: string[], invalid: number) => void;
}

export function CsvUploader({ onParsed }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;

      // If it looks like CSV with headers, try papaparse
      const isCsv = file.name.endsWith('.csv');
      let allValues: string[] = [];

      if (isCsv) {
        const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
        // Flatten all cells — pick cells that look like emails
        allValues = result.data.flat().map((v) => String(v).trim());
      } else {
        allValues = text.split(/[\n,;\r\t]+/).map((v) => v.trim());
      }

      const { valid, invalid } = parseCsvEmails(allValues.join('\n'));
      onParsed(valid, invalid.length);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so re-uploading same file triggers onChange
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-brand-400 hover:bg-brand-50"
    >
      <svg className="mb-3 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p className="text-sm font-medium text-gray-700">Drop a CSV / TXT file here</p>
      <p className="mt-1 text-xs text-gray-500">or click to browse — one email per line or comma-separated</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={handleChange}
        aria-label="Upload CSV file"
      />
    </div>
  );
}
