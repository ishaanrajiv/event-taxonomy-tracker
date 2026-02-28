import path from 'node:path'

const textLikeExtensions = new Set(['.txt', '.md'])

export type ParsedDocument = {
  extractedText: string | null
  parseStatus: 'parsed' | 'failed'
  errorMessage?: string
}

export const extractTextFromBuffer = async (
  mimeType: string | null,
  filename: string,
  buffer: Buffer,
): Promise<ParsedDocument> => {
  const ext = path.extname(filename).toLowerCase()

  if (textLikeExtensions.has(ext) || mimeType?.startsWith('text/')) {
    const text = buffer.toString('utf-8').trim()
    return text
      ? { extractedText: text, parseStatus: 'parsed' }
      : { extractedText: null, parseStatus: 'failed', errorMessage: 'No readable text content found.' }
  }

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const mod = await import('pdf-parse')
      const parser = (mod as unknown as { default: (input: Buffer) => Promise<{ text?: string }> }).default
      const result = await parser(buffer)
      const text = result.text?.trim() ?? ''

      return text
        ? { extractedText: text, parseStatus: 'parsed' }
        : { extractedText: null, parseStatus: 'failed', errorMessage: 'PDF has no extractable text.' }
    } catch {
      return { extractedText: null, parseStatus: 'failed', errorMessage: 'PDF parsing failed.' }
    }
  }

  if (
    ext === '.docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const mod = await import('mammoth')
      const mammoth = mod as unknown as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> }
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value.trim()

      return text
        ? { extractedText: text, parseStatus: 'parsed' }
        : { extractedText: null, parseStatus: 'failed', errorMessage: 'DOCX has no extractable text.' }
    } catch {
      return { extractedText: null, parseStatus: 'failed', errorMessage: 'DOCX parsing failed.' }
    }
  }

  return { extractedText: null, parseStatus: 'failed', errorMessage: 'Unsupported source file type.' }
}
