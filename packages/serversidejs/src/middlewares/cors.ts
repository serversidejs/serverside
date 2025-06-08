/**
   * CORS options interface
   */
interface CorsOptions {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  }
  
  /**
   * Creates CORS headers based on options
   * @param {Request} request - The request object
   * @param {CorsOptions} [options] - CORS options
   * @returns {Record<string, string>} CORS headers
   */
function createCorsHeaders(request: Request, options: CorsOptions = {}): Record<string, string> {
    const {
      origin = '*',
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders = ['Content-Type', 'Authorization'],
      exposedHeaders = [],
      credentials = false,
      maxAge = 86400 // 24 hours
    } = options;
  
    const headers: Record<string, string> = {};
  
    // Handle origin
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin) {
      if (typeof origin === 'function') {
        if (origin(requestOrigin)) {
          headers['Access-Control-Allow-Origin'] = requestOrigin;
        }
      } else if (Array.isArray(origin)) {
        if (origin.includes(requestOrigin)) {
          headers['Access-Control-Allow-Origin'] = requestOrigin;
        }
      } else if (origin === '*') {
        headers['Access-Control-Allow-Origin'] = '*';
      } else {
        headers['Access-Control-Allow-Origin'] = origin;
      }
    }
  
    // Handle credentials
    if (credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = methods.join(', ');
      headers['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');
      headers['Access-Control-Max-Age'] = maxAge.toString();
    }
  
    // Handle exposed headers
    if (exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = exposedHeaders.join(', ');
    }
  
    return headers;
  }
  
  /**
   * Creates a CORS middleware
   * @param {CorsOptions} [options] - CORS options
   * @returns {Function} CORS middleware
   */

export default function cors(options: CorsOptions = {}) {
    return async (request: Request, next: any) => {
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: createCorsHeaders(request, options)
        });
        }

        // Handle actual request
        const response = await next();
        const corsHeaders = createCorsHeaders(request, options);
        
        // Add CORS headers to response
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    };
}