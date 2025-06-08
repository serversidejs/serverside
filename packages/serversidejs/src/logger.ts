import pino from 'pino';

class LoggerManager {

    logger = pino({
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      })
    
    use(logger: any) {
        this.logger = logger;
    }
      
}
const loggerManager = new LoggerManager();

export function useLogger(logg: any) {
    loggerManager.use(logg)
}

const logger = loggerManager.logger;

export { logger };