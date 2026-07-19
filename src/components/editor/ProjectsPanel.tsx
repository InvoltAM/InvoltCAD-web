'use client'

import { useState } from 'react'
import { useEditor } from './EditorContext'
import { projectSync, ProjectMeta } from '@/lib/projects/sync'
import ShareDialog from './ShareDialog'

export default function ProjectsPanel() {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [shareProject, setShareProject] = useState<{ id: string; name: string } | null>(null)
  const { engineRef } = useEditor()

  const loadProjects = async () => {
    setLoading(true)
    try {
      const list = await projectSync.listProjects()
      setProjects(list)
    } catch (err) {
      console.error('Ошибка загрузки проектов:', err)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPanel = () => {
    setOpen(true)
    void loadProjects()
  }

  const handleOpenProject = async (id: string) => {
    if (!engineRef.current) return
    try {
      const { plan } = await projectSync.loadProject(id)
      // Заменяем план в engine
      engineRef.current.plan = plan
      engineRef.current.notifyChanged()
      engineRef.current.requestRender()
      setOpen(false)
    } catch (err) {
      console.error('Ошибка загрузки проекта:', err)
      alert('Ошибка загрузки проекта')
    }
  }

  const handleCreateProject = async () => {
    const name = prompt('Имя нового проекта:', 'Новый проект')
    if (name === null) return
    const trimmed = name.trim() || 'Новый проект'
    try {
      const id = await projectSync.createProject(trimmed)
      await handleOpenProject(id)
      await loadProjects()
    } catch {
      alert('Ошибка создания проекта')
    }
  }

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Удалить проект "${name}"?`)) return
    try {
      await projectSync.deleteProject(id)
      await loadProjects()
    } catch {
      alert('Ошибка удаления проекта')
    }
  }

  const handleDuplicateProject = async (id: string) => {
    try {
      const newId = await projectSync.duplicateProject(id)
      await loadProjects()
      await handleOpenProject(newId)
    } catch {
      alert('Ошибка дублирования проекта')
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const currentId = projectSync.getCurrentProjectId()

  return (
    <>
      {/* Projects button */}
      <button
        onClick={handleOpenPanel}
        className="absolute left-20 top-3 z-40 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:left-3"
        title="Проекты"
      >
        📁
      </button>

      {/* Projects panel overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-1/2 top-1/2 flex max-h-[80vh] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white p-4 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Проекты</span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 rounded-lg border border-orange-500 bg-orange-50 px-3 py-2 text-sm text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300"
              >
                ＋ Новый проект
              </button>
              <button className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                📂 Импорт JSON
              </button>
            </div>

            <input
              type="text"
              placeholder="Поиск проектов..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />

            <div className="max-h-64 flex-1 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">Нет проектов</div>
              ) : (
                filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      p.id === currentId
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(p.updatedAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenProject(p.id)}
                        className="rounded border border-gray-200 p-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600"
                        title="Открыть"
                      >
                        ↗
                      </button>
                      <button
                        onClick={() => setShareProject({ id: p.id, name: p.name })}
                        className="rounded border border-gray-200 p-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600"
                        title="Поделиться"
                      >
                        👥
                      </button>
                      <button
                        onClick={() => handleDuplicateProject(p.id)}
                        className="rounded border border-gray-200 p-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600"
                        title="Дублировать"
                      >
                        ⎘
                      </button>
                      <button
                        onClick={() => handleDeleteProject(p.id, p.name)}
                        className="rounded border border-gray-200 p-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600"
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {shareProject && (
        <ShareDialog
          projectId={shareProject.id}
          projectName={shareProject.name}
          onClose={() => setShareProject(null)}
        />
      )}
    </>
  )
}
