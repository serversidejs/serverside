import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { logger } from './logger';

interface ApiHandler {
  path: string;
  pattern: RegExp;
  params: string[];
  handler: (req: Request) => Promise<Response> | Response;
}

export class Api {
  private routes: ApiHandler[] = [];
  private apiPath: string;

  constructor(path: string) {
    this.apiPath = path;
    this._loadRoutes();
  }

  private _loadRoutes() {
    this._scanDirectory(this.apiPath);
    logger.info('API Routes loaded completed')
  }

  private _scanDirectory(dir: string, basePath: string = '') {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursivamente escanear subdirectorios
        this._scanDirectory(fullPath, join(basePath, entry));
      } else if (entry.endsWith('.js') && !entry.startsWith('_')) {
        // Convertir la ruta del archivo a una ruta URL
        const relativePath = relative(this.apiPath, fullPath);
        const { routePath, pattern, params } = this._filePathToRoutePath(relativePath);
        
        logger.info(`Route Loaded /api${routePath} from /api/${relativePath}`);
        // Registrar la ruta
        this.routes.push({
          path: routePath,
          pattern,
          params,
          handler: async (req: Request) => {
            const apiName = relativePath.replace('.js', '');
            const url = new URL(req.url);
            const path = url.pathname.replace(/^\/api/, '');
            const matches = path.match(pattern);
            const routeParams: Record<string, string> = {};
            
            if (matches) {
              params.forEach((param, index) => {
                routeParams[param] = matches[index + 1];
              });
            }

            return await this._handleApiRequest(apiName, req, routeParams);
          }
        });
        
      }
    }
  }

  private async _handleApiRequest(apiName: string, req: Request, params: Record<string, string>): Promise<Response> {
    try {
      // Importar el módulo dinámicamente
      const modulePath = join(this.apiPath, `${apiName}.js`);
      const module = await import(modulePath);
      
      // Obtener la clase exportada
      const ApiClass = module.default;
      if (!ApiClass) {
        throw new Error(`No default export found in ${apiName}.js`);
      }

      // Crear una instancia de la clase
      const apiInstance = new ApiClass();

      // Obtener el método correspondiente al método HTTP
      const method = req.method.toUpperCase();
      const handler = apiInstance[`handle${method}`];
      
      // Validar primero si existe el handler
      if (!handler || typeof handler !== 'function') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      const query = new URL(req.url).searchParams;
      // Preparar los datos para el handler
      const data = {
        params,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
        query: Object.fromEntries(query)
      };

      
      // Ejecutar el handler
      const result = await handler.call(apiInstance, data);
      
      let log = `[API] ${method} /api/${apiName}${query.toString() ? `?${query.toString()}` : ''} - ${result.status}`;
      if(result.status.toString().startsWith('2')) {
        logger.info(log);
      } else {
        logger.error(log);
      }
      return result;

    } catch (error) {
      console.error('Error handling API request:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  private _filePathToRoutePath(filePath: string): { routePath: string; pattern: RegExp; params: string[] } {
    // Convertir la ruta del archivo a una ruta URL
    let routePath = filePath
      .replace(/\\/g, '/') // Normalizar separadores
      .replace(/\.js$/, '') // Remover extensión .js
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

    // Quitar el prefijo /api del path
    const apiPath = path.replace(/^\/api/, '');

    // Buscar la ruta que coincida
    const route = this.routes.find(r => r.pattern.test(apiPath));
    
    if (!route) {
      return new Response(JSON.stringify({ error: 'Not Found' }), { 
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    try {
      return await route.handler(req);
    } catch (error) {
      console.error('Error handling API route:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
} 