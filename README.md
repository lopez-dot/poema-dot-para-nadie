
# Poema para Nadie - Firebase Version

Este proyecto ha sido adaptado para funcionar completamente en Firebase (Hosting + Functions + Firestore).

## Requisitos previos

1. Node.js (versión 18 o superior)
2. Firebase CLI: `npm install -g firebase-tools`
3. Cuenta de Firebase (gratuita)

## Configuración inicial

1. Crear un proyecto en Firebase Console (https://console.firebase.google.com)
2. Habilitar Firestore Database
3. Inicializar Firebase en tu proyecto:

```bash
firebase login
firebase init
```

Al ejecutar `firebase init`, selecciona:
- Firestore: Configure Firestore security rules and indexes files
- Functions: Configure Cloud Functions for Firebase
- Hosting: Configure files for Firebase Hosting

## Instalación y despliegue

1. Instalar dependencias de las funciones:
```bash
cd functions
npm install
cd ..
```

2. Compilar las funciones:
```bash
cd functions
npm run build
cd ..
```

3. Desplegar todo el proyecto:
```bash
firebase deploy
```

## Estructura del proyecto

- `public/` - Archivos estáticos (HTML, CSS, imágenes)
- `functions/` - Cloud Functions (lógica del servidor)
- `firestore.rules` - Reglas de seguridad de Firestore
- `firebase.json` - Configuración de Firebase

## Características

- ✅ Backup automático en Firestore
- ✅ Escalabilidad automática 
- ✅ SSL gratuito
- ✅ CDN global
- ✅ Sin servidor que gestionar
- ✅ Base de datos en tiempo real

## Notas importantes

- La clave secreta está hardcodeada en `functions/src/index.ts` (línea 12)
- Los datos se almacenan en Firestore, no en archivos locales
- Las imágenes y videos deben estar en la carpeta `public/`
- Firebase maneja automáticamente el escalado y la disponibilidad

## Desarrollo local

Para probar localmente:
```bash
firebase emulators:start
```

Esto iniciará emuladores locales para Functions, Firestore y Hosting.
