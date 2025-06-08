import { Router } from './router.js';
import { Api } from './api.js';
import { statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { useLogger } from './logger.js';

export class ServerSide {
  private router: Router;
  private api: Api;
  private port: number;
  private staticDir: string;
  private baseDir: string;

  private middlewares: any[] = [];

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

  async handleFetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Intentar servir archivos estáticos primero
    const staticResponse = await this.serveStatic(path);
    if (staticResponse) return staticResponse;

    // Ejecutar Global Middlewares
    for (const middleware of this.middlewares) {
      await middleware(req);
    }

    // Si la ruta comienza con /api, usar el manejador de API
    if (path.startsWith('/api')) {
      return await this.api.handle(req);
    }

    // Si no, usar el router normal
    return await this.router.handle(req);
  }
  async addMiddlewares(middlewares: any[]) {
    this.middlewares = middlewares;
  }
  async useLogger(logger: any) {
    useLogger(logger);
  }

  async serve() {
    const server = Bun.serve({
      port: this.port,
      fetch: this.handleFetch.bind(this)
    });

    console.log(`🚀 Server running at http://localhost:${this.port}`);
    return server;
  }
} 