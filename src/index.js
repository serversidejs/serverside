import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { layoutMiddleware } from './middleware/layout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Middleware
app.use(express.static(join(__dirname, 'public')));
// app.use(layoutMiddleware);

// Rutas
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Kettu SSR',
    content: 'Bienvenido a Kettu SSR Framework'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error',
    message: 'Algo salió mal'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🦊 Kettu SSR corriendo en http://localhost:${PORT}`);
}); 