
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as session from 'express-session';

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();
const CLAVE_SECRETA = "miclavesecreta123";

// Middleware
app.use(express.json());
app.use(session({
  secret: 'mi-session-secreta-789',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    secure: false
  }
}));

// Funciones helper para Firestore
async function leerVersos(): Promise<string[]> {
  try {
    const versosRef = db.collection('poema').orderBy('timestamp');
    const snapshot = await versosRef.get();
    
    if (snapshot.empty) {
      return [];
    }
    
    const versos: string[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      versos.push(data.verso);
    });
    
    return versos;
  } catch (error) {
    console.error('Error leyendo versos:', error);
    return [];
  }
}

async function escribirVerso(verso: string): Promise<boolean> {
  try {
    await db.collection('poema').add({
      verso: verso,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Crear backup en colección separada
    await db.collection('backups').add({
      verso: verso,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'verso_added'
    });
    
    return true;
  } catch (error) {
    console.error('Error escribiendo verso:', error);
    return false;
  }
}

// API Endpoints
app.get("/api/ultimo", async (req, res) => {
  try {
    const versos = await leerVersos();
    const ultimoVerso = versos[versos.length - 1] || "";
    const palabras = ultimoVerso.trim().split(/\s+/);
    const ultima = palabras[palabras.length - 1] || "Comienza";
    res.json({ ultima });
  } catch (error) {
    console.error('Error en /api/ultimo:', error);
    res.status(500).json({ error: "Error obteniendo última palabra" });
  }
});

app.post("/api/agregar", async (req, res) => {
  try {
    const verso = req.body.verso?.trim();
    const autor = req.body.autor?.trim();
    
    if (!verso) {
      return res.status(400).json({ error: "Verso vacío" });
    }

    const versoConAutor = autor ? `${autor}: ${verso}` : verso;
    const exito = await escribirVerso(versoConAutor);
    
    if (!exito) {
      return res.status(500).json({ error: "Error guardando verso" });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error en /api/agregar:', error);
    res.status(500).json({ error: "Error agregando verso" });
  }
});

// Endpoint para login
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === CLAVE_SECRETA) {
    (req.session as any).isCreator = true;
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
  res.json({ isLoggedIn: !!(req.session as any).isCreator });
});

// API endpoint para obtener poema completo (requiere autenticación)
app.get("/api/poema", async (req, res) => {
  if (!(req.session as any).isCreator) {
    return res.status(403).json({ error: "Acceso restringido" });
  }
  
  try {
    const versos = await leerVersos();
    res.json(versos);
  } catch (error) {
    console.error('Error en /api/poema:', error);
    res.status(500).json({ error: "Error obteniendo poema" });
  }
});

// Ver poema completo (solo para creador logueado)
app.get("/poema", async (req, res) => {
  if (!(req.session as any).isCreator) {
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
    const versos = await leerVersos();
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
            🔥 Firebase Firestore | Total versos: ${versos.length}
          </div>
          <pre>${versos.join("\n")}</pre>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error mostrando poema:', error);
    res.status(500).send("Error cargando poema");
  }
});

// Exportar la función
export const api = functions.https.onRequest(app);
