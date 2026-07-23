const APP_CONFIG = window.APP_CONFIG || {};
const COUCHDB_CONFIG = APP_CONFIG.couchdb || {};
const COUCHDB_PROTOCOL = COUCHDB_CONFIG.protocol || "http";
const COUCHDB_USER = COUCHDB_CONFIG.username || "";
const COUCHDB_PASSWORD = COUCHDB_CONFIG.password || "";
const COUCHDB_PORT = COUCHDB_CONFIG.port || "5984";
const COUCHDB_DB_NAME = COUCHDB_CONFIG.dbName || "personal";
const LOCAL_DB_NAME = COUCHDB_CONFIG.localDbName || "personal";
const COUCHDB_HOST_CANDIDATES = COUCHDB_CONFIG.hostCandidates || "auto";

const estado = document.getElementById("estado");
const contador = document.getElementById("contador");
const listaPersonas = document.getElementById("listaPersonas");
const formPersona = document.getElementById("formPersona");

let dbLocal = null;
let dbRemota = null;
let syncHandler = null;
let syncEnCurso = false;
let retryTimer = null;

function setEstado(mensaje) {
    estado.textContent = mensaje;
}

function assertPouchDbDisponible() {
    if (!window.PouchDB) {
        throw new Error("PouchDB no está disponible. Revisá que /pouchdb.min.js se esté sirviendo correctamente.");
    }
}

function esMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function crearUrlCouchDb(hostname) {
    const credenciales = COUCHDB_USER
        ? `${encodeURIComponent(COUCHDB_USER)}:${encodeURIComponent(COUCHDB_PASSWORD)}@`
        : "";

    return `${COUCHDB_PROTOCOL}://${credenciales}${hostname}:${COUCHDB_PORT}/${COUCHDB_DB_NAME}`;
}

function obtenerCandidatosRemotos() {
    if (Array.isArray(COUCHDB_HOST_CANDIDATES)) {
        return COUCHDB_HOST_CANDIDATES.map(crearUrlCouchDb);
    }

    const hostActual = window.location.hostname || "127.0.0.1";
    const candidatos = [hostActual];

    if (!esMobile()) {
        candidatos.push("127.0.0.1", "localhost");
    }

    return [...new Set(candidatos)].map(crearUrlCouchDb);
}

async function seleccionarDbRemota() {
    const candidatos = obtenerCandidatosRemotos();
    let ultimoError = null;

    for (const url of candidatos) {
        const candidata = new PouchDB(url, { skip_setup: false });

        try {
            await candidata.info();
            return candidata;
        } catch (error) {
            ultimoError = error;
        }
    }

    throw ultimoError || new Error("No hay endpoints remotos configurados.");
}

function normalizarDni(dni) {
    return dni.trim().replace(/\D/g, "");
}

function crearIdPersona(dni) {
    return `persona:${dni}`;
}

function crearDeviceId() {
    const key = "personal_device_id";
    const existente = localStorage.getItem(key);

    if (existente) {
        return existente;
    }

    const nuevo = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, nuevo);
    return nuevo;
}

const deviceId = crearDeviceId();

async function guardarPersona({ nombre, apellido, dni }) {
    const dniNormalizado = normalizarDni(dni);

    if (!dniNormalizado) {
        throw new Error("El DNI debe contener números.");
    }

    const ahora = new Date().toISOString();
    const _id = crearIdPersona(dniNormalizado);

    let existente = null;

    try {
        existente = await dbLocal.get(_id);
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
    }

    const persona = {
        ...(existente || {}),
        _id,
        tipo: "persona",
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dniNormalizado,
        actualizadoEn: ahora,
        creadoEn: existente?.creadoEn || ahora,
        origenDeviceId: existente?.origenDeviceId || deviceId
    };

    await dbLocal.put(persona);
}

async function refrescarLista() {
    const resultado = await dbLocal.allDocs({
        include_docs: true,
        startkey: "persona:",
        endkey: "persona:\ufff0"
    });

    const personas = resultado.rows
        .map((row) => row.doc)
        .sort((a, b) => (b.actualizadoEn || "").localeCompare(a.actualizadoEn || ""));

    contador.textContent = `Registros locales: ${personas.length}`;
    listaPersonas.innerHTML = "";

    for (const persona of personas.slice(0, 10)) {
        const item = document.createElement("li");
        item.textContent = `${persona.apellido}, ${persona.nombre} — DNI ${persona.dni}`;
        listaPersonas.appendChild(item);
    }
}

