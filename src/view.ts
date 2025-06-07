import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

  static render(viewName: string, data: ViewData = {}): Response {
    try {
      // Leer la vista
      const viewContent = readFileSync(
        join(this.viewsPath, `${viewName}.html`),
        'utf-8'
      );

      // Primero procesamos los bucles each
      let renderedView = this.processEachLoops(viewContent, data);
      
      // Luego procesamos los condicionales
      renderedView = this.processConditionals(renderedView, data);
      
      // Finalmente procesamos las variables
      renderedView = this.processTemplate(renderedView, data);

      // Insertar la vista en el layout
      let fullHtml = this.layout.replace('{{content}}', renderedView);

      // Procesar el layout en el mismo orden
      fullHtml = this.processEachLoops(fullHtml, data);
      fullHtml = this.processConditionals(fullHtml, data);
      fullHtml = this.processTemplate(fullHtml, data);

      return new Response(fullHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error('Error rendering view:', error);
      return new Response('Error rendering view', { status: 500 });
    }
  }

  private static processTemplate(template: string, data: ViewData): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        // Creamos una función que evaluará la expresión en el contexto de los datos
        const evalExpression = new Function(...Object.keys(data), `
          try {
            const result = ${expression.trim()};
            return result ?? '';
          } catch (e) {
            return '';
          }
        `);
        
        // Evaluamos la expresión con los datos como contexto
        return evalExpression(...Object.values(data));
      } catch (error) {
        console.error('Error processing template expression:', expression, error);
        return '';
      }
    });
  }

  private static processConditionals(template: string, data: ViewData): string {
    // Procesamos los bloques if/else
    let result = template;
    const ifRegex = /\{#if[\s]*([^}]+)\}([\s\S]*?)(?:\{:else\}([\s\S]*?))?\{\/if\}/g;
    
    result = result.replace(ifRegex, (match, condition, ifContent, elseContent = '') => {
      try {
        // Evaluamos la condición en el contexto de los datos
        const evalCondition = new Function(...Object.keys(data), `return !!(${condition});`);
        const isTrue = evalCondition(...Object.values(data));
        
        // Retornamos el contenido apropiado
        return isTrue ? ifContent : elseContent;
      } catch (error) {
        console.error('Error evaluating condition:', condition, error);
        return '';
      }
    });

    return result;
  }

  private static processEachLoops(template: string, data: ViewData): string {
    let result = template;
    const eachRegex = /\{#each[\s]+([^\s]+)[\s]+as[\s]+([^\s]+)(?:[\s]*,[\s]*([^\s]+))?[\s]*\}([\s\S]*?)\{\/each\}/g;
    
    result = result.replace(eachRegex, (match, arrayName, itemName, indexName, content) => {
      try {
        const array = data[arrayName];
        if (!Array.isArray(array)) {
          console.error(`'${arrayName}' is not an array`);
          return '';
        }

        // Procesamos cada elemento del array
        return array.map((item, index) => {
          // Creamos un nuevo contexto que incluye la variable del bucle y el índice si se especificó
          const loopData = { 
            ...data, 
            [itemName]: item,
            ...(indexName ? { [indexName]: index } : {})
          };
          // Procesamos el contenido con el nuevo contexto
          return this.processTemplate(content, loopData);
        }).join('');
      } catch (error) {
        console.error('Error processing each loop:', error);
        return '';
      }
    });

    return result;
  }
} 