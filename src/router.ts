type RouteHandler = (req: Request) => Promise<Response> | Response;

interface Route {
  path: string;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: RouteHandler) {
    this.routes.push({ path, handler });
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Buscar la ruta que coincida
    const route = this.routes.find(r => r.path === path);
    
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