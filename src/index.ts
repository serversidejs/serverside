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
  // const data = {
  //   title: 'Kettu SSR',
  //   content: 'Bienvenido a Kettu SSR Framework',
  //   showWelcome: true,
  //   username: 'Carlos',
  //   categories: [
  //     {
  //       name: 'Trabajo',
  //       notifications: [
  //         { 
  //           text: 'Nueva <strong>actualización</strong> disponible', 
  //           read: false,
  //           icon: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#4CAF50"/></svg>'
  //         },
  //         { 
  //           text: 'Recordatorio: <span class="highlight">Reunión</span> mañana', 
  //           read: false,
  //           icon: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#FFC107"/></svg>'
  //         }
  //       ]
  //     },
  //     {
  //       name: 'Personal',
  //       notifications: [
  //         { 
  //           text: 'Has recibido un <em>mensaje</em> nuevo', 
  //           read: true,
  //           icon: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2196F3"/></svg>'
  //         }
  //       ]
  //     },
  //     {
  //       name: 'Social',
  //       notifications: []
  //     }
  //   ],
  //   richContent: `
  //     <div class="card">
  //       <h3>Contenido Rico</h3>
  //       <p>Este es un ejemplo de <strong>contenido HTML</strong> que incluye:</p>
  //       <ul>
  //         <li>Formato <em>enriquecido</em></li>
  //         <li>Listas y <strong>estructura</strong></li>
  //         <li>Y más...</li>
  //       </ul>
  //     </div>
  //   `
  // };

  const data = {
    titulo: 'Página de Tareas',
    usuario: {
        nombre: 'Ana'
    },
    tareas: [
        'Configurar el proyecto',
        'Crear la plantilla EJS',
        'Escribir el script de renderizado',
        '¡Celebrar que funciona!'
    ],
    categories: [
      {
        name: 'Trabajo',
        notifications: [
          { 
            text: 'Nueva <strong>actualización</strong> disponible', 
            read: false,
            icon: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#4CAF50"/></svg>'
          },
        ]
      },
    ]
}

  

  return View.render('index', data);
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