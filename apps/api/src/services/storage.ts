import fs from 'node:fs'
import path from 'node:path'

const defaultStorageRoot = path.resolve(process.cwd(), '../../storage')

export const storageRoot = process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : defaultStorageRoot

export const ensureStorageRoot = (): void => {
  fs.mkdirSync(storageRoot, { recursive: true })
}

export const buildSourceStoragePath = (featureId: string, sourceId: string, originalFilename: string): string => {
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return path.join('features', featureId, 'sources', `${sourceId}-${safeFilename}`)
}

export const writeSourceFile = (relativePath: string, content: Buffer): string => {
  const absolutePath = path.join(storageRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content)
  return absolutePath
}

export const deleteStoredFile = (relativePath: string | null): void => {
  if (!relativePath) {
    return
  }

  const absolutePath = path.join(storageRoot, relativePath)
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath)
  }
}
