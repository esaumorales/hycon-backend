export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Hycon API',
    version: '1.0.0',
    description: 'Documentación interactiva de la API para el backend de Hycon.',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Servidor Local de Desarrollo',
    },
  ],
  paths: {
    '/auth': {
      get: {
        tags: ['Auth'],
        summary: 'Verifica el estado de autenticación',
        responses: {
          '200': {
            description: 'Autenticación funcionando correctamente',
          },
        },
      },
    },
  },
};
