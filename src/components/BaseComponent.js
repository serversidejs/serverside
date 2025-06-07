// src/BaseComponent.js

export class BaseComponent extends HTMLElement {
  $state;
  #initialized = false;
  #mounted = false;

  constructor() {
    super();
    const {
      template
    } = this.constructor;

    this.attachShadow({
      mode: 'open'
    });
    this.shadowRoot.innerHTML = template;

    this.$state = new Proxy({}, {
      set: (target, prop, value) => {
        const oldValue = target[prop];
        target[prop] = value;
        if (oldValue !== value && this.#initialized) {
          console.log(`$state['${String(prop)}'] cambió. Re-renderizando.`);
          this.render();
        }
        return true;
      }
    });
  }

  connectedCallback() {
    if (this.loadScript) {
      this.loadScript();
    }

    this.#initialized = true;
    this.render(); // Renderizado inicial

    requestAnimationFrame(() => {
      if (this.onMount && !this.#mounted) {
        this.onMount();
        this.#mounted = true;
      }
    });
  }

  disconnectedCallback() {
    this.#mounted = false;
    if (this.onDestroy) {
      this.onDestroy();
    }
  }

  _resolveValue(path, scope) {
    return path.split('.').reduce((acc, part) => acc && acc[part], scope);
  }

  /**
   * Evalúa una expresión en un contexto de datos específico (scope).
   * @param {string} expression - La expresión a evaluar (ej. 'contador > 5').
   * @param {object} scope - El objeto de datos a usar (por defecto, this.$state).
   * @returns {boolean} El resultado de la evaluación.
   */
  _evaluateCondition(expression, scope = this.$state) {
    try {
      const keys = Object.keys(scope);
      const values = Object.values(scope);
      const func = new Function(...keys, `return \`\${${expression}}\` !== 'undefined' && Boolean(${expression});`);
      return func(...values);
    } catch (error) {
      console.error(`Error evaluando la expresión: "${expression}" en el scope`, scope, error);
      return false;
    }
  }

  /**
   * Actualiza los bindings de texto dentro de un nodo raíz específico.
   * @param {HTMLElement} root - El nodo desde donde buscar (ej. this.shadowRoot).
   * @param {object} scope - El ámbito de datos a utilizar.
   */
  _updateBindings(root, scope) {
    const bindableElements = root.querySelectorAll('[data-bind]');
    bindableElements.forEach(el => {
      const key = el.dataset.bind;
      const value = this._resolveValue(key, scope);
      el.textContent = value ?? '';
    });
  }

  /**
   * Gestiona la visibilidad de los elementos con :if/:else dentro de un nodo raíz.
   * @param {HTMLElement} root - El nodo desde donde buscar.
   * @param {object} scope - El ámbito de datos a utilizar.
   */
  _updateConditionals(root, scope) {
    root.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.dataset.if;
      const shouldShow = this._evaluateCondition(condition, scope);
      el.style.display = shouldShow ? '' : 'none';

      const nextEl = el.nextElementSibling;
      if (nextEl && nextEl.hasAttribute('data-else')) {
        nextEl.style.display = shouldShow ? 'none' : '';
      }
    });
  }

  /**
   * Aplica todas las actualizaciones (bindings, condicionales) a un nodo específico y su scope.
   * Esencial para renderizar los items de un bucle de forma individual.
   * @param {HTMLElement} node - El nodo a actualizar.
   * @param {object} scope - El ámbito de datos (ej. el item del bucle).
   */
  _updateNodeContent(node, scope) {
    this._updateBindings(node, scope);
    this._updateConditionals(node, scope);
  }

  /**
   * Gestiona los bucles :each de forma eficiente, sin destruir y recrear todo el DOM.
   * Compara los datos con los nodos existentes y añade, actualiza o elimina según sea necesario.
   */
  _updateLoops() {
    this.shadowRoot.querySelectorAll('[data-each]').forEach(templateEl => {
      templateEl.style.display = 'none';

      const expression = templateEl.dataset.each;
      const [itemAlias, , arrayName] = expression.split(' ');

      // Busca un contenedor para los items, o lo crea si no existe.
      // Se identifica por un data-attribute para no confundirlo con otros elementos.
      let container = templateEl.nextElementSibling;
      if (!container || container.dataset.loopContainerFor !== arrayName) {
        container = document.createElement('div');
        container.dataset.loopContainerFor = arrayName;
        templateEl.after(container);
      }

      const items = this._resolveValue(arrayName, this.$state) || [];

      // Sincroniza los nodos del DOM con los datos del array
      items.forEach((item, index) => {
        const loopScope = { ...this.$state,
          [itemAlias]: item
        };
        const childNode = container.children[index];

        if (childNode) {
          // Si el nodo ya existe, simplemente lo actualizamos con los nuevos datos.
          this._updateNodeContent(childNode, loopScope);
        } else {
          // Si el nodo no existe, lo creamos a partir de la plantilla y lo actualizamos.
          const clone = templateEl.cloneNode(true);
          clone.style.display = '';
          clone.removeAttribute('data-each');
          container.appendChild(clone);
          this._updateNodeContent(clone, loopScope);
        }
      });

      // Elimina los nodos sobrantes si el array de datos es más pequeño que los nodos en el DOM.
      while (container.children.length > items.length) {
        container.removeChild(container.lastChild);
      }
    });
  }

  /**
   * Método principal de renderizado. Orquesta las actualizaciones del DOM.
   * El orden es importante: primero se aplican los cambios globales y luego
   * los bucles, que sobreescriben sus contenidos con su scope específico.
   */
  render() {
    if (!this.#initialized) return;

    // Ejecutamos las actualizaciones en un orden lógico
    this._updateBindings(this.shadowRoot, this.$state);
    this._updateConditionals(this.shadowRoot, this.$state);
    this._updateLoops();
  }
}
