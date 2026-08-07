# Despliegue oficial en TerraMaster F4-424

Esta guía prepara Piccolo para TOS 5.1, Docker Engine 20.10.17 y Docker
Manager 2.1.005. Los pasos de auditoría y validación no arrancan contenedores.
Pulsar **Apply** en Docker Manager sí crea y arranca el proyecto; hacerlo solo
durante la ventana de despliegue autorizada.

## Arquitectura

El proyecto contiene una sola aplicación Next.js; sus rutas web y API se sirven
desde el mismo proceso Node.js. El despliegue usa:

- `postgres`: PostgreSQL 16, accesible únicamente desde la red Docker interna;
- `app`: servidor Next.js en el puerto interno `3000`, sin puerto publicado;
- `caddy`: terminación HTTPS y único servicio accesible desde la LAN.

Caddy es necesario porque las cookies de administración son `Secure` en
producción. Usa una CA local persistente: cada TPV, tableta u ordenador cliente
debe confiar una vez en el certificado raíz de Caddy.

Al arrancar, `app` espera a PostgreSQL, aplica exclusivamente las migraciones
versionadas de `drizzle/` y después inicia Next.js. Nunca ejecuta el seed demo ni
crea o modifica administradores automáticamente.

## Compatibilidad

`docker-compose.yml` declara el formato `2.4`, compatible con Docker Engine
20.10.17 y con Compose clásico. No usa claves recientes de Compose Spec. El
formato 2.4 permite esperar los healthchecks mediante
`depends_on.condition: service_healthy`.

Las imágenes oficiales `node:22-bookworm-slim`, `postgres:16-bookworm` y
`caddy:2.10-alpine` ofrecen arquitectura `linux/amd64`, la del F4-424.

## Archivos de despliegue

Los siguientes archivos deben conservar juntos:

```text
docker-compose.yml
Dockerfile
Caddyfile
.dockerignore
.env.example
package.json
package-lock.json
next.config.ts
src/
drizzle/
docker/
```

La ruta recomendada en el primer volumen del NAS es:

```text
/Volume1/docker/piccolo
```

Si el volumen de datos principal tiene otro nombre, sustituye `Volume1` en
todos los pasos. Los datos persistentes quedan fuera de los contenedores:

```text
/Volume1/docker/piccolo/data/postgres
/Volume1/docker/piccolo/data/caddy-data
/Volume1/docker/piccolo/data/caddy-config
```

No borres `data/postgres`. No borres `data/caddy-data`: regeneraría la CA y
obligaría a reinstalar su certificado en todos los clientes.

## Preparar `.env`

En una terminal segura, dentro de una copia del repositorio:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -base64 48
```

Edita `.env` y rellena:

- `POSTGRES_PASSWORD`: primera salida, hexadecimal y segura para una URL;
- `AUTH_SECRET`: segunda salida, con al menos 32 bytes de entropía;
- `PICCOLO_SITE_ADDRESS`: `https://192.168.1.196` mientras esa sea la IP fija;
- `PICCOLO_HTTP_PORT`: `80`, salvo que el NAS ya lo use;
- `PICCOLO_HTTPS_PORT`: `443`, salvo que el NAS ya lo use;
- `POSTGRES_DB`, `POSTGRES_USER` y `AUTH_SESSION_TTL_SECONDS`: conservar los
  valores propuestos salvo decisión operativa distinta.

No dejes `POSTGRES_PASSWORD` ni `AUTH_SECRET` vacíos. No reutilices el valor de
desarrollo de `DATABASE_URL`. No subas `.env` a Git ni lo envíes por un canal
no seguro. Las variables `ADMIN_*` deben permanecer vacías; solo se facilitan
temporalmente al crear el administrador.

## Subir los archivos al NAS

1. En el equipo que contiene el repositorio validado, crea un paquete sin
   historial Git ni `.env`:

   ```bash
   git archive --format=tar.gz --output=piccolo-terramaster.tar.gz HEAD
   ```

2. En TOS, abre **File Manager** y crea la carpeta compartida `docker` si no
   existe.
3. Crea `docker/piccolo`, sube `piccolo-terramaster.tar.gz` y extráelo
   directamente dentro de esa carpeta. `docker-compose.yml` debe quedar en
   `/Volume1/docker/piccolo/docker-compose.yml`, no en una subcarpeta adicional.
4. Sube por separado el `.env` preparado a
   `/Volume1/docker/piccolo/.env`. El archivo no forma parte del paquete Git.
5. Comprueba en File Manager que `Dockerfile`, `Caddyfile`, `src/`, `drizzle/`
   y `docker/` están al mismo nivel que `docker-compose.yml`.

Como alternativa con SSH habilitado:

```bash
scp piccolo-terramaster.tar.gz usuario@192.168.1.196:/Volume1/docker/piccolo/
scp .env usuario@192.168.1.196:/Volume1/docker/piccolo/.env
ssh usuario@192.168.1.196 \
  'cd /Volume1/docker/piccolo && tar -xzf piccolo-terramaster.tar.gz'
```

Protege el entorno desde SSH si TOS respeta permisos POSIX:

