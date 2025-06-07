/**
 * @typedef {'text' | 'variable' | 'if' | 'each' | 'else' | 'json' | 'html' | 'include'} NodeType
 */

/**
 * @typedef {object} Node
 * @property {NodeType} type - El tipo de nodo.
 * @property {string} [value] - El valor del nodo (para texto o variables).
 * @property {string} [condition] - La condición para los nodos 'if'.
 * @property {string} [collection] - El nombre de la colección para los nodos 'each'.
 * @property {string} [itemAlias] - El alias para cada elemento en los nodos 'each'.
 * @property {Node[]} [children] - Nodos hijos (para bloques 'if', 'each', etc.).
 * @property {Node[]} [elseChildren] - Nodos hijos para la parte 'else' de un 'if'.
 */

class Templatron {
    /**
     * @private
     * @type {RegExp}
     * Expresión regular para encontrar todas las etiquetas de plantilla con la nueva sintaxis:
     * { variable }
     * {@json variable} <-- ¡Nuevo!
     * {#if condition}
     * {:else}
     * {/if}
     * {#each collection as item}
     * {/each}
     *
     * Captura:
     * 1. Variables: { variable }
     * 2. JSON variables: {@json variable}
     * 3. Comandos de bloque de apertura: {#if ...}, {#each ...}
     * 4. Comando else: {:else}
     * 5. Comandos de bloque de cierre: {/if}, {/each}
     */
    static TEMPLATE_TAG_REGEX = /\{(?:(?!\#|\:|\/|\@)([\w\d\.]+))\s*\}|\{\@(?:json|html)\s+([\w\d\.]+)\s*\}|\{\#(?<command>if|each|include)\s+([\w\d\.\/]+)\s*(?:as\s+([\w\d]+))?\}|\{\:(?<elseCommand>else)\}|\{\/(?<endCommand>if|each)\}/g;

    constructor() {
        // No hay estado en el constructor para hacer la instancia reutilizable.
    }

    /**
     * Compila una plantilla de texto en un Árbol de Sintaxis Abstracta (AST).
     * Esto permite una renderización eficiente y el manejo de anidación.
     * @param {string} templateString - La cadena de la plantilla.
     * @returns {Node[]} El AST de la plantilla.
     * @private
     */
    _compile(templateString) {
        const nodes = [];
        const stack = []; // Para manejar la anidación de bloques (if, each)
        let lastIndex = 0;

        // Iterar sobre todas las coincidencias de etiquetas en la plantilla
        templateString.replace(Templatron.TEMPLATE_TAG_REGEX, (match, variableContent, jsonOrHtmlVariableContent, command, conditionOrCollection, itemAlias, elseCommand, endCommand, offset) => {
            // Añadir el texto plano antes de la etiqueta actual
            if (offset > lastIndex) {
                const text = templateString.substring(lastIndex, offset);
                if (text.trim().length > 0 || text.includes('\n')) {
                     this._addNode(nodes, stack, { type: 'text', value: text });
                }
            }
            lastIndex = offset + match.length;

            if (variableContent) {
                // Es una variable { variable }
                this._addNode(nodes, stack, { type: 'variable', value: variableContent.trim() });
            } else if (jsonOrHtmlVariableContent) {
                // Es una variable JSON o HTML {@json variable} o {@html variable}
                const isHtml = match.startsWith('{@html');
                this._addNode(nodes, stack, { 
                    type: isHtml ? 'html' : 'json', 
                    value: jsonOrHtmlVariableContent.trim() 
                });
            }
            else if (command === 'if') {
                // Es un bloque de apertura {#if condition}
                const ifNode = { type: 'if', condition: conditionOrCollection.trim(), children: [] };
                this._addNode(nodes, stack, ifNode);
                stack.push(ifNode);
            } else if (command === 'each') {
                // Es un bloque de apertura {#each collection as item}
                const eachNode = { type: 'each', collection: conditionOrCollection.trim(), itemAlias: (itemAlias || 'item').trim(), children: [] };
                this._addNode(nodes, stack, eachNode);
                stack.push(eachNode);
            } else if (command === 'include') {
                // Es una inclusión de componente {#include "path/to/component"}
                this._addNode(nodes, stack, { type: 'include', value: conditionOrCollection.trim() });
            } else if (elseCommand === 'else') {
                // Es un bloque {:else}
                const parent = stack[stack.length - 1];
                if (!parent || parent.type !== 'if') {
                    throw new Error("Templatron Error: '{:else}' found without a preceding '{#if}' block.");
                }
                parent.elseChildren = []; // Inicializar el array de hijos para 'else'
                parent.__isProcessingElse = true; // Marca temporal para el manejo de hijos
            } else if (endCommand === 'if') {
                // Es un bloque de cierre {/if}
                const closedNode = stack.pop();
                if (!closedNode || closedNode.type !== 'if') {
                    throw new Error("Templatron Error: '{/if}' found without a matching '{#if}' block.");
                }
                delete closedNode.__isProcessingElse; // Eliminar la marca temporal
            } else if (endCommand === 'each') {
                // Es un bloque de cierre {/each}
                const closedNode = stack.pop();
                if (!closedNode || closedNode.type !== 'each') {
                    throw new Error("Templatron Error: '{/each}' found without a matching '{#each}' block.");
                }
            }
        });

        // Añadir cualquier texto restante después de la última etiqueta
        if (lastIndex < templateString.length) {
            const text = templateString.substring(lastIndex);
            if (text.trim().length > 0 || text.includes('\n')) {
                this._addNode(nodes, stack, { type: 'text', value: text });
            }
        }

        if (stack.length > 0) {
            throw new Error(`Templatron Error: Unclosed blocks remaining: ${stack.map(n => n.type).join(', ')}`);
        }

        return nodes;
    }

    /**
     * Añade un nodo al árbol, manejando la anidación.
     * @param {Node[]} rootNodes - Los nodos raíz del AST.
     * @param {Node[]} stack - La pila de nodos abiertos actualmente.
     * @param {Node} nodeToAdd - El nodo a añadir.
     * @private
     */
    _addNode(rootNodes, stack, nodeToAdd) {
        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.__isProcessingElse) {
                 parent.elseChildren.push(nodeToAdd);
            } else {
                 parent.children.push(nodeToAdd);
            }
        } else {
            rootNodes.push(nodeToAdd);
        }
    }

    /**
     * Resuelve el valor de una ruta dentro de un objeto de datos.
     * @param {object} data - El objeto de datos.
     * @param {string} path - La ruta a resolver (ej., "user.name", "isAdmin").
     * @returns {*} El valor resuelto o undefined.
     * @private
     */
    _resolvePath(data, path) {
        // Si el path es un número o booleano literal, lo devuelve
        if (!isNaN(Number(path)) && String(Number(path)) === path) return Number(path);
        if (path === 'true') return true;
        if (path === 'false') return false;

        return path.split('.').reduce((acc, part) => {
            return (acc !== null && acc !== undefined && typeof acc === 'object' && acc.hasOwnProperty(part)) ? acc[part] : undefined;
        }, data);
    }

    /**
     * Evalúa una condición booleana.
     * Soporta negación básica (ej., !isAdmin).
     * @param {string} condition - La cadena de la condición.
     * @param {object} data - El objeto de datos.
     * @returns {boolean} El resultado de la evaluación.
     * @private
     */
    _evaluateCondition(condition, data) {
        if (condition.startsWith('!')) {
            const path = condition.substring(1).trim();
            return !this._resolvePath(data, path);
        }
        return !!this._resolvePath(data, condition);
    }

    /**
     * Escapa caracteres HTML y JavaScript dentro de una cadena.
     * Esto es crucial para la seguridad al inyectar JSON en un script.
     * @param {string} str - La cadena a escapar.
     * @returns {string} La cadena escapada.
     * @private
     */
    _escapeHtmlJs(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\//g, '&#x2F;') // Importante para evitar </script>
            .replace(/`/g, '&#96;'); // Para template literals
    }

    /**
     * Renderiza el AST en una cadena HTML/texto.
     * @param {Node[]} nodes - El AST a renderizar.
     * @param {object} data - Los datos para la plantilla.
     * @returns {string} La cadena de texto/HTML renderizada.
     * @private
     */
    async _renderNodes(nodes, data) {
        let result = '';
        for (const node of nodes) {
            switch (node.type) {
                case 'text':
                    result += node.value;
                    break;
                case 'variable':
                    const value = this._resolvePath(data, node.value);
                    result += value !== undefined ? this._escapeHtmlJs(value) : '';
                    break;
                case 'json':
                    const jsonValue = this._resolvePath(data, node.value);
                    result += jsonValue !== undefined ? this._escapeHtmlJs(JSON.stringify(jsonValue)) : 'null';
                    break;
                case 'html':
                    const htmlValue = this._resolvePath(data, node.value);
                    result += htmlValue !== undefined ? htmlValue : '';
                    break;
                case 'if':
                    if (this._evaluateCondition(node.condition, data)) {
                        result += await this._renderNodes(node.children, data);
                    } else if (node.elseChildren) {
                        result += await this._renderNodes(node.elseChildren, data);
                    }
                    break;
                case 'each':
                    const collection = this._resolvePath(data, node.collection);
                    if (Array.isArray(collection)) {
                        for (const item of collection) {
                            const itemData = { ...data, [node.itemAlias]: item };
                            result += await this._renderNodes(node.children, itemData);
                        }
                    }
                    break;
                case 'include':
                    try {
                        const fs = require('fs');
                        const path = require('path');
                        const componentPath = path.join(process.cwd(), 'src', node.value);
                        const componentContent = fs.readFileSync(componentPath, 'utf8');
                        const componentNodes = this._compile(componentContent);
                        result += await this._renderNodes(componentNodes, data);
                    } catch (error) {
                        console.error(`Error loading component ${node.value}:`, error);
                        result += `<!-- Error loading component: ${node.value} -->`;
                    }
                    break;
            }
        }
        return result;
    }

    /**
     * Renderiza una plantilla utilizando los datos proporcionados.
     * Este es el método público principal.
     * @param {string} templateString - La cadena de la plantilla.
     * @param {object} data - El objeto de datos para la plantilla.
     * @returns {string} La cadena de texto/HTML renderizada.
     */
    render(templateString, data) {
        try {
            const ast = this._compile(templateString);
            return this._renderNodes(ast, data);
        } catch (error) {
            console.error("Templatron Rendering Error:", error.message);
            return `Error rendering template: ${error.message}`;
        }
    }
}

export { Templatron };