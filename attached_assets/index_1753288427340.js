
const express = require("express");
const fs = require("fs");
const session = require("express-session");
const app = express();
const PORT = process.env.PORT || 3000;

const POEMA_FILE = "poema.json";
const CLAVE_SECRETA = "miclavesecreta123";

app.use(express.static("public"));
app.use(express.json());
app.use(session({
  secret: 'mi-session-secreta-789',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

if (!fs.existsSync(POEMA_FILE)) {
  fs.writeFileSync(POEMA_FILE, JSON.stringify([]));
}

app.get("/api/ultimo", (req, res) => {
  const versos = JSON.parse(fs.readFileSync(POEMA_FILE));
  const ultimoVerso = versos[versos.length - 1] || "";
  const palabras = ultimoVerso.trim().split(/\s+/);
  const ultima = palabras[palabras.length - 1] || "Comienza";
  res.json({ ultima });
});

app.post("/api/agregar", (req, res) => {
  const verso = req.body.verso?.trim();
  const autor = req.body.autor?.trim();
  if (!verso) return res.status(400).json({ error: "Verso vacío" });

  const versos = JSON.parse(fs.readFileSync(POEMA_FILE));
  const versoConAutor = autor ? `${autor}: ${verso}` : verso;
  versos.push(versoConAutor);
  fs.writeFileSync(POEMA_FILE, JSON.stringify(versos, null, 2));
  res.json({ ok: true });
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
    res.clearCookie('connect.sid'); // Clear the session cookie
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
  
  const versos = JSON.parse(fs.readFileSync(POEMA_FILE));
  res.json(versos);
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

  const versos = JSON.parse(fs.readFileSync(POEMA_FILE));
  res.send(`
    <html>
      <body>
        <pre>${versos.join("\n")}</pre>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("Servidor escuchando en puerto " + PORT);
});
