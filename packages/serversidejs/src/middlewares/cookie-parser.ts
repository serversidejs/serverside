import { parseCookiesFromHeader } from "../http";

export default function cookieParser() {
    return async (req: Request, next) => {
      const cookieHeader = req.headers.get('cookie');
      
      const cookies = parseCookiesFromHeader(cookieHeader);
  
      req.cookies = cookies;
      return next();
    };
  } 