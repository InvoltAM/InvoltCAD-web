/**
 * Проверка селективности автоматических выключателей по ПУЭ.
 */

export interface SelectivityResult {
  compliant: boolean
  issues: Array<{
    level: string
    message: string
  }>
}

/**
 * Проверка селективности между вводным и групповыми автоматами.
 */
export function checkSelectivity(
  inputRating: number,
  groupRatings: number[]
): SelectivityResult {
  const issues: SelectivityResult['issues'] = []

  // Вводной автомат должен быть больше или равен сумме групповых с учётом Кс
  const totalGroupRating = groupRatings.reduce((sum, r) => sum + r, 0)
  const demandFactor = 0.6
  const effectiveLoad = totalGroupRating * demandFactor

  if (inputRating < effectiveLoad) {
    issues.push({
      level: 'error',
      message: `Вводной автомат (${inputRating}А) меньше эффективной нагрузки (${effectiveLoad.toFixed(1)}А)`,
    })
  }

  // Селективность по току отключения: вводной должен быть минимум в 1.6 раза больше группового
  for (const rating of groupRatings) {
    if (inputRating < rating * 1.6) {
      issues.push({
        level: 'warning',
        message: `Нарушена селективность: вводной (${inputRating}А) < 1.6 × группового (${rating}А)`,
      })
    }
  }

  return {
    compliant: issues.filter((i) => i.level === 'error').length === 0,
    issues,
  }
}
