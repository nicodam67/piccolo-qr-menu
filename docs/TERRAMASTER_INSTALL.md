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
`caddy:2.11.4-alpine` ofrecen arquitectura `linux/amd64`, la del F4-424.

## Guía rápida para una primera instalación

No pulses **Apply** hasta disponer de autorización para desplegar. Los nombres
de los botones pueden aparecer traducidos, pero los campos son los mismos.

### 1. Preparar el paquete en el ordenador

Descarga o clona la rama aprobada de Piccolo y, desde su carpeta, crea el
archivo que se subirá al NAS:

```bash
git archive --format=tar.gz --output=piccolo-terramaster.tar.gz HEAD
```

El paquete debe contener `docker-compose.yml`, `Dockerfile`, `Caddyfile`,
`.dockerignore`, `.env.example`, `README.md`, `package.json`,
`package-lock.json`, `next.config.ts`, `src/`, `drizzle/`, `docker/` y `docs/`.
No añadas `.env`, `data/`, backups ni contraseñas al paquete.

### 2. Crear la carpeta en el NAS

1. Entra en TOS desde el navegador.
2. Abre **File Manager**.
3. En `Volume1`, crea la carpeta compartida `docker` si no existe.
4. Dentro de `docker`, crea una carpeta llamada `piccolo`.
5. La ruta resultante debe ser exactamente `/Volume1/docker/piccolo`.
6. En las propiedades de permisos, permite el acceso únicamente al
   administrador responsable. Esa carpeta contendrá la contraseña de la base,
   los datos de PostgreSQL y la clave privada de la CA local.

### 3. Subir y extraer el proyecto

1. Abre `/Volume1/docker/piccolo` en File Manager.
2. Sube `piccolo-terramaster.tar.gz`.
3. Selecciona el archivo y pulsa **Extract** en la carpeta actual.
4. Comprueba que
   `/Volume1/docker/piccolo/docker-compose.yml` existe. Si aparece otra carpeta
   `piccolo` dentro, mueve su contenido un nivel arriba.

### 4. Crear `.env`

En el ordenador, genera dos valores distintos:

```bash
openssl rand -hex 32
openssl rand -base64 48
```

Crea un archivo de texto llamado exactamente `.env` —sin extensión `.txt`— con
este contenido. Sustituye los dos textos entre `<...>`:

```dotenv
POSTGRES_DB=piccolo_qr_menu
POSTGRES_USER=piccolo
POSTGRES_PASSWORD=<PEGAR_AQUI_LA_PRIMERA_SALIDA>
AUTH_SECRET=<PEGAR_AQUI_LA_SEGUNDA_SALIDA>
AUTH_SESSION_TTL_SECONDS=28800
PICCOLO_SITE_ADDRESS=https://192.168.1.196
PICCOLO_HTTP_PORT=80
PICCOLO_HTTPS_PORT=443
```

No añadas comillas ni espacios alrededor de `=`. Sube `.env` a
`/Volume1/docker/piccolo/.env`. No lo guardes en Git. Si utilizas SSH, protégelo
con:

```bash
chmod 600 /Volume1/docker/piccolo/.env
```

### 5. Crear el proyecto en Docker Manager

1. Abre **Docker Manager**.
2. Abre **Projects** en el menú izquierdo y pulsa **Add** (`+`).
3. Introduce estos valores:

   | Campo | Valor exacto |
   | --- | --- |
   | Project name | `piccolo` |
   | Project path | `/Volume1/docker/piccolo` |
   | Configuration file source | `Local TNAS` |
   | Configuration file | `/Volume1/docker/piccolo/docker-compose.yml` |

4. Pulsa **Verify YAML**.
5. Confirma que la validación termina sin errores.
6. Comprueba que solo aparecen publicados `80/tcp` y `443/tcp`. Los puertos
   `3000` y `5432` deben seguir siendo internos.

### 6. Iniciar el proyecto

