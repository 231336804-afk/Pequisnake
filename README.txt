SNAKE ARENA v3 — MÓVIL + INTERNET

QUÉ INCLUYE
- Juego desde Android, iPhone, tablet o computadora usando navegador.
- Joystick táctil en móvil.
- Botón TURBO táctil.
- Nombre y color personalizados.
- Salas privadas por código.
- Clasificación de la sala.
- Reconexión automática si se corta la conexión.
- Servidor WebSocket.
- Configuración lista para Render.

PRUEBA LOCAL
1. Instala Node.js.
2. Abre una terminal en esta carpeta.
3. Ejecuta: npm install
4. Ejecuta: npm start
5. Abre http://localhost:8080

PARA JUGAR DESDE DISTINTAS CASAS / INTERNET
Necesitas publicar este proyecto en un servicio Node.js que soporte WebSockets.

OPCIÓN PREPARADA: RENDER
1. Crea un repositorio en GitHub y sube TODO el contenido de esta carpeta.
2. En Render crea un "Web Service" conectado al repositorio.
3. Runtime: Node
4. Build Command: npm install
5. Start Command: npm start
6. Publica el servicio.
7. Render te dará una dirección HTTPS pública.
8. Comparte ese enlace con tu familia.
9. Todos escriben el mismo código de sala, por ejemplo: FAMILIA.
10. Cada jugador elige su nombre y color y pulsa "Entrar a la sala".

IMPORTANTE
- No necesitas abrir puertos de tu router cuando usas un hosting público.
- El servidor usa process.env.PORT y escucha en 0.0.0.0.
- Para Internet el navegador usa WSS automáticamente cuando la página está en HTTPS.
- Mantén una sola instancia del servidor para esta versión, porque las salas se guardan en memoria.
