// Simplemente importamos nuestros componentes para que el compilador los incluya en el bundle final.
// El código dentro de ellos (customElements.define) se ejecutará al cargar el script.
import './components/Contador.comp';

console.log("Componentes cargados.");