import { useState, ChangeEvent } from 'react';
import axios from 'axios';

interface BulkImportProps {
  apiBase: string;
  onImportComplete: () => void;
}

interface ImportResult {
  imported: number;
  total: number;
  errors?: string[];
}

type FileFormat = 'json' | 'csv';

export default function BulkImport({ apiBase, onImportComplete }: BulkImportProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const isRetryableImportError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) return false;
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 500 && status <= 599;
  };

  const downloadTemplate = async (format: FileFormat) => {
    try {
      const response = await axios.get(`${apiBase}/export/template/${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `event_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template');
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, format: FileFormat) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const importRequest = () => axios.post<ImportResult>(`${apiBase}/import/${format}`, formData);
      let response;
      try {
        response = await importRequest();
      } catch (error) {
        if (!isRetryableImportError(error)) {
          throw error;
        }
        // One retry helps with transient first-request failures.
        await new Promise((resolve) => setTimeout(resolve, 600));
        response = await importRequest();
      }

      setResult(response.data);
      if (response.data.imported > 0) {
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error importing file:', error);
      const detail =
        axios.isAxiosError(error)
          ? error.response?.data?.detail || `Import request failed${error.response?.status ? ` (${error.response.status})` : ''}`
          : 'Failed to import file';
      setResult({
        imported: 0,
        total: 0,
        errors: [detail]
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="p-5">
      <div className="mb-6">
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
          Bulk Import
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Import multiple events at once using CSV or JSON files
        </p>
      </div>

      {/* Step 1 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
            1
          </div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Download Template
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadTemplate('json')}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border border-primary/30 bg-primary/5 text-primary rounded-lg hover:bg-primary/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            JSON Template
          </button>
          <button
            onClick={() => downloadTemplate('csv')}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border border-success/30 bg-success/5 text-success rounded-lg hover:bg-success/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV Template
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
            2
          </div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Upload Filled Template
          </h3>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border border-input bg-card text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload JSON
            <input
              type="file"
              accept=".json"
              onChange={(e) => handleFileUpload(e, 'json')}
              className="hidden"
              disabled={importing}
            />
          </label>
          <label className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border border-input bg-card text-foreground rounded-lg hover:bg-muted cursor-pointer transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, 'csv')}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Loading */}
      {importing && (
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 animate-pulse-glow">
          <p className="text-xs font-medium text-primary">Importing events...</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={`p-3 rounded-lg border ${
          result.errors && result.errors.length > 0
            ? 'border-primary/20 bg-primary/5'
            : 'border-success/20 bg-success/5'
        }`}>
          <p className={`text-xs font-semibold ${
            result.errors && result.errors.length > 0
              ? 'text-primary'
              : 'text-success'
          }`}>
            Imported {result.imported} of {result.total} events
          </p>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-foreground mb-1">Errors:</p>
              <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((error, idx) => (
                  <li key={idx} className="text-[11px] font-mono text-muted-foreground">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 p-3 rounded-lg bg-muted/30 border border-border/40">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Tips</h4>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          <li>Download a template to see the required format</li>
          <li>CSV files: use multiple rows with the same event_name for multiple properties</li>
          <li>JSON files: define complete events with all properties in one structure</li>
          <li>Existing properties with matching names will be reused (data types must match)</li>
        </ul>
      </div>
    </div>
  );
}
