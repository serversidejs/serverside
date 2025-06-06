import {
  plugin,
  type BunPlugin
} from "bun";
import path from "path";

// Función para generar el código final del Web Component
function generateComponentCode(template: string, script: string, filePath: string) {
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

  // 4. Procesar el template para encontrar los bindings {{...}} y v-if/v-else
  let processedTemplate = template;
  const bindings: Array<{varName: string, id: string}> = [];
  const conditionals: Array<{id: string, condition: string, content: string, elseContent?: string}> = [];

  // Procesar v-if y v-else
  const ifRegex = /<([^>]+)\s+v-if="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>(?:\s*<\1\s+v-else[^>]*>([\s\S]*?)<\/\1>)?/g;
  let ifCounter = 0;

  processedTemplate = processedTemplate.replace(ifRegex, (_, tag, condition, attrs, content, elseContent) => {
    const id = `if-${ifCounter++}-${Math.random().toString(36).substring(2, 9)}`;
    conditionals.push({ 
      id, 
      condition, 
      content: `<${tag}${attrs}>${content}</${tag}>`,
      elseContent: elseContent ? `<${tag}${attrs}>${elseContent}</${tag}>` : undefined
    });
    return `<div id="${id}"></div>`;
  });

  // Procesar bindings normales
  const bindingRegex = /\{\{\s*(\w+)\s*\}\}/g;
  while ((match = bindingRegex.exec(processedTemplate)) !== null) {
      const varName = match[1];
      const bindingId = `binding-${varName}-${Math.random().toString(36).substring(2, 9)}`;
      processedTemplate = processedTemplate.replace(match[0], `<span id="${bindingId}"></span>`);
      bindings.push({
          varName,
          id: bindingId
      });
  }

  // 5. Generar el código JavaScript final que define el Web Component
  return `
  class ${componentName} extends HTMLElement {
    #state;
    #initialized = false;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = \`${processedTemplate}\`;

      // Crear estado reactivo
      const rawState = { ${initialState} };
      this.#state = new Proxy(rawState, {
        get: (target, prop) => target[prop],
        set: (target, prop, value) => {
          console.log('set');
          const oldValue = target[prop];
          target[prop] = value;
          if (oldValue !== value && this.#initialized) {
            console.log('render');
            this.render();
          }
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
      this.#initialized = true;
    }

    render() {
      // Renderizar bindings normales
      ${bindings.map(b => 
        `const binding_${b.id} = this.shadowRoot.getElementById('${b.id}');
         if (binding_${b.id}) {
           binding_${b.id}.textContent = this.#state.${b.varName};
         }`
      ).join('\n')}

      // Renderizar condicionales
      ${conditionals.map(c => `
        const el_${c.id} = this.shadowRoot.getElementById('${c.id}');
        if (!el_${c.id}) return;

        const shouldShow = Boolean(${c.condition.replace(/this\./g, 'this.#state.')});
        
        if (shouldShow) {
          el_${c.id}.innerHTML = \`${c.content}\`;
        } ${c.elseContent ? `else {
          el_${c.id}.innerHTML = \`${c.elseContent}\`;
        }` : `else {
          el_${c.id}.innerHTML = '';
        }`}

        // Re-evaluar bindings dentro del condicional
        const innerBindings = el_${c.id}.querySelectorAll('span[id^="binding-"]');
        innerBindings.forEach(span => {
          const [_, varName] = span.id.split('binding-');
          if (varName in this.#state) {
            span.textContent = this.#state[varName];
          }
        });
      `).join('\n')}
    }
  }

  customElements.define('${tagName}', ${componentName});
`;
}

// Definimos el plugin para Bun
export const compPlugin: BunPlugin = {
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