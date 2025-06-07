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
          // console.log(`$state['${String(prop)}'] cambió. Renderizando selectivamente.`);
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
    console.log('expression', expression)
    try {
      // Primero reemplazamos las referencias a propiedades del item
      // por accesos seguros al scope
      const processedExpression = expression
        .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)(\.[\w\.]+)?/g, (match, name, props = '') => {
          // Si la variable existe en el scope, la accedemos a través de él
          if (scope.hasOwnProperty(name)) {
            return `scope['${name}']${props}`;
          }
          // Si no, la dejamos como está (podría ser una variable global o una función)
          return match;
        });

      // Usamos Function para evaluar la expresión con el scope proporcionado
      return new Function('scope', `
        try {
          with(scope) {
            return !!(${processedExpression});
          }
        } catch(e) {
          console.error('Error en evaluación:', e);
          return false;
        }
      `)(scope);
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
    // Filtramos 'in' que puede aparecer en expresiones :each
    return matches.filter(match => stateKeys.includes(match) && match !== 'in');
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

    // 1. Dependencias de bindings simples
    this.shadowRoot.querySelectorAll('[data-bind]').forEach(el => {
      const prop = el.dataset.bind.split('.')[0];
      if (stateKeys.includes(prop)) this._registerDependency(prop, 'bindings', el);
    });

    // 2. Dependencias de condicionales
    this.shadowRoot.querySelectorAll('[data-if], [data-show]').forEach(el => {
      const expression = el.dataset.if || el.dataset.show;
      const type = el.hasAttribute('data-if') ? 'conditionals' : 'shows';
      
      // Obtenemos todas las variables de estado usadas en la expresión
      this._getDependenciesFromExpression(expression)
        .forEach(prop => this._registerDependency(prop, type, el));
    });

    // 3. Dependencias de bucles y sus elementos internos
    this.shadowRoot.querySelectorAll('[data-each]').forEach(loopEl => {
      const [_, __, arrayName] = loopEl.dataset.each.split(' ');
      if (stateKeys.includes(arrayName)) {
        this._registerDependency(arrayName, 'loops', loopEl);

        // Registramos las dependencias de los condicionales dentro del bucle
        loopEl.querySelectorAll('[data-if], [data-show]').forEach(conditionalEl => {
          const expression = conditionalEl.dataset.if || conditionalEl.dataset.show;
          const deps = this._getDependenciesFromExpression(expression);
          
          // Para cada variable de estado usada en la condición
          deps.forEach(prop => {
            // Si la variable no es el array del bucle, la registramos como dependencia
            if (prop !== arrayName) {
              // Registramos el elemento del bucle como dependiente
              this._registerDependency(prop, 'loops', loopEl);
            }
          });
        });
      }
    });

    console.log('Mapa de dependencias construido:', this.#dependencies);
    this._fullRender();
  }
  

  // --- LÓGICA DE RENDERIZADO (SELECTIVO Y COMPLETO) ---

  /**
   * Ejecutado en cada cambio de estado. Actualiza solo los elementos necesarios.
   * @param {string} changedProp - La propiedad del estado que acaba de cambiar.
   */
  _selectiveRender(changedProp) {
    const deps = this.#dependencies[changedProp];
    if (!deps) return;

    // Actualiza bindings simples
    deps.bindings.forEach(el => {
      const value = this._resolveValue(el.dataset.bind, this.$state);
      el.textContent = value ?? '';
    });

    // Actualiza condicionales (incluso si no están en el DOM)
    deps.conditionals.forEach(el => {
      if (el.hasAttribute('data-each')) {
        this._updateLoop(el);
      } else {
        this._updateConditional(el);
      }
    });

    // Actualiza visibilidad
    deps.shows.forEach(el => this._updateShow(el));

    // Actualiza bucles
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

  _updateConditional(el, scope = this.$state) {
    const condition = el.dataset.if;
    const shouldShow = this._evaluateCondition(condition, scope);
    
    // Si no existe el comentario ancla, lo creamos y guardamos el elemento original
    if (!el._ifAnchor) {
      el._ifAnchor = document.createComment(`if: ${condition}`);
      el.parentNode.insertBefore(el._ifAnchor, el);
    }

    const nextEl = el.nextElementSibling;
    const hasElse = nextEl?.hasAttribute('data-else');
    
    // También creamos ancla para el else si existe
    if (hasElse && !nextEl._elseAnchor) {
      nextEl._elseAnchor = document.createComment('else');
      nextEl.parentNode.insertBefore(nextEl._elseAnchor, nextEl);
    }

    // Guardamos los elementos en el mapa de dependencias aunque no estén en el DOM
    if (!this.#dependencies[condition]) {
      this.#dependencies[condition] = {
        bindings: new Set(),
        conditionals: new Set([el]),
        loops: new Set(),
        shows: new Set()
      };
    }

    if (shouldShow) {
      // Si el elemento if no está en el DOM, lo insertamos
      if (!el.isConnected) {
        el._ifAnchor.parentNode.insertBefore(el, el._ifAnchor.nextSibling);
      }
      // Si hay un else y está en el DOM, lo quitamos
      if (hasElse && nextEl.isConnected) {
        nextEl.remove();
      }
    } else {
      // Si el elemento if está en el DOM, lo quitamos
      if (el.isConnected) {
        el.remove();
      }
      // Si hay un else y no está en el DOM, lo insertamos
      if (hasElse && !nextEl.isConnected) {
        nextEl._elseAnchor.parentNode.insertBefore(nextEl, nextEl._elseAnchor.nextSibling);
      }
    }
  }

  _updateShow(el, scope = this.$state) {
    const condition = el.dataset.show;
    const shouldShow = this._evaluateCondition(condition, scope);
    el.style.display = shouldShow ? '' : 'none';
  }

  /**
   * [CORREGIDO] Actualiza todo el contenido de un nodo (usado por los bucles).
   * Ahora pasa el 'scope' del bucle a las funciones de actualización.
   * @param {HTMLElement} node - El nodo a actualizar (ej. el clon de un <li>).
   * @param {object} scope - El ámbito de datos (ej. { ...this.$state, item: ... }).
   */
  _updateNodeContent(node, scope) {
    // Actualiza bindings {{ variable }}
    node.querySelectorAll('[data-bind]').forEach(el => {
      const key = el.dataset.bind;
      const value = this._resolveValue(key, scope);
      el.textContent = value ?? '';
    });
    
    // Actualiza condicionales :if/:else dentro del scope del bucle
    node.querySelectorAll('[data-if]').forEach(ifEl => {
      const condition = ifEl.dataset.if;
      const shouldShow = this._evaluateCondition(condition, scope);
      
      // Usamos las anclas existentes
      if (ifEl._ifAnchor) {
        const elseEl = ifEl.nextElementSibling?.hasAttribute('data-else') ? 
                      ifEl.nextElementSibling : null;

        if (shouldShow) {
          if (!ifEl.isConnected) {
            ifEl._ifAnchor.parentNode.insertBefore(ifEl, ifEl._ifAnchor.nextSibling);
          }
          if (elseEl?.isConnected) {
            elseEl.remove();
          }
        } else {
          if (ifEl.isConnected) {
            ifEl.remove();
          }
          if (elseEl && !elseEl.isConnected && elseEl._elseAnchor) {
            elseEl._elseAnchor.parentNode.insertBefore(elseEl, elseEl._elseAnchor.nextSibling);
          }
        }
      }
    });

    // Actualiza visibilidad :show dentro del scope del bucle
    node.querySelectorAll('[data-show]').forEach(el => {
      this._updateShow(el, scope);
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
    
    // Mantenemos un mapa de los elementos condicionales y sus anclas por índice
    container._conditionalElements = container._conditionalElements || new Map();
    
    items.forEach((item, index) => {
      const loopScope = { ...this.$state, [itemAlias]: item };
      let childNode = container.children[index];

      if (!childNode) {
        childNode = templateEl.cloneNode(true);
        childNode.style.display = '';
        childNode.removeAttribute('data-each');
        container.appendChild(childNode);

        // Para cada nuevo elemento condicional, creamos sus anclas
        childNode.querySelectorAll('[data-if]').forEach(ifEl => {
          const elseEl = ifEl.nextElementSibling?.hasAttribute('data-else') ? 
                        ifEl.nextElementSibling : null;
          
          // Creamos las anclas
          const ifAnchor = document.createComment(`if: ${ifEl.dataset.if}`);
          ifEl.parentNode.insertBefore(ifAnchor, ifEl);
          ifEl._ifAnchor = ifAnchor;

          if (elseEl) {
            const elseAnchor = document.createComment('else');
            elseEl.parentNode.insertBefore(elseAnchor, elseEl);
            elseEl._elseAnchor = elseAnchor;
          }
        });
      }

      // Actualizamos el contenido, incluyendo los condicionales
      this._updateNodeContent(childNode, loopScope);
    });

    // Limpiamos los elementos sobrantes
    while (container.children.length > items.length) {
      container.removeChild(container.lastChild);
    }
  }
}
