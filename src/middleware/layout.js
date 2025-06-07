import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function layoutMiddleware(req, res, next) {
    // Guardamos la función render original
    const originalRender = res.render;

    // Sobreescribimos render para incluir el layout
    res.render = function(view, options, callback) {
        const layoutPath = join(__dirname, '../views/layouts/main.ejs');
        
        // Primero renderizamos la vista
        originalRender.call(this, view, options, async (err, html) => {
            if (err) return callback?.(err);

            try {
                // Leemos el layout
                const layoutTemplate = await readFile(layoutPath, 'utf8');
                
                // Reemplazamos <%- body %> con el contenido de la vista
                const finalHtml = layoutTemplate.replace('<%- body %>', html);
                
                // Renderizamos el layout con el contenido
                originalRender.call(this, 'string', { 
                    ...options, 
                    _: finalHtml,
                    layout: false 
                }, callback);
            } catch (error) {
                next(error);
            }
        });
    };

    next();
} 