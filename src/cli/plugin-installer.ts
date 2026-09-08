import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export function installAntigravityPlugin(): string {
  const pluginDir = path.join(os.homedir(), '.gemini/config/plugins/mdmedia_narrator');
  const sidecarDir = path.join(pluginDir, 'sidecars/narrator');
  const assetsDir = path.join(pluginDir, 'assets');

  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // Locate the installed mdmedia package root dynamically
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(currentFile), '../..');

  // 1. plugin.json
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(
      {
        name: 'mdmedia_narrator',
        description: 'Narrate agent responses from Antigravity conversations in real time using Gemini Flash 3.1 TTS and mdmedia.',
        logo: 'assets/logo.svg',
      },
      null,
      2
    )
  );

  // 2. sidecar.json
  fs.writeFileSync(
    path.join(sidecarDir, 'sidecar.json'),
    JSON.stringify(
      {
        command: 'node',
        args: ['main.mjs'],
        restart_policy: 'always',
        has_web_ui: true,
        ui_config: {
          display_name: 'mdmedia Narrator',
          views: [
            {
              path: '/',
              entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE',
              title: 'Narrator',
            },
          ],
        },
      },
      null,
      2
    )
  );

  // 3. Portable package.json pointing to the installed mdmedia package
  fs.writeFileSync(
    path.join(sidecarDir, 'package.json'),
    JSON.stringify(
      {
        name: 'mdmedia-narrator-sidecar',
        type: 'module',
        private: true,
        dependencies: {
          mdmedia: `file:${packageRoot}`,
        },
      },
      null,
      2
    )
  );

  return pluginDir;
}
