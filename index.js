
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const POEMA_FILE = "poema.json";
const BACKUP_DIR = "backups";
const CLAVE_SECRETA = "miclavesecreta123";

// Crear directorio de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(session({
  secret: 'mi-session-secreta-789',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Función para crear backup con timestamp
function crearBackup() {
  try {
    if (fs.existsSync(POEMA_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `poema_backup_${timestamp}.json`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);
      
      const contenido = fs.readFileSync(POEMA_FILE, 'utf8');
      fs.writeFileSync(backupPath, contenido);
      console.log(`✅ Backup creado: ${backupFileName}`);
      
      // Limpiar backups antiguos (mantener solo los últimos 10)
      limpiarBackupsAntiguos();
    }
  } catch (error) {
    console.error('❌ Error creando backup:', error);
  }
}

// Función para limpiar backups antiguos
function limpiarBackupsAntiguos() {
  try {
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('poema_backup_'))
      .sort()
      .reverse(); // Más recientes primero
    
    if (archivos.length > 10) {
      const archivosAEliminar = archivos.slice(10);
      archivosAEliminar.forEach(archivo => {
        fs.unlinkSync(path.join(BACKUP_DIR, archivo));
        console.log(`🗑️ Backup antiguo eliminado: ${archivo}`);
      });
    }
  } catch (error) {
    console.error('❌ Error limpiando backups:', error);
  }
}

// Función segura para leer versos
function leerVersos() {
  try {
    if (!fs.existsSync(POEMA_FILE)) {
      fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
      return [];
    }
    
    const contenido = fs.readFileSync(POEMA_FILE, 'utf8');
    return JSON.parse(contenido);
  } catch (error) {
    console.error('❌ Error leyendo poema:', error);
    
    // Intentar recuperar desde backup más reciente
    try {
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('poema_backup_'))
        .sort()
        .reverse();
      
      if (backups.length > 0) {
        const backupMasReciente = path.join(BACKUP_DIR, backups[0]);
        const contenidoBackup = fs.readFileSync(backupMasReciente, 'utf8');
        const versos = JSON.parse(contenidoBackup);
        
        console.log(`🔄 Recuperado desde backup: ${backups[0]}`);
        fs.writeFileSync(POEMA_FILE, JSON.stringify(versos, null, 2));
        return versos;
      }
    } catch (backupError) {
      console.error('❌ Error recuperando backup:', backupError);
    }
    
    // Si todo falla, crear archivo vacío
    fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
    return [];
  }
}

// Función segura para escribir versos
function escribirVersos(versos) {
  try {
    // Crear backup antes de escribir
    crearBackup();
    
    // Escribir el archivo principal
    fs.writeFileSync(POEMA_FILE, JSON.stringify(versos, null, 2));
    console.log('✅ Poema actualizado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error escribiendo poema:', error);
    return false;
  }
}

// Inicializar archivo si no existe
if (!fs.existsSync(POEMA_FILE)) {
  fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
}

// API Endpoints
app.get("/api/ultimo", (req, res) => {
  try {
    const versos = leerVersos();
    const ultimoVerso = versos[versos.length - 1] || "";
    const palabras = ultimoVerso.trim().split(/\s+/);
    const ultima = palabras[palabras.length - 1] || "Comienza";
    res.json({ ultima });
  } catch (error) {
    console.error('❌ Error en /api/ultimo:', error);
    res.status(500).json({ error: "Error obteniendo última palabra" });
  }
});

app.post("/api/agregar", (req, res) => {
  try {
    const verso = req.body.verso?.trim();
    const autor = req.body.autor?.trim();
    
    if (!verso) {
      return res.status(400).json({ error: "Verso vacío" });
    }

    const versos = leerVersos();
    const versoConAutor = autor ? `${autor}: ${verso}` : verso;
    versos.push(versoConAutor);
    
    const exito = escribirVersos(versos);
    if (!exito) {
      return res.status(500).json({ error: "Error guardando verso" });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en /api/agregar:', error);
    res.status(500).json({ error: "Error agregando verso" });
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

// API endpoint para obtener poema completo (requiere autenticación)
app.get("/api/poema", (req, res) => {
  if (!req.session.isCreator) {
    return res.status(403).json({ error: "Acceso restringido" });
  }
  
  try {
    const versos = leerVersos();
    res.json(versos);
  } catch (error) {
    console.error('❌ Error en /api/poema:', error);
    res.status(500).json({ error: "Error obteniendo poema" });
  }
});

// Endpoint para obtener lista de backups (solo para creador)
app.get("/api/backups", (req, res) => {
  if (!req.session.isCreator) {
    return res.status(403).json({ error: "Acceso restringido" });
  }
  
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('poema_backup_'))
      .map(file => {
        const stat = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          nombre: file,
          fecha: stat.mtime,
          tamaño: stat.size
        };
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    res.json(backups);
  } catch (error) {
    console.error('❌ Error listando backups:', error);
    res.status(500).json({ error: "Error obteniendo backups" });
  }
});

// Ver poema completo (solo para creador logueado)
app.get("/poema", (req, res) => {
  if (!req.session.isCreator) {
    return res.status(403).send(`
      <html>
        <body>
          <h2>Acceso restringido</h2>
          <p>Solo la creadora puede ver el poema completo.</p>
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
            body { 
              font-family: "JetBrains Mono", monospace; 
              padding: 20px; 
              background: #f5f5f5;
            }
            pre { 
              white-space: pre-wrap; 
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .backup-info {
              font-size: 12px;
              color: #666;
              background: #e8f4f8;
              padding: 10px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Poema Completo</h1>
            <a href="/">Volver al inicio</a>
          </div>
          <div class="backup-info">
            📁 Backups automáticos activos | Total versos: ${versos.length}
          </div>
          <pre>${versos.join("\n")}</pre>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Error mostrando poema:', error);
    res.status(500).send("Error cargando poema");
  }
});

// Crear backup inicial al iniciar el servidor
setTimeout(() => {
  crearBackup();
  console.log('🚀 Sistema de backup inicializado');
}, 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎭 Servidor escuchando en puerto ${PORT}`);
  console.log(`📁 Sistema de backup configurado en: ${BACKUP_DIR}`);
});
