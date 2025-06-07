// src/BaseComponent.js

export class BaseComponent extends HTMLElement {
  $state;
  #initialized = false;
  #mounted = false;
  // Mapa para rastrear qué propiedades del estado afectan a qué elementos del DOM.
  // Ejemplo: { contador: { bindings: Set(el1, el2), conditionals: Set(el3) } }
  #dependencies = {};

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
        // Si el valor cambia y el componente está listo, iniciamos un renderizado selectivo.
        if (oldValue !== value && this.#initialized) {
          console.log(`$state['${String(prop)}'] cambió. Renderizando selectivamente.`);
          this._selectiveRender(prop);
        }
        return true;
      }
    });
  }

  connectedCallback() {
    if (this.loadScript) {
      this.loadScript();
    }

    // En la primera carga, construimos el mapa de dependencias y hacemos un renderizado completo.
    this._buildDependenciesAndFullRender();
    this.#initialized = true;

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

  // --- MÉTODOS DE AYUDA Y EVALUACIÓN (sin cambios) ---

  _resolveValue(path, scope) {
    return path.split('.').reduce((acc, part) => acc && acc[part], scope);
  }

  _evaluateCondition(expression, scope = this.$state) {
    try {
      const keys = Object.keys(scope);
      const values = Object.values(scope);
      const func = new Function(...keys, `return !!(${expression});`);
      return func(...values);
    } catch (error) {
      console.error(`Error evaluando la expresión: "${expression}" en el scope`, scope, error);
      return false;
    }
  }

  // --- LÓGICA DE CONSTRUCCIÓN DE DEPENDENCIAS ---

  /**
   * Registra un elemento del DOM como dependiente de una propiedad del estado.
   * @param {string} prop - La propiedad del estado (ej. 'contador').
   * @param {string} type - El tipo de dependencia ('bindings', 'conditionals', 'loops', 'shows').
   * @param {HTMLElement} element - El elemento del DOM que depende de la propiedad.
   */
  _registerDependency(prop, type, element) {
    if (!this.#dependencies[prop]) {
      this.#dependencies[prop] = {
        bindings: new Set(),
        conditionals: new Set(),
        loops: new Set(),
        shows: new Set(),
      };
    }
    this.#dependencies[prop][type].add(element);
  }
  
  /**
   * Analiza una expresión para encontrar las propiedades del estado de las que depende.
   * @param {string} expression - La expresión a analizar (ej. 'contador > 5').
   * @returns {string[]} Un array de propiedades (ej. ['contador']).
   */
  _getDependenciesFromExpression(expression) {
    const identifierRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
    let matches = expression.match(identifierRegex) || [];
    const stateKeys = Object.keys(this.$state);
    return matches.filter(match => stateKeys.includes(match));
  }
  
  /**
   * Recorre el DOM una vez para construir el mapa de dependencias y luego realiza el primer renderizado completo.
   */
  _buildDependenciesAndFullRender() {
    const stateKeys = Object.keys(this.$state);
    if (stateKeys.length === 0) {
        // Si el estado está vacío, esperamos a que se inicialice
        Promise.resolve().then(() => this._buildDependenciesAndFullRender());
        return;
    }

    // 1. Dependencias de bindings: {{ variable }}
    this.shadowRoot.querySelectorAll('[data-bind]').forEach(el => {
      const prop = el.dataset.bind.split('.')[0];
      if(stateKeys.includes(prop)) this._registerDependency(prop, 'bindings', el);
    });

    // 2. Dependencias de condicionales: :if y :show
    this.shadowRoot.querySelectorAll('[data-if], [data-show]').forEach(el => {
      const expression = el.dataset.if || el.dataset.show;
      const type = el.hasAttribute('data-if') ? 'conditionals' : 'shows';
      this._getDependenciesFromExpression(expression)
          .forEach(prop => this._registerDependency(prop, type, el));
    });

    // 3. Dependencias de bucles: :each
    this.shadowRoot.querySelectorAll('[data-each]').forEach(el => {
      const arrayName = el.dataset.each.split(' ')[2];
      if(stateKeys.includes(arrayName)) this._registerDependency(arrayName, 'loops', el);
    });

    console.log('Mapa de dependencias construido:', this.#dependencies);
    // Realiza el renderizado completo inicial
    this._fullRender();
  }
  

  // --- LÓGICA DE RENDERIZADO (SELECTIVO Y COMPLETO) ---

  /**
   * Ejecutado en cada cambio de estado. Actualiza solo los elementos necesarios.
   * @param {string} changedProp - La propiedad del estado que acaba de cambiar.
   */
  _selectiveRender(changedProp) {
    const deps = this.#dependencies[changedProp];
    if (!deps) return; // Nadie depende de esta propiedad.

    // Actualiza bindings {{ }}
    deps.bindings.forEach(el => {
      const value = this._resolveValue(el.dataset.bind, this.$state);
      el.textContent = value ?? '';
    });

    // Actualiza condicionales :if/:else
    deps.conditionals.forEach(el => this._updateConditional(el));

    // Actualiza visibilidad :show
    deps.shows.forEach(el => this._updateShow(el));

    // Actualiza bucles :each (la función ya es eficiente)
    deps.loops.forEach(el => this._updateLoop(el));
  }

  /**
   * Realiza un renderizado completo de todo el componente. Solo se usa en la carga inicial.
   */
  _fullRender() {
    this.shadowRoot.querySelectorAll('[data-bind]').forEach(el => {
      const value = this._resolveValue(el.dataset.bind, this.$state);
      el.textContent = value ?? '';
    });
    this.shadowRoot.querySelectorAll('[data-if]').forEach(el => this._updateConditional(el));
    this.shadowRoot.querySelectorAll('[data-show]').forEach(el => this._updateShow(el));
    this.shadowRoot.querySelectorAll('[data-each]').forEach(el => this._updateLoop(el));
  }

  // --- MÉTODOS DE ACTUALIZACIÓN DE DOM ESPECÍFICOS ---

  _updateConditional(el) {
    const shouldShow = this._evaluateCondition(el.dataset.if);
    el.style.display = shouldShow ? '' : 'none';
    const nextEl = el.nextElementSibling;
    if (nextEl && nextEl.hasAttribute('data-else')) {
      nextEl.style.display = shouldShow ? 'none' : '';
    }
  }

  _updateShow(el) {
    const shouldShow = this._evaluateCondition(el.dataset.show);
    el.style.display = shouldShow ? '' : 'none';
  }

  _updateNodeContent(node, scope) {
    // Actualiza los bindings y condicionales dentro de un nodo específico (usado por los bucles)
    node.querySelectorAll('[data-bind]').forEach(el => {
        const key = el.dataset.bind;
        const value = this._resolveValue(key, scope);
        el.textContent = value ?? '';
    });
    node.querySelectorAll('[data-if]').forEach(el => {
        const shouldShow = this._evaluateCondition(el.dataset.if, scope);
        el.style.display = shouldShow ? '' : 'none';
        const nextEl = el.nextElementSibling;
        if (nextEl && nextEl.hasAttribute('data-else')) {
          nextEl.style.display = shouldShow ? 'none' : '';
        }
    });
  }

  _updateLoop(templateEl) {
    templateEl.style.display = 'none';
    const expression = templateEl.dataset.each;
    const [itemAlias, , arrayName] = expression.split(' ');

    let container = templateEl.nextElementSibling;
    if (!container || container.dataset.loopContainerFor !== arrayName) {
      container = document.createElement('div');
      container.dataset.loopContainerFor = arrayName;
      templateEl.after(container);
    }

    const items = this._resolveValue(arrayName, this.$state) || [];
    items.forEach((item, index) => {
      const loopScope = { ...this.$state, [itemAlias]: item };
      let childNode = container.children[index];

      if (childNode) {
        this._updateNodeContent(childNode, loopScope);
      } else {
        childNode = templateEl.cloneNode(true);
        childNode.style.display = '';
        childNode.removeAttribute('data-each');
        container.appendChild(childNode);
        this._updateNodeContent(childNode, loopScope);
      }
    });

    while (container.children.length > items.length) {
      container.removeChild(container.lastChild);
    }
  }
}
