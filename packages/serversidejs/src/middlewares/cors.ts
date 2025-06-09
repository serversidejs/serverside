import { kMaxLength } from "buffer";

/**
   * CORS options interface
   */
interface CorsOptions {
    origin?: string | string[] | ((origin: string | null) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  }

  interface CorsHeader {
    key: string;
    value: string | boolean | null;
  }


  function isString(s) {
    return typeof s === 'string' || s instanceof String;
  }
  
  function isOriginAllowed(origin: string | null, allowedOrigin: string[] | string | RegExp | boolean) {
    if(!origin) {
      return false;
    }
    if(Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin);
    } else if (isString(allowedOrigin)) {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    }
    return !!allowedOrigin;
  }
  function configureOrigin(req: Request, origin?: string | string[] | boolean | RegExp | ((origin: string | null) => boolean)): CorsHeader[] {
    let requestOrigin = req.headers.get('origin');
    let headers: CorsHeader[] = []
    let isAllowed = false


    if(!origin || origin === '*') {
      headers.push({
        key: 'Access-Control-Allow-Origin',
        value: '*'
      })
    } else if (isString(origin)) {
      headers.push({
        key: 'Access-Control-Allow-Origin',
        value: origin
      })
      headers.push({
        key: 'Vary',
        value: 'Origin'
      });
    } else if(typeof origin === 'function') {
      isAllowed = origin(requestOrigin);
      headers.push({
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : "false"
      })
      headers.push({
        key: 'Vary',
        value: 'Origin'
      });
    } else {
      isAllowed = isOriginAllowed(requestOrigin, origin);

      // reflect origin
      headers.push({
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : "false"
      });
      headers.push({
        key: 'Vary',
        value: 'Origin'
      });

    }

    return headers;
  }

  function configureCredentials(credentials: boolean): CorsHeader {
    return {
      key: 'Access-Control-Allow-Credentials',
      value: credentials.toString()
    };
  }

  function configureMethods(methods: string[]): CorsHeader {
    return {
      key: 'Access-Control-Allow-Methods',
      value: methods.join(', ')
    };
  }

  function configureAllowedHeaders(allowedHeaders: string[]): CorsHeader {
    return {
      key: 'Access-Control-Allow-Headers',
      value: allowedHeaders.join(', ')
    };
  }
  function configureExposedHeaders(exposedHeaders: string[]): CorsHeader {
    return {
      key: 'Access-Control-Expose-Headers',
      value: exposedHeaders.join(', ')
    };
  }

  function configureMaxAge(maxAge: number): CorsHeader {
    return {
      key: 'Access-Control-Max-Age',
      value: maxAge.toString()
    };
  }

  /**
   * Creates CORS headers based on options
   * @param {Request} request - The request object
   * @param {CorsOptions} [options] - CORS options
   * @returns {Record<string, string>} CORS headers
   */
function createCorsHeaders(request: Request, options: CorsOptions = {}): CorsHeader[] {
    const {
      origin = '*',
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders = ['Content-Type', 'Authorization'],
      exposedHeaders = ["*"],
      credentials = false,
      maxAge = 86400 // 24 hours
    } = options;
  
    let headers: CorsHeader[] = [];
  
    // Handle origin
    console.log('request', request);
    const requestOrigin = request.headers.get('origin');
    console.log('requestOrigin', requestOrigin);



    headers = [...headers, ...configureOrigin(request, origin)];
    headers.push(configureCredentials(credentials));
    headers.push(configureMethods(methods));
    headers.push(configureAllowedHeaders(allowedHeaders));
    headers.push(configureExposedHeaders(exposedHeaders));
    
    if(request.method === 'OPTIONS') {
      headers.push(configureMaxAge(maxAge));
    }
  
  
    return headers;
  }
  
  /**
   * Creates a CORS middleware
   * @param {CorsOptions} [options] - CORS options
   * @returns {Function} CORS middleware
   */

export default function cors(options: CorsOptions = {}) {
    return async (request: Request, res: Response, next: any) => {
        const corsHeadersOptions = createCorsHeaders(request, options);
        
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: Object.fromEntries(corsHeadersOptions.map((header) => [
                    header.key,
                    header.value?.toString() ?? ''
                ]))
            });
        }

        // Get the original response from the API
        
        // Add CORS headers to the original response
        corsHeadersOptions.forEach((header) => {
            if (header.value !== null) {
                res.headers.set(header.key, header.value.toString());
            }
        });
        console.log('CORS RES', res);
        return await next();
    };
}