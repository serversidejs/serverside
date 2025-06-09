import { logger } from '../logger.js';

function loggerMiddleware() {
  return async (request: Request, res: Response, next: any) => {
    const start = Date.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);
    const headers = Object.fromEntries(request.headers.entries());

    // Log request
    logger.info({
      type: 'request',
      method,
      path,
      query,
      headers: {
        ...headers,
        authorization: headers.authorization ? '[REDACTED]' : undefined
      }
    });

    try {
      // const response = await next();
      // const duration = Date.now() - start;

      // // Log response
      // logger.info({
      //   type: 'response',
      //   method,
      //   path,
      //   status: response?.status || 200,
      //   duration: `${duration}ms`
      // });

      // return response;
    } catch (error) {
      const duration = Date.now() - start;

      // Log error
      logger.error({
        type: 'error',
        method,
        path,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        duration: `${duration}ms`
      });

      throw error;
    }
  };
}

// Export logger instance for direct use
export { loggerMiddleware }; 