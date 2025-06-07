/*
 * EJS Embedded JavaScript templates - Modern ES2020+ Version
 * Based on the original work by Matthew Eernisse (mde@fleegix.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * @file Modernized Embedded JavaScript templating engine. {@link http://ejs.co}
 * @author Matthew Eernisse <mde@fleegix.org> (Original)
 * @author Google Gemini (Refactor)
 * @project EJS
 * @license {@link http://www.apache.org/licenses/LICENSE-2.0 Apache License, Version 2.0}
 */

import fs from 'fs/promises'; // Modern async file system access
import path from 'path';
import * as utils from './utils.modern.js'; // Assuming a modern utils file

// --- Module-level Constants ---
const _VERSION_STRING = '3.1.9-modern'; // Example version
const _DEFAULT_OPEN_DELIMITER = '<';
const _DEFAULT_CLOSE_DELIMITER = '>';
const _DEFAULT_DELIMITER = '%';
const _DEFAULT_LOCALS_NAME = 'locals';
const _NAME = 'ejs';
const _REGEX_STRING = '(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)';
const _OPTS_PASSABLE_WITH_DATA = ['delimiter', 'scope', 'context', 'debug', 'compileDebug', 'client', '_with', 'rmWhitespace', 'strict', 'filename', 'async'];
const _BOM = /^\uFEFF/;
const _JS_IDENTIFIER = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;


// --- Public API ---

/**
 * EJS template function cache.
 * @type {utils.Cache}
 */
export const cache = utils.cache;

/**
 * Custom file loader. Defaults to Node's async readFile.
 * @type {function(string): Promise<string>}
 */
export let fileLoader = (filePath) => fs.readFile(filePath, 'utf-8');

/**
 * Name of the object containing the locals.
 * @type {String}
 */
export const localsName = _DEFAULT_LOCALS_NAME;

/**
 * Promise implementation. Defaults to native Promise.
 * @type {PromiseConstructor}
 */
export const promiseImpl = Promise;

/**
 * Resolves the path to an included file.
 */
export function resolveInclude(name, filename, isDir = false) {
    const dirname = path.dirname;
    const extname = path.extname;
    const resolve = path.resolve;
    const includePath = resolve(isDir ? filename : dirname(filename), name);
    const ext = extname(name);
    if (!ext) {
        return `${includePath}.ejs`;
    }
    return includePath;
}

/**
 * Compiles an EJS template string into a function.
 *
 * @param {String} template EJS template string.
 * @param {Object} [opts={}] Compilation options.
 * @returns {Function} The compiled template function.
 */
export function compile(template, opts) {
    const templ = new Template(template, opts);
    return templ.compile();
}

/**
 * Renders an EJS template string.
 *
 * @param {String} template The EJS template.
 * @param {Object} [data={}] Template data.
 * @param {Object} [opts={}] Compilation and rendering options.
 * @returns {String|Promise<String>} The rendered output.
 */
export function render(template, data = {}, opts = {}) {
    // If only two arguments, options might be in the data object
    if (arguments.length === 2) {
        utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA);
    }
    return handleCache(opts, template)(data);
}

/**
 * Renders an EJS file from a given path.
 *
 * @param {String} filename Path to the EJS file.
 * @param {Object} [data={}] Template data.
 * @param {Object} [opts={}] Compilation and rendering options.
 * @returns {Promise<String>} A promise that resolves with the rendered HTML.
 */
export async function renderFile(filename, data = {}, opts = {}) {
    const options = { ...opts };
    options.filename = filename;

    // Special handling for Express.js integration
    if (data.settings) {
        if (data.settings.views) options.views = data.settings.views;
        if (data.settings['view cache']) options.cache = true;
        const viewOpts = data.settings['view options'];
        if (viewOpts) utils.shallowCopy(options, viewOpts);
    }
    utils.shallowCopyFromList(options, data, _OPTS_PASSABLE_WITH_DATA.concat('cache'));
    
    // The core logic, now async/await based
    try {
        const template = await getTemplate(options);
        return template(data);
    } catch (err) {
        // Rethrow errors with better context
        rethrow(err, '', filename, 1, utils.escapeXML);
    }
}


/**
 * Clears the template cache.
 */
export function clearCache() {
    cache.reset();
}

/**
 * Express.js support. Alias for `renderFile`.
 */
export const __express = renderFile;
export const VERSION = _VERSION_STRING;
export const name = _NAME;
export const escapeXML = utils.escapeXML;


// --- Internal Helper Functions ---

/**
 * Gets a compiled template function, using the cache if enabled.
 * @param {Object} options Compilation options, must include `filename`.
 * @returns {Promise<Function>} The compiled template function.
 */
