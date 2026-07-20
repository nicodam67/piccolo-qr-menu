# Piccolo QR Menu

Entrega 4: carta pública conectada a PostgreSQL y panel de administración
protegido mediante sesión segura.

## Ejecutar en local

Requisitos: Node.js 20.9 o superior, npm y PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run db:admin:create
npm run dev
```

Antes de migrar, crea una base PostgreSQL vacía y adapta `DATABASE_URL` en
`.env` a sus credenciales reales. Configura también `AUTH_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_FULL_NAME`. `AUTH_SECRET` debe tener
como mínimo 32 bytes de entropía aleatoria. Genéralo con:

```bash
openssl rand -base64 48
```

Abrir [http://localhost:3000](http://localhost:3000). La ruta raíz redirige a
`/es`.

## Base de datos

```bash
# Generar una nueva migración después de modificar el esquema
npm run db:generate

# Aplicar migraciones pendientes
npm run db:migrate

# Insertar o actualizar exclusivamente los datos demo
npm run db:seed
```

El seed es idempotente, usa identificadores reservados y está marcado como
demostrativo. Está destinado únicamente a desarrollo y no debe ejecutarse
contra una base de datos de producción.

Con `NODE_ENV=production`, el comando se bloquea antes de abrir una conexión.
Solo una autorización excepcional y explícita permite ejecutarlo:

```bash
NODE_ENV=production ALLOW_DEMO_SEED=true npm run db:seed
```

No configures `ALLOW_DEMO_SEED=true` de forma permanente. Los datos del seed no
son información oficial de Piccolo La Ràpita.

## Administrador y sesiones

`npm run db:admin:create` crea el administrador configurado en las variables
`ADMIN_*` únicamente si el email todavía no existe. Si ya existe, el comando
termina sin modificar datos.

Para cambiar explícitamente el nombre y la contraseña de una cuenta activa:

```bash
ADMIN_UPDATE_EXISTING=true npm run db:admin:create
```

La actualización mantiene `is_active`, incrementa `session_version` e invalida
inmediatamente todas las sesiones anteriores. Una cuenta inactiva nunca se
reactiva mediante este comando.

La contraseña se transforma con Argon2id y nunca se almacena en texto plano.
`ADMIN_PASSWORD` solo debe existir durante la creación o actualización del
administrador: elimínala del `.env` al terminar y nunca la mantengas como
credencial permanente.

La sesión utiliza una cookie `httpOnly`, `SameSite=Lax`, marcada como `Secure`
en producción. `AUTH_SESSION_TTL_SECONDS` controla su duración y admite valores
entre 300 y 604800 segundos. Cada carga servidor de `/admin` confirma en
PostgreSQL que la cuenta siga activa y que `session_version` coincida.

El login admite cinco intentos fallidos por combinación de email e IP dentro de
una ventana de quince minutos. Un acceso correcto elimina el contador.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
```

## Alcance

La página `/es` continúa consultando PostgreSQL mediante
`src/features/public-menu/repository.ts`. `/admin` requiere iniciar sesión en
`/login`. Las imágenes siguen siendo remotas y temporales.

`/admin/categories` permite crear, traducir, editar, activar, reordenar y
eliminar categorías vacías utilizando exclusivamente `categories` y
`category_translations`. Icono, color e imagen están excluidos porque no existen
en el esquema y no se autorizó una migración.

`/admin/menu-settings` configura qué datos aparecen en la carta pública y el
layout de lista o tarjetas. La configuración se guarda en
`restaurant_settings.menu_display_settings`. La aplicación valida el JSON con
Zod y aplica defaults seguros si la columna es `NULL`, está incompleta o
contiene propiedades desconocidas.

La carta pública filtra los productos en memoria por nombre y descripción,
muestra contadores por categoría y mantiene una navegación horizontal sticky.
La última categoría y posición se conservan en `sessionStorage` durante treinta
minutos para navegación de retorno; no se utilizan cookies ni persistencia en
PostgreSQL.

