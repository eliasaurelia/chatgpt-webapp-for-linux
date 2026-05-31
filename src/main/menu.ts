import { Menu, type MenuItemConstructorOptions } from 'electron';
import type { BlockerController } from './blocker-controller.ts';
import type { PrivacyService } from './privacy-service.ts';

export interface MenuDependencies {
  blockerController: BlockerController;
  openSettingsWindow(): void;
  privacyService: PrivacyService;
  reloadMainWindow(): void;
}

export function installApplicationMenu(dependencies: MenuDependencies): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Privacy',
          accelerator: 'CmdOrCtrl+,',
          click: dependencies.openSettingsWindow,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload ChatGPT',
          accelerator: 'CmdOrCtrl+R',
          click: dependencies.reloadMainWindow,
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Privacy',
      submenu: [
        {
          label: 'Clear Cache',
          click: () => {
            void dependencies.privacyService.clearCache();
          },
        },
        {
          label: 'Clear Site Data and Sign Out',
          click: () => {
            void dependencies.privacyService.clearSiteData();
          },
        },
        {
          label: 'Tracker Blocker Status',
          click: dependencies.openSettingsWindow,
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Blocker Enabled',
          enabled: false,
          checked: dependencies.blockerController.getStatus().enabled,
          type: 'checkbox',
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

