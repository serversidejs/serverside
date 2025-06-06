// src/BaseComponent.js

export class BaseComponent extends HTMLElement {
  $state; // La declaramos para que TypeScript y los editores la conozcan
  #initialized = false;
  #mounted = false;

  #textBindings = []; // Caché para nuestros nodos de texto reactivos
  #ifBindings = [];
  #eachBindings = []; // Nueva caché para los bucles

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
    
    this.#setupIfBindings();
    this.#setupEachBindings();
    this.#setupAndCacheBindings();

    // loadScript es ahora el lugar donde el usuario define su estado inicial
    if (this.loadScript) {
      this.loadScript();
    }
    
    this.render(); // Renderizado inicial
    this.#initialized = true;

    // Esperamos a que todo el DOM esté listo antes de llamar a onMount
    requestAnimationFrame(() => {
      if (this.onMount && !this.#mounted) {
        this.onMount();
        this.#mounted = true;
      }
    });
  }

  disconnectedCallback() {
    // Limpieza cuando el componente se desmonta
    this.#mounted = false;
    if (this.onDestroy) {
      this.onDestroy();
    }
  }

  // Función auxiliar para obtener el valor de una propiedad anidada
  #getNestedValue(obj, path) {
    // Si el path está vacío o no es válido, retornamos vacío
    if (!path) return '';

    // Manejamos el caso especial de array[index].property
    const arrayMatch = path.match(/^(.+?)\[(\d+)\]\.(.+)$/);
    if (arrayMatch) {
      const [_, arrayPath, index, property] = arrayMatch;
      const array = this.#getNestedValue(obj, arrayPath);
      if (Array.isArray(array) && array[index]) {
        return array[index][property];
      }
      return '';
    }

    // Manejamos el caso de array[index]
    const simpleArrayMatch = path.match(/^(.+?)\[(\d+)\]$/);
    if (simpleArrayMatch) {
      const [_, arrayPath, index] = simpleArrayMatch;
      const array = this.#getNestedValue(obj, arrayPath);
      if (Array.isArray(array)) {
        return array[index];
      }
      return '';
    }

    // Para propiedades simples separadas por puntos
    return path.split('.').reduce((current, part) => {
      if (current === null || current === undefined) return '';
      return current[part];
    }, obj);
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

  #setupEachBindings() {
    this.shadowRoot.querySelectorAll('[data-each]').forEach(eachEl => {
      const [itemName, arrayPath] = eachEl.dataset.each.split(' in ').map(s => s.trim());
      const anchor = document.createComment(`each anchor for: ${arrayPath}`);
      
      // Guardamos la plantilla original
      eachEl.removeAttribute('data-each');
      const template = eachEl.cloneNode(true);

      // Reemplazamos el elemento original con el ancla
      eachEl.parentNode.replaceChild(anchor, eachEl);

      this.#eachBindings.push({
        itemName,
        arrayPath,
        template,
        anchor,
        elements: [] // Aquí guardaremos los elementos renderizados
      });
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
    // Renderizar bindings normales


    // Renderizar show/else
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

    // Renderizar if/else
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

    // Renderizar each
    for (const binding of this.#eachBindings) {
      const array = this.#getNestedValue(this.$state, binding.arrayPath) || [];
      console.log('array', array)
      console.log('binding.itemName', binding.itemName)
      console.log('this.#textBindings', this.#textBindings)
      console.log('binding.arrayPath', binding.arrayPath)
      // Limpiar elementos anteriores si la longitud no coincide
      if (binding.elements.length !== array.length) {
        binding.elements.forEach(el => el.remove());
        binding.elements = [];
        
        // Crear nuevos elementos
        array.forEach((item, index) => {
          const clone = binding.template.cloneNode(true);
          
          // Reemplazar las referencias al item en el contenido
          const itemRegex = new RegExp(`{{\\s*${binding.itemName}\\s*}}|{{\\s*${binding.itemName}\\.([\\w\\.]+)\\s*}}`, 'g');
          console.log('clone', clone.innerHTML);
          clone.innerHTML = clone.innerHTML.replace(itemRegex, (match, prop) => {
            // Si es solo el item (sin propiedad), retornamos el item completo
            if (match.includes(binding.itemName) && !prop) {
              return `<span data-bind="${binding.arrayPath}[${index}]"></span>`;
            }
            // Si es una propiedad del item
            return `<span data-bind="${binding.arrayPath}[${index}].${prop}"></span>`;
          });

          binding.anchor.parentNode.insertBefore(clone, binding.anchor.nextSibling);
          binding.elements.push(clone);
        });

        // Actualizar los bindings después de crear nuevos elementos
        this.#setupAndCacheBindings();
      }
    }

    for (const binding of this.#textBindings) {
      const value = this.#getNestedValue(this.$state, binding.key);
      binding.node.textContent = value ?? '';
    }
  }
}