Cada producto visible dispone de una ficha en
`/{locale}/producto/{uuid}-{slug}`. El UUID identifica el registro y el slug es
decorativo, por lo que enlaces antiguos siguen funcionando. Configura
`NEXT_PUBLIC_SITE_URL` con el dominio canónico de producción para Open Graph,
Twitter Card, JSON-LD y enlaces absolutos.

La ficha reutiliza la configuración visual de la carta, variantes de imagen,
etiquetas y alérgenos activos. Incluye ampliación accesible, compartir mediante
Web Share o portapapeles y hasta cuatro productos relacionados de la misma
categoría, obtenidos sin consultas N+1.

`/admin/products` gestiona productos, traducciones, precios, categoría,
visibilidad, agotados, orden, URL de imagen existente, etiquetas y alérgenos
reutilizando exclusivamente las tablas actuales.

## Imágenes de productos

El editor acepta JPG, JPEG, PNG y WEBP de hasta 10 MB. Cada subida elimina
metadatos, convierte a WEBP y genera variantes móvil (640 px) y escritorio
(1440 px). PostgreSQL conserva únicamente la URL de escritorio en el campo
`products.image_url`; la variante móvil se deriva del mismo nombre.

`IMAGE_STORAGE_DRIVER=local` está destinado a desarrollo y guarda archivos en
`.data/uploads`. En producción configura `IMAGE_STORAGE_DRIVER=s3` junto con
bucket, región y `IMAGE_PUBLIC_BASE_URL`; endpoint y credenciales explícitas son
opcionales para proveedores S3-compatible.

`/admin/allergens` y `/admin/tags` gestionan traducciones, visibilidad y orden.
Los elementos inactivos conservan sus asociaciones y siguen apareciendo al
editar productos ya relacionados, pero no se muestran en la carta pública. La
migración `0003_good_vin_gonzales.sql` añade únicamente `is_active` y
`sort_order` a ambas tablas.

`/admin/branding` permite editar identidad, contacto, portada y horarios con una
vista previa en tiempo real. Utiliza `restaurant_settings`,
`restaurant_translations` y `opening_hours` sin duplicar datos.

Email, ciudad, código postal, provincia, país, redes sociales, logotipo, colores
e imágenes adicionales están excluidos porque no existen en el esquema.

## Código QR de la carta

`/admin/qr-code` genera el QR oficial para `NEXT_PUBLIC_SITE_URL/{locale}` usando
únicamente locales activados y publicados en `restaurant_locales`.
Configura `NEXT_PUBLIC_SITE_URL` con un origen absoluto de producción y sin el
locale final. Si falta, la interfaz muestra una advertencia y utiliza el origen
actual solo como vista temporal.

El QR se genera íntegramente en el navegador. Permite tamaño, margen, corrección
M/Q/H, colores con contraste validado, fondo blanco/transparente, formato
vertical/cuadrado y textos opcionales. Descarga PNG o SVG en 512, 1024 y 2048 px
e imprime una plantilla A4 mediante el diálogo normal del navegador.

La personalización no se persiste porque no existe un campo específico y
`menu_display_settings` pertenece a la carta. Una futura persistencia requeriría
autorización para una columna JSONB `qr_settings` o una tabla de presets. La ruta
anterior `/admin/qr` redirige por compatibilidad. Comprueba siempre el código
con un teléfono antes de imprimir muchas copias.

## Carta imprimible

`/admin/print-menu` genera una carta A4 desde los mismos datos públicos
traducidos de PostgreSQL. Permite orientación, una/dos columnas, tamaño,
densidad y visibilidad temporal de descripciones, taxonomías, media ración,
agotados, contacto, eslogan y QR. El diálogo del navegador permite imprimir o
guardar como PDF; no se genera ningún archivo en el servidor.

Las preferencias no se persisten porque son distintas de
`menu_display_settings`. Las alternativas futuras son una columna JSONB
`print_menu_settings` o una tabla de plantillas imprimibles.

## Categorías jerárquicas

`categories.parent_category_id` permite una categoría principal y un único
nivel de subcategorías. La clave foránea autorreferencial usa
`ON DELETE RESTRICT`; el servidor rechaza padres inexistentes,
autorreferencias, ciclos y terceros niveles. El orden es consecutivo e
independiente entre categorías principales y entre las subcategorías de cada
padre.

