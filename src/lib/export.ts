import { CanvasEngine } from '@core/engine/CanvasEngine';
import { ThemeManager } from '@core/editor/ThemeManager';
import { PngExporter } from '@core/io/PngExporter';
import { PrintExporter } from '@core/io/PrintExporter';

export function exportPng(engine: CanvasEngine, themeManager: ThemeManager): void {
  const exporter = new PngExporter(engine.plan, engine.editorState, themeManager);
  exporter.export({ filename: 'involtcad-plan.png', title: 'План помещения' });
}

export function exportPrint(engine: CanvasEngine, themeManager: ThemeManager): void {
  const exporter = new PrintExporter(engine.plan, engine.editorState, themeManager);
  exporter.print({ title: 'План помещения' });
}

export async function exportXlsx(engine: CanvasEngine): Promise<void> {
  const { exportToXlsx } = await import('@core/io/XlsxExporter');
  await exportToXlsx(engine.plan, 'involtcad-spec.xlsx');
}

export async function exportSvg(engine: CanvasEngine): Promise<void> {
  const { exportToSvg } = await import('@core/io/SvgExporter');
  exportToSvg(engine.plan, 'involtcad-plan.svg');
}

export async function exportDxf(engine: CanvasEngine): Promise<void> {
  const { exportToDxf } = await import('@core/io/DxfExporter');
  exportToDxf(engine.plan, 'involtcad-plan.dxf');
}

export function exportPdf(engine: CanvasEngine, themeManager: ThemeManager): void {
  exportPrint(engine, themeManager);
}
