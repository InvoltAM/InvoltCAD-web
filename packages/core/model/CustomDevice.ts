import { DrawingPrimitive } from './DrawingPrimitive';

/**
 * Пользовательское устройство, созданное в мини-редакторе.
 * Состоит из примитивов черчения, принадлежит категории палитры
 * и сохраняется в локальном хранилище клиента.
 */
export interface CustomDevice {
  id: string;
  name: string;
  category: string;
  primitives: DrawingPrimitive[];
}
