import { useState } from 'react'
import { Download, Upload, FileJson, FileSpreadsheet } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function BulkImport({ apiBase, onImportComplete }) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const downloadTemplate = async (format) => {
    try {
      const response = await axios.get(`${apiBase}/export/template/${format}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `event_template.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Failed to download template')
    }
  }

  const handleFileUpload = async (event, format) => {
    const file = event.target.files[0]
    if (!file) return

    setImporting(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${apiBase}/import/${format}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(response.data)
      if (response.data.imported > 0) {
        setTimeout(() => {
          onImportComplete()
        }, 2000)
      }
    } catch (error) {
      console.error('Error importing file:', error)
      setResult({
        imported: 0,
        total: 0,
        errors: [error.response?.data?.detail || 'Failed to import file']
      })
    } finally {
      setImporting(false)
      event.target.value = null
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">
        Bulk Import Events
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Import multiple events at once using CSV or JSON files
      </p>

      {/* Templates */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">
          Step 1: Download Template
        </h3>
        <div className="flex gap-3">
          <Button
            onClick={() => downloadTemplate('json')}
            variant="outline"
          >
            <FileJson className="mr-2 h-4 w-4" />
            Download JSON Template
          </Button>
          <Button
            onClick={() => downloadTemplate('csv')}
            variant="outline"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>
        </div>
      </div>

      {/* Upload */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          Step 2: Upload Filled Template
        </h3>
        <div className="flex gap-3">
          <div>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload JSON
                </span>
              </Button>
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
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </span>
              </Button>
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
        <Card className="mt-6 border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-primary">Importing events...</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className={`mt-6 ${result.errors && result.errors.length > 0
            ? 'border-yellow-500/50 bg-yellow-500/5'
            : 'border-green-500/50 bg-green-500/5'
          }`}>
          <CardContent className="p-4">
            <p className="font-medium">
              Imported {result.imported} of {result.total} events
            </p>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Errors:</p>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((error, idx) => (
                    <li key={idx} className="font-mono text-xs">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card className="mt-8 bg-muted/30">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">Tips:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Download a template to see the required format</li>
            <li>• CSV files can have multiple properties per event (use multiple rows with the same event_name)</li>
            <li>• JSON files allow you to define complete events with all properties in one structure</li>
            <li>• Existing properties with matching names will be reused (data types must match)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