async function getTemplate(options) {
    const { filename, cache: useCache } = options;
    if (!filename) {
        throw new Error('`filename` option is required for caching or file loading.');
    }

    if (useCache) {
        const cached = cache.get(filename);
        if (cached) {
            return cached;
        }
    }

    const template = (await fileLoader(filename)).replace(_BOM, '');
    const compiled = compile(template, options);

    if (useCache) {
        cache.set(filename, compiled);
    }

    return compiled;
}

/**
 * Gets a template from a string or file and caches it.
 * This function centralizes the caching logic.
 *
 * @param {Object} options Compilation options.
 * @param {String} [template] Optional template source.
 * @returns {Function} The compiled function.
 */
function handleCache(options, template) {
    const { filename, cache: useCache } = options;

    if (useCache) {
        if (!filename) {
            throw new Error('`cache` option requires a `filename`.');
        }
        const cachedFunc = cache.get(filename);
        if (cachedFunc) {
            return cachedFunc;
        }
    }

    if (!template) {
        // This path is less common in `render`, but vital for `renderFile` logic
        // which would have already loaded it.
        throw new Error('`template` is required if not using a cached `filename`');
    }

    const func = compile(template, options);

    if (useCache && filename) {
        cache.set(filename, func);
    }

    return func;
}


/**
 * Re-throws an error with EJS-specific context.
 */
function rethrow(err, str, flnm, lineno, esc) {
    const lines = str.split('\n');
    const start = Math.max(lineno - 3, 0);
    const end = Math.min(lines.length, lineno + 3);
    const filename = esc(flnm);
    
    const context = lines.slice(start, end).map((line, i) => {
        const curr = i + start + 1;
        return `${(curr == lineno ? ' >> ' : '    ')}${curr}| ${line}`;
    }).join('\n');

    err.path = filename;
    err.message = `${filename || 'ejs'}:${lineno}\n${context}\n\n${err.message}`;
    throw err;
}

const stripSemi = (str) => str.replace(/;(\s*$)/, '$1');

// --- The Modern Template Class ---

export class Template {
    constructor(text, opts = {}) {
        const options = utils.hasOwnOnlyObject(opts);
        this.templateText = text;
        this.mode = null;
        this.truncate = false;
        this.currentLine = 1;
        this.source = '';

        // Use destructuring with default values for cleaner options handling
        const {
            client = false,
            escapeFunction = utils.escapeXML,
            compileDebug = true,
            debug = false,
            filename,
            openDelimiter = _DEFAULT_OPEN_DELIMITER,
            closeDelimiter = _DEFAULT_CLOSE_DELIMITER,
            delimiter = _DEFAULT_DELIMITER,
            strict = false,
            context,
            cache = false,
            rmWhitespace,
            root,
            includer,
            outputFunctionName,
            localsName = _DEFAULT_LOCALS_NAME,
            views,
            async = false,
            destructuredLocals,
            _with = !strict,
        } = options;

        this.opts = { client, escapeFunction, compileDebug, debug, filename, openDelimiter, closeDelimiter, delimiter, strict, context, cache, rmWhitespace, root, includer, outputFunctionName, localsName, views, async, destructuredLocals, _with };

        this.regex = this.createRegex();
    }

    createRegex() {
        let str = _REGEX_STRING;
        const delim = utils.escapeRegExpChars(this.opts.delimiter);
        const open = utils.escapeRegExpChars(this.opts.openDelimiter);
        const close = utils.escapeRegExpChars(this.opts.closeDelimiter);
        str = str.replace(/%/g, delim).replace(/</g, open).replace(/>/g, close);
        return new RegExp(str);
    }

