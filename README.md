# PWA offline-first con CouchDB y PouchDB

Esta carpeta contiene una PWA simple para cargar registros de personal offline y sincronizarlos con Apache CouchDB cuando vuelve la conectividad.

## Componentes

- `index.html`: interfaz de carga.
- `app.js`: lógica PouchDB local + sincronización con CouchDB.
- `pouchdb.min.js`: PouchDB local, necesario para funcionamiento offline real.
- `manifest.json`: configuración PWA.
- `sw.js`: Service Worker para cache de app shell.
- `server.py`: servidor Flask para servir la PWA en la LAN.
- `config.example.js`: plantilla de configuración local.
- `config.local.js`: configuración privada local. No se versiona.
- `icon*.png`: íconos de la PWA.

## Preparar configuración local

Copiar la plantilla:

```powershell
cd C:\couchdb
Copy-Item .\config.example.js .\config.local.js
```

Editar `config.local.js` con los datos de tu CouchDB:

```js
window.APP_CONFIG = {
    couchdb: {
        protocol: "http",
        port: "5984",
        dbName: "personal",
        localDbName: "personal",
        username: "usuario_limitado",
        password: "password_local",
        hostCandidates: "auto"
    }
};
```

> `config.local.js` está en `.gitignore` porque puede contener credenciales locales.

## Puertos usados

- Flask/PWA: `8080`
- CouchDB: `5984`

## Ejecutar el servidor

Desde PowerShell:

```powershell
cd C:\couchdb
python .\server.py
```

El servidor debe mostrar algo equivalente a:

```txt
Running on http://127.0.0.1:8080
Running on http://192.168.0.169:8080
```

Si preferís usar Flask CLI:

```powershell
cd C:\couchdb
python -m flask --app server run --host 0.0.0.0 --port 8080
```

## Abrir la app

Desde la PC:

```txt
http://localhost:8080/index.html
```

Desde el celular, conectado a la misma WiFi:

```txt
http://192.168.0.169:8080/index.html
```

> Si cambia la IP WiFi de la PC, reemplazar `192.168.0.169` por la IP actual.

Para ver la IP actual:

```powershell
ipconfig
```

Buscar la IPv4 del adaptador `Wi-Fi`.

## Verificar CouchDB

Desde la PC:

```txt
http://localhost:5984/
```

Desde el celular:

```txt
http://192.168.0.169:5984/
```

Debe responder con JSON similar a:

```json
{
  "couchdb": "Welcome"
}
```

## Reglas de firewall necesarias en Windows

La red WiFi de Windows debe estar como **Privada**, no Pública.

Verificar:

```powershell
Get-NetConnectionProfile
```

Cambiar WiFi a privada si hace falta:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

Abrir CouchDB:

```powershell
New-NetFirewallRule `
  -DisplayName "Apache CouchDB 5984 LAN" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 5984 `
  -Profile Private
```

Abrir Flask/PWA:

```powershell
New-NetFirewallRule `
  -DisplayName "Flask PWA 8080 LAN" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 8080 `
  -Profile Private
```

## Configuración CORS sugerida en CouchDB

En `local.ini`:

```ini
[chttpd]
enable_cors = true

[cors]
origins = http://192.168.0.169:8080, http://localhost:8080, http://127.0.0.1:8080
credentials = true
methods = GET, PUT, POST, HEAD, DELETE
headers = accept, authorization, content-type, origin, referer
```

Después de modificar `local.ini`, reiniciar CouchDB.

## Flujo de prueba offline

1. Levantar CouchDB.
2. Levantar Flask con `python .\server.py`.
3. Abrir la app desde el celular.
4. Cargar un registro con conexión.
5. Cortar WiFi/datos del celular.
6. Cargar otro registro offline.
7. Reconectar.
8. Esperar sincronización.
9. Verificar en Fauxton la base `personal`.

> Fauxton puede requerir refrescar la vista para mostrar documentos nuevos. No es una interfaz realtime.

## Notas PWA

- En escritorio, la instalación como app es más confiable desde `localhost`.
- En celular, `http://192.168.x.x` puede funcionar para pruebas, pero no siempre permite instalación PWA completa porque no es HTTPS.
- Para producción o uso serio en móvil, servir con HTTPS.

## Buenas prácticas para publicar en GitHub

Este repositorio está pensado como ejemplo simple para aprender CouchDB + PouchDB + PWA offline-first.

Reglas aplicadas:

- no versionar credenciales reales;
- dejar configuración sensible en `config.local.js`;
- versionar solo `config.example.js`;
- ignorar `__pycache__`, `.env`, entornos virtuales y configuración local;
- servir PouchDB desde archivo local para que la app pueda iniciar offline;
- separar servidor (`server.py`) de la lógica frontend (`app.js`).

## Seguridad pendiente para producción

Aunque `config.local.js` no se suba a GitHub, recordá esto:

> Una PWA/frontend no puede ocultar secretos reales. Todo lo que llega al navegador puede ser inspeccionado por el usuario.

Para una app productiva:

- no usar credenciales admin en `app.js`;
- no usar credenciales admin en `config.local.js`;
- crear usuario limitado;
- revisar roles/permisos por base;
- servir por HTTPS;
- restringir CORS al origen real;
- considerar Flask como capa de autenticación/proxy.