```bash
chmod 600 /Volume1/docker/piccolo/.env
```

## Validar sin desplegar

Desde un equipo con Docker Compose, esta orden solo renderiza y valida la
configuración; no crea contenedores:

```bash
POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
AUTH_SECRET="$(openssl rand -base64 48)" \
docker compose -f docker-compose.yml config
```

En el NAS, Docker Manager también permite **Verify YAML** antes de **Apply**.
Detente después de la verificación si todavía no hay autorización para
desplegar.

## Crear el proyecto en Docker Manager

Estos pasos son para la ventana de despliegue autorizada:

1. Abre **Docker Manager** en TOS.
2. En el menú izquierdo, abre **Projects** y pulsa **Add** (`+`).
3. Escribe `piccolo` como nombre del proyecto.
4. Selecciona `/Volume1/docker/piccolo` como **Project path**.
5. En **Configuration file**, elige **Local TNAS** y selecciona
   `/Volume1/docker/piccolo/docker-compose.yml`.
6. Pulsa **Verify YAML**. No continúes si muestra advertencias o claves
   incompatibles.
7. Revisa que los únicos puertos publicados sean TCP `80` y `443`, o los
   alternativos definidos en `.env`. PostgreSQL `5432` y Node `3000` no deben
   aparecer publicados.
8. Cuando exista autorización y copia de seguridad, pulsa **Apply**. Docker
   Manager descargará las imágenes, construirá `app` y arrancará en orden
   `postgres` → `app` → `caddy`.
9. Comprueba en **Projects** que los tres servicios estén `healthy`. Si alguno
   falla, abre su pestaña **Log**; no uses **Clean**.

## Alta inicial del administrador

Solo para una base nueva y después del primer arranque. Desde SSH, evita
guardar la contraseña en `.env`:

```bash
cd /Volume1/docker/piccolo
read -r -p "Email administrador: " ADMIN_EMAIL
read -r -p "Nombre completo: " ADMIN_FULL_NAME
read -r -s -p "Contraseña (mínimo 12 caracteres): " ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_FULL_NAME ADMIN_PASSWORD
docker compose run --rm \
  -e ADMIN_EMAIL -e ADMIN_FULL_NAME -e ADMIN_PASSWORD \
  app node /app/create-admin.cjs
unset ADMIN_EMAIL ADMIN_FULL_NAME ADMIN_PASSWORD
```

Si TOS solo ofrece el binario clásico, sustituye `docker compose` por
`docker-compose`. El comando no ejecuta el seed demo. Si el email ya existe,
termina sin modificarlo.

## Confiar en la CA de Caddy

Después del primer arranque, extrae el certificado raíz:

```bash
cd /Volume1/docker/piccolo
CADDY_ID="$(docker compose ps -q caddy)"
docker cp \
  "${CADDY_ID}:/data/caddy/pki/authorities/local/root.crt" \
  ./piccolo-caddy-root.crt
```

Importa `piccolo-caddy-root.crt` como autoridad raíz de confianza en cada TPV y
cliente. Después abre `https://192.168.1.196/es` y confirma que no aparece una
advertencia TLS. El procedimiento de importación depende del sistema operativo
del TPV; es un requisito previo bloqueante para usar el panel administrativo.

## Puertos, persistencia y operación

| Uso | Puerto LAN | Publicado |
| --- | ---: | --- |
| Redirección HTTP a HTTPS | `80/tcp` | Sí |
| Piccolo HTTPS | `443/tcp` | Sí |
| Next.js | `3000/tcp` | No, solo red Docker |
| PostgreSQL | `5432/tcp` | No, solo red Docker interna |

Los tres servicios tienen `restart: unless-stopped` y healthchecks. La base de
datos recibe hasta un minuto para finalizar limpiamente, complementando el SAI.
El SAI no sustituye las copias externas de PostgreSQL.

Antes de actualizar, realiza y verifica una copia `pg_dump`. En Docker Manager
no uses **Clean/Clear**: según la versión puede borrar recursos y datos del
proyecto. Aunque los bind mounts de esta configuración sobreviven a
`docker compose down -v`, una eliminación manual de `data/` no es recuperable
sin backup.

## Riesgos y bloqueantes

- La IP `192.168.1.196` debe ser fija o reservada por DHCP.
- Los clientes deben confiar en la CA de Caddy; de otro modo HTTPS mostrará un
  error y el login administrativo no será operativo de forma segura.
- Los puertos `80` y `443` deben estar libres. Si TOS los ocupa, define puertos
  LAN alternativos en `.env` y añade el puerto a la URL usada por los clientes.
- El NAS necesita salida HTTPS a Docker Hub y npm durante la primera
  construcción.
- Las imágenes de platos actuales son remotas; `app` necesita salida HTTPS a
  `images.unsplash.com` para optimizarlas.
- Antes de conectar una base preexistente, hay que identificar su versión y
  obtener un backup verificado. El arranque aplica migraciones pendientes.
- El repositorio no contiene un instalador Piccolo-Server anterior que pueda
  reutilizarse.
