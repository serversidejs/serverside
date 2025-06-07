import authBasic from '../../middlewares/auth-basic.js';

// Simulación de base de datos
const posts = [
  {
    id: 1,
    title: 'Primer Post',
    content: 'Contenido del primer post'
  },
  {
    id: 2,
    title: 'Segundo Post',
    content: 'Contenido del segundo post'
  }
];

export default class PostsAPI {
  // Middlewares globales y específicos por método
  getMiddlewares() {
    return {
      '*': [authBasic()],  // Se aplica a todos los métodos
      post: [authBasic()]  // Se aplica adicionalmente a POST
    };
  }

  async handleGET(data) {
    const { query } = data;
    
    // Obtener parámetros de paginación
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    
    // Calcular índices para la paginación
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Obtener posts paginados
    const paginatedPosts = posts.slice(startIndex, endIndex);
    
    return {
      posts: paginatedPosts,
      pagination: {
        total: posts.length,
        page,
        limit,
        pages: Math.ceil(posts.length / limit)
      }
    };
  }

//   async handlePOST(data) {
//     // Aquí iría la lógica para crear un nuevo post
//     return {
//       message: 'Post created successfully'
//     };
//   }
} 