Los datos existentes permanecen como categorías principales (`NULL`) y los
productos conservan exclusivamente `products.category_id`. La carta pública,
la ficha de producto y `/admin/print-menu` comparten la misma utilidad de
jerarquía.

No contiene PDF generado en servidor, variantes, extras, combos, pedidos ni
integración con Piccolo TPV.

## Idiomas y publicación

`/admin/languages` administra los idiomas soportados desde una única
configuración en `src/config/locales.ts`: español, catalán, inglés, rumano,
francés, alemán, neerlandés (`nl`), euskera e italiano. Añadir un idioma futuro
requiere una entrada en esa configuración y sus copias UI, no cambios repartidos
por carta, SEO o QR.

`restaurant_locales` diferencia cuatro conceptos:

- **Soportado:** existe en la configuración de aplicación.
- **Activado:** puede prepararse en administración.
- **Publicado:** es accesible públicamente.
- **Principal:** coincide con `restaurant_settings.default_locale`.

Un idioma publicado debe estar activado. El principal no puede desactivarse ni
despublicarse y solo puede cambiarse hacia un idioma completo y publicado.

La cobertura suma un elemento por nombre del restaurante, categoría visible,
producto visible, descripción obligatoria, etiqueta activa utilizada y alérgeno
activo utilizado. Las descripciones solo son obligatorias si el texto principal
existe y la carta las muestra. El porcentaje usa
`floor(traducidos / obligatorios × 100)` salvo cobertura exacta, evitando mostrar
100 % para contenido incompleto.

No existe fallback parcial silencioso: solo se publica contenido obligatorio
completo; campos opcionales sin traducción se omiten. Locales no publicados
devuelven not-found. El selector, canonical, `hreflang`, `x-default`, Open Graph,
detalle de producto y `/admin/qr` consumen únicamente idiomas publicados.

Consultas aproximadas y constantes:

- Listado y cobertura: 7 consultas agrupadas.
- Editor de un idioma: reutiliza esas mismas 7 consultas.
- Carta pública: 6 consultas, independientemente del número de productos.
- Detalle de producto: 5 consultas agrupadas.

No se implementa traducción automática ni se envían textos a servicios externos.

## Horarios especiales

`/admin/special-hours` gestiona cierres y aperturas excepcionales por fecha. Una
excepción sustituye completamente a `opening_hours` para ese día y también se
considera desde el día siguiente cuando un turno cruza medianoche. Se consultan
solo la fecha anterior, la actual y los siete días siguientes.

Cada excepción tiene un tipo explícito: `open` (apertura extraordinaria),
`closed` (cierre completo) o `special` (horario modificado). El panel ofrece
calendario mensual, filtro por fecha, duplicación y CRUD. La consulta
administrativa queda limitada al mes visible mediante el índice existente de
restaurante y fecha. La carta imprimible reutiliza el mismo estado calculado
que la cabecera pública.

Los motivos son texto plano opcional. No existen festivos automáticos,
recurrencias ni calendarios externos. JSON-LD conserva el horario semanal:
Schema.org no permite representar de forma inequívoca todas las excepciones
fechadas sin convertirlas en reglas recurrentes falsas.

## Reservas online

`/[locale]/reservas` permite solicitar una reserva únicamente cuando el módulo
está activado y correctamente configurado en
`/admin/reservation-settings`. La disponibilidad combina horario semanal,
excepciones, antelación, duración, capacidad y ocupación real. La inserción
vuelve a comprobar la franja dentro de una transacción y utiliza idempotencia.

`/admin/reservations` permite filtrar, crear reservas manuales, editar datos y
aplicar transiciones de estado sin eliminar el historial. No incluye mesas,
pagos, depósitos, lista de espera ni comunicaciones automáticas.

Las reservas contienen datos personales. Antes de producción es obligatorio
definir y publicar una política real de privacidad, plazos de conservación,
base jurídica y procedimiento de atención de derechos. No deben copiarse datos
personales a logs, URLs ni sistemas externos no autorizados.
