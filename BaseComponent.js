// src/BaseComponent.js

export class BaseComponent extends HTMLElement {
  #state;
  #initialized = false;

  constructor() {
    super();
    // 1. Obtener la configuración estática definida en la clase hija
    const { initialState, template } = this.constructor;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = template;

    // 2. Crear el estado reactivo usando la misma lógica de Proxy
    this.#state = new Proxy(initialState || {}, {
      set: (target, prop, value) => {
        const oldValue = target[prop];
        target[prop] = value;
        // Solo re-renderizar si el valor cambia y el componente está en el DOM
        if (oldValue !== value && this.#initialized) {
          this.render();
        }
        return true;
      }
    });

    // Permitir el acceso al estado desde fuera, pero de forma controlada
    this.state = this.#state;
  }

  connectedCallback() {
    this.render();
    this.#initialized = true;
    
    // Ejecutar la lógica del script del componente si existe
    if (this.onMount) {
        this.onMount();
    }
  }

  // El método de renderizado ahora está centralizado
  render() {
    // 1. Actualizar bindings de texto: {{ variable }}
    this.shadowRoot.querySelectorAll('[data-bind]').forEach(el => {
      const stateKey = el.dataset.bind;
      if (stateKey in this.#state) {
        el.textContent = this.#state[stateKey];
      }
    });

    // 2. Gestionar renderizado condicional: v-if / v-else
    this.shadowRoot.querySelectorAll('[data-if]').forEach(el => {
      const stateKey = el.dataset.if;
      // Evaluar la condición de forma segura
      const condition = new Function('state', `return !!state.${stateKey}`)(this.#state);
      el.style.display = condition ? '' : 'none';

      // Gestionar el elemento 'v-else' asociado
      const elseEl = el.nextElementSibling;
      if (elseEl && elseEl.hasAttribute('data-else')) {
        elseEl.style.display = condition ? 'none' : '';
      }
    });
  }
}