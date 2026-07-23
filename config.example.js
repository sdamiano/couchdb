// Copiá este archivo como config.local.js y ajustalo para tu CouchDB local.
//
// IMPORTANTE:
// - No subás config.local.js al repositorio.
// - Para una demo pública, usá un usuario limitado de CouchDB, nunca una contraseña de administrador.
// - Un frontend/PWA no puede ocultar secretos. Todo lo que pongas acá será visible para quien use el navegador.

window.APP_CONFIG = {
    couchdb: {
        protocol: "http",
        port: "5984",
        dbName: "personal",
        localDbName: "personal",

        // Dejar vacío para CouchDB sin autenticación, o configurar un usuario limitado para la demo.
        username: "",
        password: "",

        // "auto" usa el hostname actual de la app y agrega alternativas localhost en escritorio.
        // También podés forzar hosts, por ejemplo: ["192.168.0.169", "localhost"].
        hostCandidates: "auto"
    }
};

