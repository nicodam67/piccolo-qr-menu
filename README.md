# Piccolo QR Menu

Entrega 1: prototipo visual público y mobile-first de la carta de Piccolo La
Ràpita.

## Ejecutar en local

Requisitos: Node.js 20.9 o superior y npm.

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). La ruta raíz redirige a
`/es`.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
```

## Alcance

Esta entrega usa exclusivamente datos e imágenes remotas de demostración
definidos en `src/features/public-menu/demo-data.ts`.

No contiene base de datos, administración, autenticación, almacenamiento S3,
publicación, pedidos ni integración con Piccolo TPV.
