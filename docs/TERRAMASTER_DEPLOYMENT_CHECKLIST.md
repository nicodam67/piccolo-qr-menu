# Checklist de despliegue real en TerraMaster F4-424

Usa esta lista antes, durante y después del despliegue autorizado. No pulses
**Apply** en Docker Manager hasta completar las comprobaciones previas.

Ruta base del proyecto en el NAS:

```text
/Volume1/docker/piccolo
```

## □ Carpetas

- [ ] Existe la carpeta compartida `/Volume1/docker`.
- [ ] Existe la carpeta del proyecto `/Volume1/docker/piccolo`.
- [ ] El archivo `/Volume1/docker/piccolo/docker-compose.yml` está en la raíz del proyecto, no dentro de una subcarpeta extra.
- [ ] Existen o se crearán automáticamente al primer arranque:
  - [ ] `/Volume1/docker/piccolo/data/postgres`
  - [ ] `/Volume1/docker/piccolo/data/caddy-data`
  - [ ] `/Volume1/docker/piccolo/data/caddy-config`
- [ ] Existe la carpeta de backups `/Volume1/docker/piccolo/backups`.
- [ ] No hay rutas de Windows (`C:\`) ni rutas de escritorio Linux (`/home/...`) en los archivos del proyecto.

## □ Permisos

- [ ] Solo administradores del NAS pueden leer y escribir `/Volume1/docker/piccolo`.
- [ ] El archivo `/Volume1/docker/piccolo/.env` no es visible para usuarios normales.
- [ ] Si usas SSH, el `.env` tiene permisos `600`.
- [ ] Nadie compartió `.env`, contraseñas ni certificados por correo o chat.
- [ ] La carpeta `data/` no se copia manualmente mientras PostgreSQL está en ejecución.

## □ Variables `.env`

- [ ] Se creó `/Volume1/docker/piccolo/.env` a partir de `.env.example`.
- [ ] `POSTGRES_PASSWORD` está rellena con un valor aleatorio seguro.
- [ ] `AUTH_SECRET` está rellena con al menos 32 bytes de entropía.
- [ ] `POSTGRES_DB=piccolo_qr_menu`.
- [ ] `POSTGRES_USER=piccolo`.
- [ ] `PICCOLO_SITE_ADDRESS=https://192.168.1.196` o la IP/nombre DNS final del NAS.
- [ ] `PICCOLO_HTTP_PORT=80` y `PICCOLO_HTTPS_PORT=443`, salvo que el NAS ya use esos puertos.
- [ ] `AUTH_SESSION_TTL_SECONDS=28800` o el valor operativo acordado.
- [ ] Las variables `ADMIN_*` están vacías en `.env` permanente.
- [ ] No se versionó ni subió `.env` al repositorio.

## □ PostgreSQL

- [ ] El servicio `postgres` usa la imagen `postgres:16-bookworm`.
- [ ] La persistencia apunta a `./data/postgres:/var/lib/postgresql/data`.
- [ ] El puerto `5432` no está publicado en la LAN.
- [ ] `POSTGRES_PASSWORD` del `.env` coincide con la usada por `DATABASE_URL` del servicio `app`.
- [ ] Existe un backup inicial antes del primer despliegue real o antes de conectar una base preexistente.
- [ ] Si la base ya existía, se identificó su versión y se verificó el backup antes de arrancar.

## □ Caddy

- [ ] El servicio `caddy` usa la imagen `caddy:2.11.4-alpine`.
- [ ] El archivo `Caddyfile` está montado desde `./Caddyfile`.
- [ ] `PICCOLO_SITE_ADDRESS` coincide con la URL que usarán los clientes.
- [ ] Los volúmenes `./data/caddy-data` y `./data/caddy-config` existirán de forma persistente.
- [ ] Solo `caddy` publica puertos `80` y `443` hacia la LAN.
- [ ] Se planificó la distribución del certificado raíz de Caddy a todos los TPV y clientes.

## □ Healthchecks

- [ ] `postgres` usa `pg_isready`.
- [ ] `app` consulta `http://127.0.0.1:3000/api/health`.
- [ ] `caddy` consulta su API local en el puerto `2019`.
- [ ] `app` espera a `postgres` con `condition: service_healthy`.
- [ ] `caddy` espera a `app` con `condition: service_healthy`.
- [ ] Los tres servicios tienen `restart: unless-stopped`.

## □ HTTPS

- [ ] La IP `192.168.1.196` está fija o reservada por DHCP.
- [ ] Los puertos `80` y `443` están libres en el NAS.
- [ ] Tras el primer arranque, se extrae `data/caddy-data/caddy/pki/authorities/local/root.crt`.
- [ ] Cada TPV, tableta u ordenador cliente confía en ese certificado raíz.
- [ ] `https://192.168.1.196/es` abre sin advertencia TLS.
- [ ] `https://192.168.1.196/login` abre sin advertencia TLS.

## □ Backups

- [ ] Existe `/Volume1/docker/piccolo/backups`.
- [ ] Se ha probado un backup lógico con:

  ```bash
  cd /Volume1/docker/piccolo
  docker compose exec -T postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
    > "backups/piccolo-$(date +%Y%m%d-%H%M%S).dump"
  ```

- [ ] El archivo `.dump` tiene tamaño mayor que cero.
- [ ] Hay una copia del backup fuera del NAS.
- [ ] El SAI del NAS está activo, pero no se considera sustituto del backup externo.

## □ Restauración

- [ ] Se conoce el procedimiento de restauración antes de tocar producción.
- [ ] Para restaurar, primero se detiene el proyecto en Docker Manager.
- [ ] La restauración se hará solo con un backup verificado y con autorización explícita.
- [ ] No se usará **Clean/Clear** en Docker Manager durante una restauración.
- [ ] No se borrará manualmente `data/postgres` sin backup válido.

## □ Actualización segura

- [ ] Antes de actualizar, se crea un backup `pg_dump` verificado.
- [ ] Se genera un nuevo paquete con `deploy/build-terramaster-package.sh`.
- [ ] El paquete se extrae sobre `/Volume1/docker/piccolo` sin reemplazar `.env`.
- [ ] No se borran `data/` ni `backups/`.
- [ ] En Docker Manager: **Stop** → **Build** → **Start**.
- [ ] Tras actualizar, los tres servicios vuelven a `healthy`.
- [ ] Se comprueban `/es`, `/login` y una página de administración.

## □ Verificación final

- [ ] Docker Manager muestra `postgres`, `app` y `caddy` en estado `healthy`.
- [ ] La carta pública responde en `https://192.168.1.196/es`.
- [ ] El login administrativo funciona en `https://192.168.1.196/login`.
- [ ] No aparecen publicados los puertos `3000` ni `5432`.
- [ ] Los logs no muestran errores de migración ni de conexión a PostgreSQL.
- [ ] Se creó el administrador inicial con el procedimiento documentado.
- [ ] Quedó registrada la fecha del despliegue, la versión desplegada y la ruta del backup inicial.

## Validación previa sin despliegue

Antes de **Apply**, valida solo la configuración:

```bash
POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
AUTH_SECRET="$(openssl rand -base64 48)" \
docker compose -f docker-compose.yml config
```

En Docker Manager, usa **Verify YAML** y detente si aparece cualquier error.

## Paquete listo para copiar

Genera el paquete desde la rama aprobada:

```bash
chmod +x deploy/build-terramaster-package.sh
./deploy/build-terramaster-package.sh
```

El resultado quedará en:

```text
deploy/dist/piccolo-terramaster-deploy.tar.gz
```

Extrae ese archivo directamente dentro de `/Volume1/docker/piccolo` y sube por
separado el `.env` real.
