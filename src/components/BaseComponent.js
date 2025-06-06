// src/BaseComponent.js

export class BaseComponent extends HTMLElement {
  $state; // La declaramos para que TypeScript y los editores la conozcan
  #initialized = false;

  #textBindings = []; // Caché para nuestros nodos de texto reactivos
  #ifBindings = [];
  constructor() {
    super();
    // Ya no necesitamos `initialState`, el estado se definirá en el script.
    const { template } = this.constructor;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = template;

    // 1. Creamos el proxy reactivo y lo asignamos a this.$state
    this.$state = new Proxy({}, {
      set: (target, prop, value) => {
        const oldValue = target[prop];
        target[prop] = value;
        if (oldValue !== value && this.#initialized) {
          console.log(`$state['${String(prop)}'] cambió a ${value}. Re-renderizando.`);
          this.render();
        }
        return true;
      }
    });
  }

  connectedCallback() {
     // 1. Buscamos y cacheamos los nodos de texto UNA SOLA VEZ.
     this.#setupAndCacheBindings();

     this.#setupIfBindings();

    // loadS es ahora el lugar donde el usuario define su estado inicial
    if (this.loadScript) {
      this.loadScript();
    }
    this.render(); // Renderizado inicial
    this.#initialized = true;
  }

  #setupAndCacheBindings() {
    // 1. Encontrar todos nuestros marcadores <span> de forma muy sencilla.
    const spans = this.shadowRoot.querySelectorAll('[data-bind]');

    spans.forEach(span => {
      const key = span.dataset.bind;

      // 2. Crear un nodo de texto vacío que reemplazará al span.
      const textNode = document.createTextNode('');

      // 3. Guardar la referencia al nodo de texto en nuestra caché para futuros renders.
      this.#textBindings.push({ key, node: textNode });

      // 4. ¡La sustitución! Reemplazamos el <span> por el nodo de texto en el DOM.
      span.parentNode.replaceChild(textNode, span);
    });
  }

  #setupIfBindings() {
    this.shadowRoot.querySelectorAll('[data-if]').forEach(ifEl => {
        const condition = ifEl.dataset.if;
        const anchor = document.createComment(`if-else anchor for: ${condition}`);
        
        // Guardamos la plantilla del if
        ifEl.removeAttribute('data-if');
        const ifTemplate = ifEl.cloneNode(true);
        let elseTemplate = null;

        const elseEl = ifEl.nextElementSibling;
        if (elseEl && elseEl.hasAttribute('data-else')) {
            // ¡NUEVO! Si existe un v-else, guardamos también su plantilla...
            elseEl.removeAttribute('data-else');
            elseTemplate = elseEl.cloneNode(true);
            // ...y lo eliminamos del DOM para que no quede huérfano.
            elseEl.remove();
        }

        // Reemplazamos el elemento if original por el ancla.
        ifEl.parentNode.replaceChild(anchor, ifEl);
        
        this.#ifBindings.push({
            condition,
            anchor,
            ifTemplate,
            elseTemplate, // Puede ser null
            mountedBlock: null, // Puede ser 'if', 'else' o null
            mountedElement: null
        });
    });
  }

  render() {
    // 2. El renderizado de texto ahora es un bucle súper rápido sobre la caché.
    // ¡No más querySelector en cada render!
    for (const binding of this.#textBindings) {
      const value = new Function('$state', `return $state.${binding.key}`)(this.$state);
      binding.node.textContent = value ?? '';
    }
    this.shadowRoot.querySelectorAll('[data-show]').forEach(el => {
      const condition = new Function('$state', `return !!($state.${el.dataset.show})`)(this.$state);
      
      // Aplicamos el estilo al elemento v-show
      el.style.display = condition ? '' : 'none';
      // ¡NUEVO! Buscamos un v-else adyacente
      const elseEl = el.nextElementSibling;
      if (elseEl && elseEl.hasAttribute('data-else')) {
          // Le aplicamos el estilo opuesto
          elseEl.style.display = condition ? 'none' : '';
      }
    });

  for (const binding of this.#ifBindings) {
    const shouldShowIf = new Function('$state', `return !!($state.${binding.condition})`)(this.$state);

    if (shouldShowIf) {
        // La condición del IF es verdadera
        if (binding.mountedBlock !== 'if') {
            // Si hay algo montado (el bloque else), lo quitamos
            binding.mountedElement?.remove();

            // Montamos el bloque IF
            const clone = binding.ifTemplate.cloneNode(true);
            binding.anchor.parentNode.insertBefore(clone, binding.anchor.nextSibling);
            binding.mountedBlock = 'if';
            binding.mountedElement = clone;
        }
    } else {
        // La condición del IF es falsa
        if (binding.elseTemplate) {
            // Y tenemos un bloque ELSE para mostrar
            if (binding.mountedBlock !== 'else') {
                binding.mountedElement?.remove();
                const clone = binding.elseTemplate.cloneNode(true);
                binding.anchor.parentNode.insertBefore(clone, binding.anchor.nextSibling);
                binding.mountedBlock = 'else';
                binding.mountedElement = clone;
            }
        } else {
            // No hay bloque ELSE, así que no mostramos nada
            if (binding.mountedBlock) {
                binding.mountedElement.remove();
                binding.mountedBlock = null;
                binding.mountedElement = null;
            }
        }
    }
  }
  }
}