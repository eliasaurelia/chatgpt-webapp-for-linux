import type { BrowserWindowConstructorOptions } from 'electron';
import type { WindowSettings } from './settings-store.ts';

export interface BoundsProvider {
  isMaximized(): boolean;
  getNormalBounds(): {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

export function createWindowOptionsFromState(
  state: WindowSettings,
): Pick<BrowserWindowConstructorOptions, 'width' | 'height' | 'x' | 'y' | 'frame' | 'show' | 'backgroundColor'> {
  return {
    width: state.width,
    height: state.height,
    ...(state.x === undefined ? {} : { x: state.x }),
    ...(state.y === undefined ? {} : { y: state.y }),
    frame: true,
    show: true,
    backgroundColor: '#f7f7f2',
  };
}

export function extractWindowState(window: BoundsProvider): WindowSettings {
  const bounds = window.getNormalBounds();
  return {
    width: bounds.width,
    height: bounds.height,
    ...(bounds.x === undefined ? {} : { x: bounds.x }),
    ...(bounds.y === undefined ? {} : { y: bounds.y }),
    maximized: window.isMaximized(),
  };
}
