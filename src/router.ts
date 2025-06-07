import { readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { View } from './view';

type RouteHandler = (req: Request) => Promise<Response> | Response;

interface Route {
  path: string;
  pattern: RegExp;
  params: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private routesPath: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.routesPath = join(__dirname, 'routes');
    this._loadRoutes();
  }

  private _loadRoutes() {
    this._scanDirectory(this.routesPath);
  }

  private _scanDirectory(dir: string, basePath: string = '') {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursivamente escanear subdirectorios
        this._scanDirectory(fullPath, join(basePath, entry));
      } else if (entry.endsWith('.comp') && !entry.startsWith('_')) {
        // Convertir la ruta del archivo a una ruta URL
        const relativePath = relative(this.routesPath, fullPath);
        const { routePath, pattern, params } = this._filePathToRoutePath(relativePath);
        
        console.log('ROUTE PATH', routePath, relativePath, pattern, params);
        
        // Registrar la ruta
        this.routes.push({
          path: routePath,
          pattern,
          params,
          handler: async (req: Request) => {
            const viewName = relativePath.replace('.comp', '');
            const url = new URL(req.url);
            const matches = url.pathname.match(pattern);
            const routeParams = {};
            
            if (matches) {
              params.forEach((param, index) => {
                routeParams[param] = matches[index + 1];
              });
            }

            return await View.render(viewName, { params: routeParams });
          }
        });
      }
    }
  }

  private _filePathToRoutePath(filePath: string): { routePath: string; pattern: RegExp; params: string[] } {
    // Convertir la ruta del archivo a una ruta URL
    let routePath = filePath
      .replace(/\\/g, '/') // Normalizar separadores
      .replace(/\.comp$/, '') // Remover extensión .comp
      .replace(/\/index$/, '/') // Convertir /index a /
      .replace(/^index$/, '/'); // Convertir index a /

    // Asegurarse de que la ruta comience con /
    if (!routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }

    if(routePath.endsWith('/') && routePath !== '/') {
      routePath = routePath.slice(0, -1);
    }

    // Procesar parámetros dinámicos
    const params: string[] = [];
    let patternStr = routePath
      .split('/')
      .map(segment => {
        if (segment.startsWith('[:') && segment.endsWith(']')) {
          const paramName = segment.slice(2, -1);
          params.push(paramName);
          return '([^/]+)'; // Cualquier carácter que no sea /
        }
        return segment;
      })
      .join('/');

    // Crear el patrón regex
    const pattern = new RegExp(`^${patternStr}$`);

    return { routePath, pattern, params };
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Buscar la ruta que coincida
    const route = this.routes.find(r => r.pattern.test(path));
    
    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      return await route.handler(req);
    } catch (error) {
      console.error('Error handling route:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
} 