Con autorización de despliegue y backup disponible, pulsa **Apply**. Si Docker
Manager crea el proyecto detenido, selecciónalo y pulsa **Start**. La primera
construcción descarga las imágenes y puede tardar varios minutos. No cierres ni
apagues el NAS durante el proceso.

### 7. Comprobar que funciona

1. En **Projects**, abre `piccolo`.
2. Comprueba que `postgres`, `app` y `caddy` terminan en estado `healthy`.
3. Si alguno falla, abre **Log** para ese servicio. No pulses **Clean/Clear**.
4. Desde un equipo de la LAN, abre `https://192.168.1.196/es`.
5. Al principio el navegador advertirá que la CA local no es de confianza.
   Descarga
   `/Volume1/docker/piccolo/data/caddy-data/caddy/pki/authorities/local/root.crt`
   mediante File Manager e impórtalo como autoridad raíz en cada TPV y cliente.
6. Vuelve a abrir la URL y confirma que ya no aparece advertencia TLS.

### 8. Crear el administrador

La aplicación no guarda una contraseña administrativa predeterminada. Sigue el
procedimiento de [Alta inicial del administrador](#alta-inicial-del-administrador)
una sola vez después del primer arranque.

### 9. Qué carpetas no se deben borrar

No borres ni reemplaces:

```text
/Volume1/docker/piccolo/.env
/Volume1/docker/piccolo/data/postgres
/Volume1/docker/piccolo/data/caddy-data
/Volume1/docker/piccolo/data/caddy-config
```

Tampoco uses **Clean/Clear** en Docker Manager. Detener, iniciar, reconstruir o
recrear los contenedores no debe eliminar estas rutas.

### 10. Actualizar Piccolo

Sigue siempre el procedimiento de
[Actualizar sin perder datos](#actualizar-sin-perder-datos). Nunca copies
manualmente `data/postgres` mientras PostgreSQL esté funcionando.

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
Cada servicio conserva como máximo cinco archivos de log de 10 MB para evitar
llenar el almacenamiento del NAS. El SAI no sustituye las copias externas de
PostgreSQL.

## Actualizar sin perder datos

No actualices directamente sobre la única copia de los datos.

1. Crea la carpeta de backups desde File Manager:
   `/Volume1/docker/piccolo/backups`.
2. Con SSH, crea un backup lógico consistente:

   ```bash
   cd /Volume1/docker/piccolo
   docker compose exec -T postgres sh -c \
     'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
     > "backups/piccolo-$(date +%Y%m%d-%H%M%S).dump"
   ls -lh backups/
   ```

   Si TOS solo ofrece el binario clásico, sustituye `docker compose` por
   `docker-compose`. Confirma que el archivo `.dump` tiene tamaño mayor que
   cero y cópialo también fuera del NAS.
3. Prepara un nuevo `piccolo-terramaster.tar.gz` desde la versión aprobada.
4. Sube el paquete a `/Volume1/docker/piccolo` y extráelo sobre los archivos de
   aplicación existentes.
5. No reemplaces `.env` y no borres `data/` ni `backups/`.
6. En Docker Manager, selecciona `piccolo` y pulsa **Stop**.
7. Pulsa **Build** para reconstruir el proyecto con el nuevo código.
8. Pulsa **Start**. El entrypoint espera PostgreSQL y aplica únicamente las
   migraciones pendientes antes de iniciar Next.js.
9. Espera a que `postgres`, `app` y `caddy` estén `healthy`.
10. Comprueba `/es`, `/login` y una página de administración.

Si la actualización falla, conserva el backup y los logs, detén el proyecto y
no intentes restaurar ni ejecutar rollbacks manuales sin revisar primero la
migración que falló.

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
- La carpeta del proyecto debe estar restringida a administradores: contiene
  `.env`, PostgreSQL y la clave privada de la CA de Caddy.
- El repositorio no contiene un instalador Piccolo-Server anterior que pueda
  reutilizarse.
