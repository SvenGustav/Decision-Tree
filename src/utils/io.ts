import type { TreeSnapshot } from '../types/tree'

export function exportTree(snapshot: TreeSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `risktree-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importTree(file: File): Promise<TreeSnapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as TreeSnapshot
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          reject(new Error('Invalid tree file: missing nodes or edges arrays'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('Failed to parse JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
