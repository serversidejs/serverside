// Simplemente importamos nuestros componentes para que el compilador los incluya en el bundle final.
// El código dentro de ellos (customElements.define) se ejecutará al cargar el script.
import './components/Contador.comp';
import { Router } from './router';
import { View } from './view';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { statSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = new Router();

// Servir archivos estáticos
async function serveStatic(path: string): Promise<Response | null> {
  try {
    const fullPath = join(__dirname, 'public', path);
    const stat = statSync(fullPath);

    if (stat.isFile()) {
      const content = readFileSync(fullPath);
      const mimeTypes: { [key: string]: string } = {
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
      };
      const ext = path.substring(path.lastIndexOf('.'));
      const contentType = mimeTypes[ext] || 'text/plain';

      return new Response(content, {
        headers: { 'Content-Type': contentType },
      });
    }
  } catch (error) {
    return null;
  }
  return null;
}

// Definir rutas
router.get('/', async (req) => {
  return View.render('index', {
    title: 'Kettu SSR',
    content: 'Bienvenido a Kettu SSR Framework',
    showWelcome: true,
    username: 'Carlos',
    notifications: [
      { id: 1, text: 'Primera notificación', read: false },
      { id: 2, text: 'Segunda notificación', read: true },
      { id: 3, text: 'Tercera notificación', read: false }
    ]
  });
});

// Iniciar servidor
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Intentar servir archivos estáticos primero
    const staticResponse = await serveStatic(url.pathname);
    if (staticResponse) return staticResponse;

    // Si no es un archivo estático, manejar como ruta
    return router.handle(req);
  },
});

console.log("Componentes cargados.");