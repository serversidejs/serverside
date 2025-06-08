/**
 * Creates a JSON response
 * @param {any} data - Data to be sent as JSON
 * @param {number} [status=200] - HTTP status code
 * @returns {Response}
 */
export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Creates a text response
   * @param {string} text - Text to be sent
   * @param {number} [status=200] - HTTP status code
   * @returns {Response}
   */
  export function text(text, status = 200) {
    return new Response(text, {
      status,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
  
  /**
   * Creates an HTML response
   * @param {string} html - HTML content to be sent
   * @param {number} [status=200] - HTTP status code
   * @returns {Response}
   */
  export function html(html, status = 200) {
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
  
  /**
   * Creates a 400 Bad Request response
   * @param {string} [message='Bad Request'] - Error message
   * @returns {Response}
   */
  export function badRequest(message = 'Bad Request') {
    return json({ error: message }, 400);
  }
  
  /**
   * Creates a 401 Unauthorized response
   * @param {string} [message='Unauthorized'] - Error message
   * @returns {Response}
   */
  export function unauthorized(message = 'Unauthorized') {
    return json({ error: message }, 401);
  }
  
  /**
   * Creates a 403 Forbidden response
   * @param {string} [message='Forbidden'] - Error message
   * @returns {Response}
   */
  export function forbidden(message = 'Forbidden') {
    return json({ error: message }, 403);
  }
  
  /**
   * Creates a 404 Not Found response
   * @param {string} [message='Not Found'] - Error message
   * @returns {Response}
   */
  export function notFound(message = 'Not Found') {
    return json({ error: message }, 404);
  }
  
  /**
   * Creates a 500 Internal Server Error response
   * @param {string} [message='Internal Server Error'] - Error message
   * @returns {Response}
   */
  export function serverError(message = 'Internal Server Error') {
    return json({ error: message }, 500);
  }
  
  /**
   * Creates a redirect response
   * @param {string} url - URL to redirect to
   * @param {number} [status=302] - HTTP status code (301, 302, 307, 308)
   * @returns {Response}
   */
  export function redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: {
        'Location': url
      }
    });
  }
  
  /**
   * Creates a response with custom headers
   * @param {any} data - Data to be sent
   * @param {Object} headers - Custom headers
   * @param {number} [status=200] - HTTP status code
   * @returns {Response}
   */
  export function custom(data, headers, status = 200) {
    return new Response(
      typeof data === 'string' ? data : JSON.stringify(data),
      {
        status,
        headers: {
          'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/json',
          ...headers
        }
      }
    );
  }
  
  /**
   * Cookie options interface
   */
  interface CookieOptions {
    expires?: Date;
    maxAge?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }
  
  /**
   * Creates a Set-Cookie header value
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {CookieOptions} [options] - Cookie options
   * @returns {string} Set-Cookie header value
   */
  export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
    const {
      expires,
      maxAge,
      domain,
      path = '/',
      secure = false,
      httpOnly = true,
      sameSite = 'Lax'
    } = options;
  
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
    if (expires) cookie += `; Expires=${expires.toUTCString()}`;
    if (maxAge) cookie += `; Max-Age=${maxAge}`;
    if (domain) cookie += `; Domain=${domain}`;
    if (path) cookie += `; Path=${path}`;
    if (secure) cookie += '; Secure';
    if (httpOnly) cookie += '; HttpOnly';
    if (sameSite) cookie += `; SameSite=${sameSite}`;
  
    return cookie;
  }
  
  /**
   * Parses cookies from a Header
   * @param {cookieHeader} string - The cookie header
   * @returns {Record<string, string>} Object containing cookie name-value pairs
   */
  export function parseCookiesFromHeader(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
  
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        try {
          cookies[decodeURIComponent(name)] = JSON.parse(decodeURIComponent(value));
        } catch {
          cookies[decodeURIComponent(name)] = decodeURIComponent(value);
        }
      });
    }
  
    return cookies;
  }
  
  /**
   * Creates a response with a cookie
   * @param {any} data - Response data
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {CookieOptions} [options] - Cookie options
   * @param {number} [status=200] - HTTP status code
   * @returns {Response}
   */
  export function withCookie(
    data: any,
    name: string,
    value: string,
    options: CookieOptions = {},
    status = 200
  ): Response {
    const cookie = createCookie(name, value, options);
    return custom(data, { 'Set-Cookie': cookie }, status);
  }
  
  /**
   * Creates a response that clears a cookie
   * @param {any} data - Response data
   * @param {string} name - Cookie name to clear
   * @param {CookieOptions} [options] - Cookie options (path and domain are important for clearing)
   * @param {number} [status=200] - HTTP status code
   * @returns {Response}
   */
  export function clearCookie(
    data: any,
    name: string,
    options: CookieOptions = {},
    status = 200
  ): Response {
    const cookie = createCookie(name, '', {
      ...options,
      maxAge: 0,
      expires: new Date(0)
    });
    return custom(data, { 'Set-Cookie': cookie }, status);
  }
  