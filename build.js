import {
  compPlugin
} from "./plugin.ts";

console.log("Compilando el proyecto...");

// Usamos la API de Build de Bun
const build = {
  entrypoints: ['./src/index.ts'], // Punto de entrada
  outdir: './dist', // Carpeta de salida
  plugins: [compPlugin], // ¡Aquí usamos nuestro plugin!
  minify: true, // Minificar el código para producción
};

// Si estamos en modo watch, agregamos la configuración de watch
if (process.argv.includes('--watch')) {
  build.watch = {
    paths: ['./src/**/*.comp', './src/**/*.ts'] // Observar archivos .comp y .ts
  };
  console.log("Modo watch activado - observando cambios en archivos .comp y .ts");
}

// Ejecutar el build
const result = await Bun.build(build);

if (result.success) {
  console.log("¡Compilación completada con éxito!");
  console.log("Ficheros generados en ./dist");
} else {
  console.error("La compilación ha fallado:");
  console.error(result.logs);
}