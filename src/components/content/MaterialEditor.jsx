import { Plus, Trash2, Upload } from 'lucide-react'
import { Button, Input, Select } from '../ui'
import { useApp } from '../../store/AppContext'
import { uid } from '../../lib/utils'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

const extType = (name = '') => {
  const ext = name.split('.').pop().toLowerCase()
  const map = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt', zip: 'zip', txt: 'doc' }
  return map[ext] || 'file'
}

const TYPES = ['pdf', 'doc', 'xls', 'ppt', 'zip', 'file']

// Lesson materials editor: real file upload (stored as a data URL) or a link.
export function MaterialEditor({ materials = [], onChange }) {
  const { toast } = useApp()

  const update = (id, patch) => onChange(materials.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const add = () => onChange([...materials, { id: uid('m'), name: '', type: 'pdf', url: '' }])
  const remove = (id) => onChange(materials.filter((m) => m.id !== id))

  const onFile = (id, file) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast('File is too large. Maximum size is 2 MB — use a link instead.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => update(id, { name: file.name, type: extType(file.name), url: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      {materials.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400">
          No materials attached.
        </p>
      )}

      {materials.map((m) => (
        <div key={m.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={m.type} onChange={(e) => update(m.id, { type: e.target.value })} className="h-9 w-24 text-xs">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </Select>
            <Input
              className="min-w-0 flex-1"
              value={m.name}
              onChange={(e) => update(m.id, { name: e.target.value })}
              placeholder="Material name (e.g. Module 1.pdf)"
            />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" /> Upload
              <input type="file" className="hidden" onChange={(e) => onFile(m.id, e.target.files?.[0])} />
            </label>
            <button
              type="button"
              onClick={() => remove(m.id)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove material"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <Input
            className="mt-2 text-xs"
            value={m.url?.startsWith('data:') ? '' : m.url || ''}
            onChange={(e) => update(m.id, { url: e.target.value })}
            placeholder={m.url?.startsWith('data:') ? 'File uploaded ✓' : 'Or paste a link (https://…)'}
            disabled={m.url?.startsWith('data:')}
          />
          {m.url?.startsWith('data:') && (
            <p className="mt-1 text-xs text-emerald-600">Uploaded file attached. Clear the name or remove to replace.</p>
          )}
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={add}>
        Add material
      </Button>
    </div>
  )
}

export default MaterialEditor
