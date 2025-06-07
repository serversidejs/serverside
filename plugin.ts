// plugin/compPlugin.ts
import { type BunPlugin } from "bun";
import path from "path";

function generateComponentCode(template: string, script: string, filePath: string) {
  const componentName = path.basename(filePath, '.comp');
  const tagName = `comp-${componentName.toLowerCase()}`;


  let processedTemplate = template;

  processedTemplate = processedTemplate.replace(/\s+:show=\{([^"]+)\}/g, ' data-show="$1"');

  // Convertimos el template procesado a la versión final con data-attributes
  processedTemplate = processedTemplate
    // Capturamos solo hasta encontrar la primera llave de cierre
    .replace(/\s+:if=\{([^}]+)\}/g, ' data-if="$1"')
    .replace(/\s+:else/g, ' data-else')
    .replace(/\s+:each=\{([^}]+)\s+in\s+([^}]+)\}/g, ' data-each="$1 in $2"');

  processedTemplate = processedTemplate.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const key = expression.trim();
    return `<span data-bind="${key}"></span>`;
  });

  
  return `
    import { BaseComponent } from './BaseComponent.js';

    class ${componentName} extends BaseComponent {
      static template = \`${processedTemplate}\`;

      loadScript() {
        // Todo el script del usuario va aquí.
        ${script}
      }
    }

    customElements.define('${tagName}', ${componentName});
  `;
}

// El resto del plugin es idéntico
export const compPlugin: BunPlugin = {
    name: "component-framework",
    async setup(build) {
        build.onLoad({ filter: /\.comp$/ }, async (args) => {
            const fileContent = await Bun.file(args.path).text();
            const templateMatch = fileContent.match(/<template>([\s\S]*?)<\/template>/);
            const scriptMatch = fileContent.match(/<script>([\s\S]*?)<\/script>/);

            if (!templateMatch || !scriptMatch) {
                throw new Error(`Fichero .comp mal formado: ${args.path}`);
            }

            const componentJsCode = generateComponentCode(
                templateMatch[1].trim(),
                scriptMatch[1].trim(),
                args.path
            );

            return {
                contents: componentJsCode,
                loader: "js",
            };
        });
    },
};