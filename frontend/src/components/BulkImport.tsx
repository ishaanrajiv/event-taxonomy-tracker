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
      const response = await axios.post<ImportResult>(`${apiBase}/import/${format}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResult(response.data);
      if (response.data.imported > 0) {
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error importing file:', error);
      setResult({
        imported: 0,
        total: 0,
        errors: [axios.isAxiosError(error) ? error.response?.data?.detail || 'Failed to import file' : 'Failed to import file']
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Bulk Import Events
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Import multiple events at once using CSV or JSON files
      </p>

      {/* Templates */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Step 1: Download Template
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => downloadTemplate('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            📄 Download JSON Template
          </button>
          <button
            onClick={() => downloadTemplate('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            📊 Download CSV Template
          </button>
        </div>
      </div>

      {/* Upload */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Step 2: Upload Filled Template
        </h3>
        <div className="flex gap-3">
          <div>
            <label className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer inline-block">
              📤 Upload JSON
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, 'json')}
                className="hidden"
                disabled={importing}
              />
            </label>
          </div>
          <div>
            <label className="px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition cursor-pointer inline-block">
              📤 Upload CSV
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
      </div>

      {/* Loading */}
      {importing && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-800 dark:text-blue-300">Importing events...</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={`mt-6 p-4 rounded-lg border ${
          result.errors && result.errors.length > 0
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <p className={`font-medium ${
            result.errors && result.errors.length > 0
              ? 'text-yellow-800 dark:text-yellow-300'
              : 'text-green-800 dark:text-green-300'
          }`}>
            Imported {result.imported} of {result.total} events
          </p>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">Errors:</p>
              <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((error, idx) => (
                  <li key={idx} className="font-mono text-xs">• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Help */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Tips:</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>• Download a template to see the required format</li>
          <li>• CSV files can have multiple properties per event (use multiple rows with the same event_name)</li>
          <li>• JSON files allow you to define complete events with all properties in one structure</li>
          <li>• Existing properties with matching names will be reused (data types must match)</li>
        </ul>
      </div>
    </div>
  );
}
