import { ServerSide } from '../src/server.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new ServerSide({
  port: 3000,
  paths: {
    routes: 'routes',
    api: 'api',
    public: 'public'
  },
  baseDir: __dirname
});

await server.serve();
