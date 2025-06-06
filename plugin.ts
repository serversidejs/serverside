import {
  plugin,
  type BunPlugin
} from "bun";
import path from "path";

// Función para generar el código final del Web Component
function generateComponentCode(template, script, filePath) {
  // 1. Derivar el nombre del tag a partir del nombre del fichero (Contador.comp -> mi-contador)
  const componentName = path.basename(filePath, '.comp');
  const tagName = `mi-${componentName.toLowerCase()}`;

  // 2. Parsear el script para encontrar las variables de estado exportadas
  const stateVars = [];
  const exportRegex = /export\s+let\s+(\w+)\s*=\s*([^;]+);/g;
  let match;
  while ((match = exportRegex.exec(script)) !== null) {
      stateVars.push({
          name: match[1],
          defaultValue: match[2].trim()
      });
  }

  // 3. Crear el objeto de estado inicial para el componente
  const initialState = stateVars.map(v => `${v.name}: ${v.defaultValue}`).join(',\n');

  // 4. Procesar el template para encontrar los bindings {{...}}
  let processedTemplate = template;
  const bindings = [];
  const bindingRegex = /\{\{\s*(\w+)\s*\}\}/g;
  while ((match = bindingRegex.exec(template)) !== null) {
      const varName = match[1];
      // Reemplazamos el binding con un <span> que podamos seleccionar fácilmente
      const bindingId = `binding-${varName}-${Math.random().toString(36).substring(2, 9)}`;
      processedTemplate = processedTemplate.replace(match[0], `<span id="${bindingId}"></span>`);
      bindings.push({
          varName,
          id: bindingId
      });
  }

  // 5. Generar el código JavaScript final que define el Web Component
  // Esta es la "magia": creamos la clase, el Shadow DOM, la reactividad y el renderizado.
  return `
  class ${componentName} extends HTMLElement {
    #state;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = \`${processedTemplate}\`;

      const initialState = { ${initialState} };

      // Sistema de reactividad simple con un Proxy
      this.#state = new Proxy(initialState, {
        set: (target, property, value) => {
          target[property] = value;
          this.render();
          return true;
        }
      });

      // Simular eventos para probar (lo mejoraremos en el futuro)
      setInterval(() => {
        this.#state.contador++;
      }, 1000);
    }

    connectedCallback() {
      this.render();
    }

    render() {
      ${bindings.map(b => 
        `this.shadowRoot.getElementById('${b.id}').textContent = this.#state.${b.varName};`
      ).join('\n')}
    }
  }

  customElements.define('${tagName}', ${componentName});
`;
}

// Definimos el plugin para Bun
export const compPlugin: BunPlugin ={
  name: "component-framework",
  async setup(build) {
      // Cuando Bun encuentre un fichero que termine en .comp...
      build.onLoad({
          filter: /\.comp$/
      }, async (args) => {
          // 1. Lee el contenido del fichero
          const fileContent = await Bun.file(args.path).text();

          // 2. Extrae el template y el script
          const templateMatch = fileContent.match(/<template>([\s\S]*?)<\/template>/);
          const scriptMatch = fileContent.match(/<script>([\s\S]*?)<\/script>/);

          if (!templateMatch || !scriptMatch) {
              throw new Error(`Fichero .comp mal formado: ${args.path}`);
          }

          // 3. Genera el código del Web Component
          const componentJsCode = generateComponentCode(
              templateMatch[1],
              scriptMatch[1],
              args.path
          );

          // 4. Devuelve el código generado como si fuera un fichero JavaScript
          return {
              contents: componentJsCode,
              loader: "js",
          };
      });
  },
};