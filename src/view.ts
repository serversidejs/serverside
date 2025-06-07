import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// import { renderFile } from './ejs.modern';
import Templatron from './templatron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ViewData {
  [key: string]: any;
}

export class View {
  private static viewsPath = join(__dirname, 'views');
  private static layoutPath = join(__dirname, 'views/layouts/main.html');
  private static layout: string;

  static {
    // Cargar el layout al iniciar
    try {
      this.layout = readFileSync(this.layoutPath, 'utf-8');
    } catch (error) {
      console.error('Error loading layout:', error);
      this.layout = '{{content}}'; // Layout fallback simple
    }
  }
  static async render(viewName: string, data: ViewData = {}): Response {
    try {
      // Leer la vista
      const viewContent = readFileSync(
        join(this.viewsPath, `${viewName}.html`),
        'utf-8'
      );
      const templatron = new Templatron();
      
      const renderedView = templatron.render(viewContent, data)
      const fullHtml = this.layout.replace('{@children}', renderedView);
      return new Response(fullHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error('Error rendering view:', error);
      return new Response('Error rendering view', { status: 500 });
    }
  }
}