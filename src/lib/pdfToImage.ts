/**
 * Конвертирует первую страницу PDF-файла в data URL PNG.
 * Работает только в браузере (использует pdfjs-dist).
 */
export async function pdfFirstPageToPng(file: File, scale = 2): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')

  // Worker из CDN, соответствующий версии библиотеки
  const version = (pdfjsLib as any).version ?? '6.2.108'
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    await loadingTask.destroy()
  }
}
