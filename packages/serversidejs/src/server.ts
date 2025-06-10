import { Router } from './router.js';
import { Api } from './api.js';
import { statSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger, useLogger } from './logger.js';
import { FetchManager } from './hooks/fetch.js';

export interface Hook {
  ({req, resolve}: {req: Request, resolve: (req: Request) => Promise<Response | null>}): Promise<Response | null>;
}

export interface FetchHook {
  ({request, fetch}: {request: Request, fetch: any}): Promise<Response>;
}

export class ServerSide {
  private router: Router;
  private api: Api;
  private port: number;
  private staticDir: string;
  private baseDir: string;
  private hook: Hook = ({req, resolve}) => resolve(req);
  private fetchHook: FetchHook = (req) => fetch(req);
  constructor({
    port = 3000,
    paths = {
      routes: 'routes',
      api: 'api',
      public: 'public'
    },
    baseDir
  }: {
    port?: number;
    paths?: {
      routes: string;
      api: string;
      public: string;
    };
    baseDir: string;
  }) {
    this.port = port;
    this.baseDir = baseDir;
    this.staticDir = join(this.baseDir, paths.public);
    this.router = new Router(join(this.baseDir, paths.routes));
    this.api = new Api(join(this.baseDir, paths.api));
  }

  private async serveStatic(path: string): Promise<Response | null> {
    try {
      const filePath = join(this.baseDir, this.staticDir, path);

      const stats = statSync(filePath);
      if (!stats.isFile()) return null;

      const content = readFileSync(filePath);
      const ext = path.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'otf': 'font/otf'
      };

      return new Response(content, {
        headers: {
          'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    } catch (error) {
      return null;
    }
  }

  private async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Intentar servir archivos estáticos primero
    const staticResponse = await this.serveStatic(path);
    if (staticResponse) {
      // const response = await this.hook(req, () => this.serveStatic(path));
      return staticResponse;
    }

    // Determinar el manejador basado en la ruta
    const resolve = path.startsWith('/api') 
      ? this.api.handle.bind(this.api)
      : this.router.handle.bind(this.router);

    const response = await this.hook({req, resolve});
    return response || new Response(JSON.stringify({message: 'Not Found'}), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  async useLogger(logger: any) {
    useLogger(logger);
  }

  async useHook(hook: Hook) {
    this.hook = hook;
  }
  async useFetchHook(hook: FetchHook) {
    const fetchManager = FetchManager.getInstance();
    fetchManager.setFetchHook(hook);
  }

  async serve() {
    const server = Bun.serve({
      port: this.port,
      fetch: this.handle.bind(this)
    });

    console.log(`🚀 Server running at http://localhost:${this.port}`);
    return server;
  }
} 