import { compPlugin } from "./plugin.ts";
import chokidar from "chokidar";

// Función para realizar el build
async function buildProject() {
  console.log("🔨 Compilando el proyecto...");
  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    plugins: [compPlugin],
    minify: false, // Desactivamos minify en desarrollo para mejor debugging
  });

  if (result.success) {
    console.log("✅ Build completado con éxito");
  } else {
    console.error("❌ Error en el build:", result.logs);
  }
  return result.success;
}

// Realizar build inicial
await buildProject();

// Configurar el watcher para los archivos
const watcher = chokidar.watch('.', {
  ignored: (path, stats) => {
    const extensions = ['.comp', '.ts', '.js', '.html', '.css'];
    return stats?.isFile() && !extensions.some(ext => path.endsWith(ext));
  },
  persistent: true,
  ignoreInitial: true
});

watcher.on('ready', () => {
  console.log('👀 Observando cambios en archivos .comp, .ts, .js, .html y .css');
});

watcher.on('change', async (path: string) => {
  console.log(`📝 Cambio detectado en: ${path}`);
  await buildProject();
});

// Servidor para el HTML
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Servir el HTML principal
    if (url.pathname === '/') {
      return new Response(Bun.file('./index.html'));
    }
    
    // Servir archivos estáticos desde /dist
    if (url.pathname.startsWith('/dist/')) {
      return new Response(Bun.file('.' + url.pathname));
    }

    // 404 para otras rutas
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Servidor iniciado en http://localhost:${server.port}`); 