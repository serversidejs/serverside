import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { renderFile } from './ejs.modern';

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
      // const viewContent = readFileSync(
      //   join(this.viewsPath, `${viewName}.html`),
      //   'utf-8'
      // );

      const renderedView = await renderFile(join(this.viewsPath, `${viewName}.ejs`), data);
      // Insertar la vista en el layout y procesarlo en el mismo orden
      // let fullHtml = this.layout.replace('{{content}}', renderedView);

      return new Response(renderedView, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error('Error rendering view:', error);
      return new Response('Error rendering view', { status: 500 });
    }
  }
  static render2(viewName: string, data: ViewData = {}): Response {
    try {
      // Leer la vista
      const viewContent = readFileSync(
        join(this.viewsPath, `${viewName}.html`),
        'utf-8'
      );

      // Procesamos en este orden:
      // 1. Bucles each (que internamente procesan sus condicionales y variables)
      let renderedView = this.processEachLoops(viewContent, data);
      // 2. Condicionales de nivel superior
      renderedView = this.processConditionals(renderedView, data);
      // 3. Variables y HTML sin escapar de nivel superior
      renderedView = this.processTemplate(renderedView, data);

      // Insertar la vista en el layout y procesarlo en el mismo orden
      let fullHtml = this.layout.replace('{{content}}', renderedView);
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
    // Primero procesamos las expresiones HTML sin escapar
    let result = template.replace(/\{@html\s+([^}]+)\}/g, (match, expression) => {
      try {
        const evalExpression = new Function(...Object.keys(data), `
          try {
            const result = ${expression.trim()};
            return result ?? '';
          } catch (e) {
            return '';
          }
        `);
        return evalExpression(...Object.values(data));
      } catch (error) {
        console.error('Error processing HTML expression:', expression, error);
        return '';
      }
    });

    // Luego procesamos las expresiones normales (escapando HTML)
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const evalExpression = new Function(...Object.keys(data), `
          try {
            const result = ${expression.trim()};
            return result ?? '';
          } catch (e) {
            return '';
          }
        `);
        
        // Escapamos el HTML para las expresiones normales
        return this.escapeHtml(evalExpression(...Object.values(data)));
      } catch (error) {
        console.error('Error processing template expression:', expression, error);
        return '';
      }
    });

    return result;
  }

  private static escapeHtml(unsafe: any): string {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    const eachRegex = /\{#each[\s]+([^}\s]+(?:\.[^}\s]+)*)[\s]+as[\s]+([^\s]+)(?:[\s]*,[\s]*([^\s]+))?[\s]*\}([\s\S]*?)\{\/each\}/g;
    
    // Encontramos todos los matches primero
    const matches: Array<{
      fullMatch: string;
      arrayPath: string;
      itemName: string;
      indexName: string | undefined;
      content: string;
      start: number;
    }> = [];

    let match;
    while ((match = eachRegex.exec(result)) !== null) {
      matches.push({
        fullMatch: match[0],
        arrayPath: match[1],
        itemName: match[2],
        indexName: match[3],
        content: match[4],
        start: match.index
      });
    }

    // Procesamos los matches de adentro hacia afuera (reverse order)
    for (let i = matches.length - 1; i >= 0; i--) {
      const { fullMatch, arrayPath, itemName, indexName, content, start } = matches[i];
      
      try {
        // Evaluamos el array
        let array;
        if (arrayPath.includes('.')) {
          const parts = arrayPath.split('.');
          const firstPart = parts[0];
          console.log('FIRST PART', firstPart, arrayPath)
          if (!(firstPart in data)) {
            console.error(`Cannot find '${firstPart}' in current context. Available keys:`, Object.keys(data));
            continue;
          }

          let current = data[firstPart];
          for (let i = 1; i < parts.length; i++) {
            if (current && typeof current === 'object') {
              current = current[parts[i]];
            } else {
              console.error(`Cannot access ${parts[i]} of ${arrayPath}, current value:`, current);
              continue;
            }
          }
          array = current;
        } else {
          array = data[arrayPath];
        }

        if (!Array.isArray(array)) {
          console.error(`'${arrayPath}' is not an array or is undefined. Context:`, {
            arrayPath,
            itemName,
            dataKeys: Object.keys(data)
          });
          continue;
        }

        // Procesamos el array
        const processed = array.map((item, index) => {
          const loopData = {
            ...data,
            [itemName]: item,
            ...(indexName ? { [indexName]: index } : {})
          };

          // Procesamos el contenido
          let processedContent = content;
          // Primero los condicionales
          processedContent = this.processConditionals(processedContent, loopData);
          // Luego las variables y HTML sin escapar
          processedContent = this.processTemplate(processedContent, loopData);
          
          return processedContent;
        }).join('');

        // Reemplazamos el match completo con el contenido procesado
        result = result.slice(0, start) + processed + result.slice(start + fullMatch.length);
      } catch (error) {
        console.error('Error processing each loop:', error, {
          arrayPath,
          itemName,
          indexName,
          dataKeys: Object.keys(data)
        });
      }
    }

    return result;
  }
} 