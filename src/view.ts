import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// import { renderFile } from './ejs.modern';
import {Templatron} from './templatron';
import { ComponentFactory } from './components/components.js';

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
      // Asegurarse de que el layout incluya el script de componentes
    } catch (error) {
      console.error('Error loading layout:', error);
      this.layout = '{{content}}'; // Layout fallback simple
    }
  }

  static async render(viewName: string, data: ViewData = {}): Promise<Response> {
    try {
      // Leer el archivo .comp
      const viewContent = readFileSync(
        join(this.viewsPath, `${viewName}.comp`),
        'utf-8'
      );

      // Separar script y template
      const { script, template } = this._parseComponent(viewContent);
      
      // Evaluar el script en el servidor
      const scriptData = await this._evaluateScript(script, data);
      
      // Combinar los datos originales con los datos del script
      const finalData = { ...data, ...scriptData };

      // Renderizar el template con los datos combinados
      const templatron = new Templatron();
      const renderedView = await templatron.render(template, finalData);
      const fullHtml = this.layout.replace('{@children}', renderedView);

      return new Response(fullHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error('Error rendering view:', error);
      return new Response('Error rendering view', { status: 500 });
    }
  }

  private static _parseComponent(content: string): { script: string; template: string } {
    // Buscar la sección de script
    const scriptMatch = content.match(/<script side="server">([\s\S]*?)<\/script>/);
    const script = scriptMatch ? scriptMatch[1].trim() : '';

    // Remover la sección de script para obtener el template
    const template = content.replace(/<script side="server">[\s\S]*?<\/script>/, '').trim();

    return { script, template };
  }

  private static async _evaluateScript(scriptContent: string, data: ViewData): Promise<ViewData> {
    try {
      // Crear una función a partir del script
      const scriptFunction = new Function('data', `
        // Hacer que los datos sean accesibles en el script
        const { ${Object.keys(data).join(', ')} } = data;
        
        // El script debe retornar un objeto con los datos procesados
        ${scriptContent}
      `);

      // Ejecutar el script y obtener los datos procesados
      const processedData = await scriptFunction(data);
      return processedData || {};
    } catch (error) {
      console.error('Error evaluating view script:', error);
      return {};
    }
  }
}