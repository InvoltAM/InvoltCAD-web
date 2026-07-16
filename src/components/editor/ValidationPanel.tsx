'use client'

import { useCadStore } from '@/stores/cadStore'

export default function ValidationPanel() {
  const issues = useCadStore((s) => s.validationIssues)

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const infos = issues.filter((i) => i.severity === 'info').length

  return (
    <div className="absolute right-[590px] top-3 z-20 hidden w-56 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        Проверка
      </div>
      <div className="p-3">
        {issues.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Ошибок и предупреждений не найдено
          </div>
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              {errors > 0 && (
                <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                  {errors} ошибок
                </span>
              )}
              {warnings > 0 && (
                <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {warnings} предупр.
                </span>
              )}
              {infos > 0 && (
                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {infos} замеч.
                </span>
              )}
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {issues.slice(0, 10).map((issue, idx) => (
                <div
                  key={idx}
                  className={`rounded p-2 text-xs ${
                    issue.severity === 'error'
                      ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : issue.severity === 'warning'
                        ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                        : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                  }`}
                  title={issue.message}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
