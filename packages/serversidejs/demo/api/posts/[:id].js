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

export default class PostAPI {
  async handleGET(data) {
    const { params } = data;
    const postId = parseInt(params.id);
    
    // Buscar el post por ID
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return {
      post,
      timestamp: new Date().toISOString()
    };
  }
} 