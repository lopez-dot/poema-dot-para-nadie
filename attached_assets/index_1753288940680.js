
const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLAVE_SECRETA = "miclavesecreta123";

// Configuración de archivos de respaldo
const POEMA_FILE = "poema.json";
const BACKUP_DIR = "backups";
const BACKUP_FILE_PREFIX = "poema_backup_";

// Crear directorio de respaldos si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// Inicializar archivo principal si no existe
if (!fs.existsSync(POEMA_FILE)) {
  fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
}

// Sistema de respaldo robusto
function crearRespaldo() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${BACKUP_FILE_PREFIX}${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    if (fs.existsSync(POEMA_FILE)) {
      const contenido = fs.readFileSync(POEMA_FILE, 'utf8');
      fs.writeFileSync(backupPath, contenido);
      console.log(`Respaldo creado: ${backupFileName}`);
    }
  } catch (error) {
    console.error('Error creando respaldo:', error);
  }
}

// Función segura para leer versos
function leerVersos() {
  try {
    const contenido = fs.readFileSync(POEMA_FILE, 'utf8');
    return JSON.parse(contenido);
  } catch (error) {
    console.error('Error leyendo archivo principal, intentando respaldo...');
    return recuperarDeRespaldo();
  }
}

// Función segura para escribir versos
function escribirVersos(versos) {
  try {
    // Crear respaldo antes de escribir
    crearRespaldo();
    
    // Escribir en archivo temporal primero
    const tempFile = POEMA_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(versos, null, 2));
    
    // Si todo va bien, renombrar el archivo temporal
    fs.renameSync(tempFile, POEMA_FILE);
    
    console.log('Versos guardados exitosamente');
    return true;
  } catch (error) {
    console.error('Error escribiendo versos:', error);
    return false;
  }
}

// Recuperar del respaldo más reciente
function recuperarDeRespaldo() {
  try {
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith(BACKUP_FILE_PREFIX))
      .sort()
      .reverse();
    
    if (archivos.length > 0) {
      const backupMasReciente = path.join(BACKUP_DIR, archivos[0]);
      const contenido = fs.readFileSync(backupMasReciente, 'utf8');
      const versos = JSON.parse(contenido);
      
      // Restaurar archivo principal
      fs.writeFileSync(POEMA_FILE, JSON.stringify(versos, null, 2));
      console.log(`Restaurado desde respaldo: ${archivos[0]}`);
      return versos;
    }
  } catch (error) {
    console.error('Error recuperando respaldo:', error);
  }
  
  // Si todo falla, crear archivo vacío
  console.log('Creando archivo nuevo vacío');
  fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
  return [];
}

// Limpiar respaldos antiguos (mantener solo los últimos 50)
function limpiarRespaldosAntiguos() {
  try {
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith(BACKUP_FILE_PREFIX))
      .sort()
      .reverse();
    
    if (archivos.length > 50) {
      const paraEliminar = archivos.slice(50);
      paraEliminar.forEach(archivo => {
        fs.unlinkSync(path.join(BACKUP_DIR, archivo));
      });
      console.log(`Eliminados ${paraEliminar.length} respaldos antiguos`);
    }
  } catch (error) {
    console.error('Error limpiando respaldos:', error);
  }
}

// Crear respaldo inicial y limpiar antiguos al iniciar
crearRespaldo();
limpiarRespaldosAntiguos();

// Crear respaldo cada 30 minutos
setInterval(() => {
  crearRespaldo();
  limpiarRespaldosAntiguos();
}, 30 * 60 * 1000);

app.use(express.static("public"));
app.use(express.json());
app.use(session({
  secret: 'mi-session-secreta-789',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Servir página principal
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/ultimo", (req, res) => {
  try {
    const versos = leerVersos();
    const ultimoVerso = versos[versos.length - 1] || "";
    const palabras = ultimoVerso.trim().split(/\s+/);
    const ultima = palabras[palabras.length - 1] || "Comienza";
    res.json({ ultima });
  } catch (error) {
    console.error("Error obteniendo último verso:", error);
    res.json({ ultima: "Comienza" });
  }
});

app.post("/api/agregar", (req, res) => {
  const verso = req.body.verso?.trim();
  const autor = req.body.autor?.trim();
  if (!verso) return res.status(400).json({ error: "Verso vacío" });

  try {
    const versos = leerVersos();
    const versoConAutor = autor ? `${autor}: ${verso}` : verso;
    versos.push(versoConAutor);
    
    const exito = escribirVersos(versos);
    if (exito) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: "Error guardando verso" });
    }
  } catch (error) {
    console.error("Error agregando verso:", error);
    res.status(500).json({ error: "Error guardando verso" });
  }
});

// Endpoint para login
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === CLAVE_SECRETA) {
    req.session.isCreator = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Contraseña incorrecta" });
  }
});

// Endpoint para logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Endpoint para verificar si está logueado
app.get("/api/status", (req, res) => {
  res.json({ isLoggedIn: !!req.session.isCreator });
});

// API endpoint to get complete poem (requires authentication)
app.get("/api/poema", (req, res) => {
  if (!req.session.isCreator) {
    return res.status(403).json({ error: "Acceso restringido" });
  }
  
  try {
    const versos = leerVersos();
    res.json(versos);
  } catch (error) {
    console.error("Error obteniendo poema:", error);
    res.status(500).json({ error: "Error obteniendo poema" });
  }
});

// Ver poema completo (solo para creador logueado)
app.get("/poema", (req, res) => {
  if (!req.session.isCreator) {
    return res.status(403).send(`
      <html>
        <body>
          <h2>Acceso restringido</h2>
          <p>Solo la artista puede ver el poema completo.</p>
        </body>
      </html>
    `);
  }

  try {
    const versos = leerVersos();
    res.send(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Poema Completo</title>
          <style>
            body { font-family: "JetBrains Mono", monospace; padding: 20px; }
            pre { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Poema Completo</h1>
          <pre>${versos.join("\n")}</pre>
          <a href="/">Volver al inicio</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error mostrando poema:", error);
    res.status(500).send("Error cargando poema");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor escuchando en puerto " + PORT);
  console.log("Sistema de respaldo activado - los versos están protegidos");
});