function observarCambiosLocales() {
    dbLocal
        .changes({
            since: "now",
            live: true,
            include_docs: false
        })
        .on("change", () => refrescarLista())
        .on("error", (error) => console.warn("Error observando cambios locales", error));
}

function programarReintentoSync(motivo) {
    if (retryTimer) {
        clearTimeout(retryTimer);
    }

    retryTimer = setTimeout(() => {
        prepararSincronizacion(`reintento por ${motivo}`);
    }, 5000);
}

async function sincronizarAhora(motivo = "manual") {
    if (syncEnCurso || !dbRemota) {
        return;
    }

    syncEnCurso = true;
    setEstado(`Sincronizando ahora (${motivo})...`);

    try {
        const resultado = await PouchDB.sync(dbLocal, dbRemota, {
            retry: false
        });

        await refrescarLista();

        const enviados = resultado.push?.docs_written || 0;
        const recibidos = resultado.pull?.docs_written || 0;
        setEstado(`Sync completada. Enviados: ${enviados}. Recibidos: ${recibidos}.`);
    } catch (error) {
        setEstado(`CouchDB todavía no está disponible. Los datos quedan offline. Reintento automático en unos segundos.`);
        programarReintentoSync(error.message);
    } finally {
        syncEnCurso = false;
    }
}

function iniciarSincronizacionLive() {
    if (!dbRemota) {
        return;
    }

    if (syncHandler) {
        syncHandler.cancel();
    }

    syncHandler = PouchDB.sync(dbLocal, dbRemota, {
        live: true,
        retry: true
    })
        .on("active", () => setEstado("Sincronizando con CouchDB..."))
        .on("paused", (error) => {
            if (error) {
                setEstado("Sin red o CouchDB no disponible. Los datos siguen guardados localmente.");
                return;
            }

            setEstado("Al día. Sin cambios pendientes conocidos.");
        })
        .on("change", async () => {
            setEstado("Cambios sincronizados.");
            await refrescarLista();
        })
        .on("denied", (error) => setEstado(`CouchDB rechazó un cambio: ${error.message}`))
        .on("error", (error) => {
            setEstado("La sincronización live se detuvo. Reintentando...");
            programarReintentoSync(error.message);
        });
}

async function prepararSincronizacion(motivo = "inicio") {
    if (!window.APP_CONFIG) {
        setEstado("Modo local: falta config.local.js. Copiá config.example.js a config.local.js para sincronizar con CouchDB.");
        return;
    }

    if (!navigator.onLine) {
        setEstado("Sin conexión. Podés cargar registros offline.");
        return;
    }

    try {
        dbRemota = await seleccionarDbRemota();
        iniciarSincronizacionLive();
        await sincronizarAhora(motivo);
    } catch (error) {
        setEstado("CouchDB todavía no responde. Los datos quedan offline y se reintentará.");
        programarReintentoSync(error.message);
    }
}

async function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        console.warn("Este navegador/contexto no soporta Service Worker.");
        return;
    }

    try {
        await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
        console.warn("No se pudo registrar el Service Worker", error);
    }
}

formPersona.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    try {
        await guardarPersona({
            nombre: form.elements.nombre.value,
            apellido: form.elements.apellido.value,
            dni: form.elements.dni.value
        });

        form.reset();
        await refrescarLista();
        setEstado("Guardado localmente. Se sincronizará automáticamente cuando CouchDB esté disponible.");
        await sincronizarAhora("nuevo registro");
    } catch (error) {
        setEstado(`No se pudo guardar: ${error.message}`);
    }
});

window.addEventListener("online", () => {
    setEstado("Conexión recuperada. Verificando CouchDB...");
    prepararSincronizacion("conexión recuperada");
});

window.addEventListener("offline", () => {
    setEstado("Sin conexión. Podés seguir cargando registros.");
});

async function iniciarApp() {
    try {
        assertPouchDbDisponible();
        dbLocal = new PouchDB(LOCAL_DB_NAME);
        await registrarServiceWorker();
        await refrescarLista();
        observarCambiosLocales();
        await prepararSincronizacion("inicio");
    } catch (error) {
        setEstado(`Error inicializando la app: ${error.message}`);
    }
}

iniciarApp();
