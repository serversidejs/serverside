import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Templatron } from './templatron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ViewData {
  [key: string]: any;
}

export class View {
  private static viewsPath = join(__dirname, 'routes');

  static async render(viewName: string, data: ViewData = {}): Promise<Response> {
    try {
      // Leer el archivo .comp
      const viewPath = join(this.viewsPath, `${viewName}.comp`);
      const viewContent = readFileSync(viewPath, 'utf-8');

      // Separar script y template
      const { script, template } = this._parseComponent(viewContent);
      
      // Evaluar el script en el servidor
      const scriptData = await this._evaluateScript(script, data);
      
      // Combinar los datos originales con los datos del script
      const finalData = { ...data, ...scriptData };

      // Renderizar el template con los datos combinados
      const templatron = new Templatron();
      const renderedView = await templatron.render(template, finalData);

      // Encontrar y renderizar layouts anidados
      const fullHtml = await this._renderLayouts(viewName, renderedView, finalData);

      return new Response(fullHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error('Error rendering view:', error);
      return new Response('Error rendering view', { status: 500 });
    }
  }

  private static async _renderLayouts(viewName: string, content: string, data: ViewData): Promise<string> {
    const templatron = new Templatron();
    let currentContent = content;
    let currentPath = viewName;

    // Buscar layouts de forma recursiva desde la ubicación de la vista hacia arriba
    while (true) {
      // Obtener el directorio actual
      const currentDir = dirname(currentPath);
      
      // Construir las rutas de los layouts
      const layoutPath = join(this.viewsPath, currentDir, '_layout.comp');
      const resetLayoutPath = join(this.viewsPath, currentDir, '_layout@.comp');
      
      // Primero verificar si existe un layout que no extiende
      if (existsSync(resetLayoutPath)) {
        // Leer y parsear el layout que no extiende
        const layoutContent = readFileSync(resetLayoutPath, 'utf-8');
        const { script, template } = this._parseComponent(layoutContent);

        // Evaluar el script del layout
        const layoutData = await this._evaluateScript(script, {
          ...data,
          children: currentContent
        });

        // Renderizar el layout con el contenido actual y terminar
        return await templatron.render(template, {
          ...data,
          ...layoutData,
          children: currentContent
        });
      }
      
      // Si no hay layout que no extiende, verificar el layout normal
      if (existsSync(layoutPath)) {
        // Leer y parsear el layout
        const layoutContent = readFileSync(layoutPath, 'utf-8');
        const { script, template } = this._parseComponent(layoutContent);

        // Evaluar el script del layout
        const layoutData = await this._evaluateScript(script, {
          ...data,
          children: currentContent
        });

        // Renderizar el layout con el contenido actual
        currentContent = await templatron.render(template, {
          ...data,
          ...layoutData,
          children: currentContent
        });
      }

      // Si estamos en la raíz, terminar
      if (currentDir === '.') {
        break;
      }

      // Mover al directorio padre
      currentPath = currentDir;
    }

    return currentContent;
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