    compile() {
        const { escapeFunction, client, compileDebug, filename, strict, debug, async, localsName, _with, context } = this.opts;
        
        if (!this.source) {
            this.generateSource();
            
            // Using template literals for much better readability
            let prepended = `
                let __output = "";
                const __append = (s) => { if (s !== undefined && s !== null) __output += s };
            `;
            
            if (this.opts.outputFunctionName) {
                prepended += `const ${this.opts.outputFunctionName} = __append;\n`;
            }

            if (_with) {
                prepended += `with (${localsName} || {}) {\n`;
            }
            
            const appended = _with ? '}\n' : '';
            this.source = prepended + this.source + appended + 'return __output;\n';
        }

        let src = this.source;
        if (compileDebug) {
            const sanitizedFilename = filename ? JSON.stringify(filename) : 'undefined';
            src = `
                let __line = 1;
                const __lines = ${JSON.stringify(this.templateText)};
                const __filename = ${sanitizedFilename};
                try {
                    ${this.source}
                } catch (e) {
                    rethrow(e, __lines, __filename, __line, escapeFn);
                }
            `;
        }

        if (client) {
            src = `escapeFn = escapeFn || ${escapeFunction.toString()};\n${src}`;
            if (compileDebug) {
                src = `rethrow = rethrow || ${rethrow.toString()};\n${src}`;
            }
        }
        
        if (strict) {
            src = '"use strict";\n' + src;
        }

        if (debug) {
            console.log(src);
        }
        
        // Dynamically get the AsyncFunction constructor if needed
        const ctor = async
            ? Object.getPrototypeOf(async function(){}).constructor
            : Function;
        
        const fn = new ctor(localsName, 'escapeFn', 'include', 'rethrow', src);

        // Wrapper function that provides the `include` function
        const returnedFn = async (data) => {
            const include = async (filePath, includeData) => {
                const newOpts = { ...this.opts };
                // Resolve include path logic here (simplified)
                newOpts.filename = resolveInclude(filePath, this.opts.filename || process.cwd());
                const fileContent = await fileLoader(newOpts.filename);
                const combinedData = { ...(data || {}), ...(includeData || {}) };
                return render(fileContent, combinedData, newOpts);
            };

            return fn.apply(context, [data || {}, escapeFunction, include, rethrow]);
        };
        
        return client ? fn : returnedFn;
    }

    generateSource() {
        if (this.opts.rmWhitespace) {
            this.templateText = this.templateText
                .replace(/[\r\n]+/g, '\n')
                .replace(/^\s+|\s+$/gm, '');
        }
        this.templateText = this.templateText
            .replace(/[ \t]*<%_/gm, '<%_')
            .replace(/_%>[ \t]*/gm, '_%>');
        
        const matches = this.parseTemplateText();
        if (matches && matches.length) {
            matches.forEach(line => this.scanLine(line));
        }
    }

    parseTemplateText() {
        let str = this.templateText;
        const pat = this.regex;
        const arr = [];
        let result;

        while ((result = pat.exec(str))) {
            const firstPos = result.index;
            if (firstPos !== 0) {
                arr.push(str.substring(0, firstPos));
            }
            arr.push(result[0]);
            str = str.slice(firstPos + result[0].length);
        }
        if (str) {
            arr.push(str);
        }
        return arr;
    }
    
    scanLine(line) {
        const { delimiter: d, openDelimiter: o, closeDelimiter: c } = this.opts;
        const self = this;
        let newLineCount = (line.split('\n').length - 1);

        const modes = {
            EVAL: 'eval',
            ESCAPED: 'escaped',
            RAW: 'raw',
            COMMENT: 'comment',
            LITERAL: 'literal'
        };

        switch (line) {
            case o + d:
            case o + d + '_':
                this.mode = modes.EVAL;
                break;
            case o + d + '=':
                this.mode = modes.ESCAPED;
                break;
            case o + d + '-':
                this.mode = modes.RAW;
                break;
            case o + d + '#':
                this.mode = modes.COMMENT;
                break;
            case o + d + d:
                this.mode = modes.LITERAL;
                this.source += `    ; __append("${line.replace(o + d + d, o + d)}");\n`;
                break;
            case d + d + c:
                this.mode = modes.LITERAL;
                this.source += `    ; __append("${line.replace(d + d + c, d + c)}");\n`;
                break;
            case d + c:
            case '-' + d + c:
            case '_' + d + c:
                if (this.mode === modes.LITERAL) {
                    this._addOutput(line);
                }
                this.mode = null;
                this.truncate = line.startsWith('-') || line.startsWith('_');
                break;
            default:
                if (this.mode) {
                    switch (this.mode) {
                        case modes.EVAL:
                            this.source += `    ; ${line}\n`;
                            break;
                        case modes.ESCAPED:
                            this.source += `    ; __append(escapeFn(${stripSemi(line)}));\n`;
                            break;
                        case modes.RAW:
                            this.source += `    ; __append(${stripSemi(line)});\n`;
                            break;
                        case modes.COMMENT:
                            // Do nothing
                            break;
                        case modes.LITERAL:
                            this._addOutput(line);
                            break;
                    }
                } else {
                    this._addOutput(line);
                }
        }
        
        if (this.opts.compileDebug && newLineCount) {
            this.currentLine += newLineCount;
            this.source += `    ; __line = ${this.currentLine};\n`;
        }
    }
    
    _addOutput(line) {
        if (this.truncate) {
            line = line.replace(/^(?:\r\n|\r|\n)/, '');
            this.truncate = false;
        }
        if (!line) return;
        
        // Literal backslashes, newlines, and quotes must be escaped.
        line = line.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/"/g, '\\"');
        this.source += `    ; __append("${line}");\n`;
    }
}