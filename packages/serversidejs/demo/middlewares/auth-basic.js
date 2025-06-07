export default function authBasic() {
  return async (req, next) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="Secure Area"'
        }
      });
    }

    // Decodificar las credenciales
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    // Aquí deberías validar las credenciales contra tu sistema
    // Por ahora usamos credenciales hardcodeadas
    if (username !== 'admin' || password !== 'admin') {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="Secure Area"'
        }
      });
    }

    // Si todo está bien, continuar con el siguiente middleware o el handler
    return next();
  };
} 