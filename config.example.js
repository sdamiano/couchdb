// Copy this file to config.local.js and adjust it for your local CouchDB.
//
// IMPORTANT:
// - Do not commit config.local.js.
// - For a public demo, use a limited CouchDB user, never an admin password.
// - A frontend/PWA cannot hide secrets. Anything here is visible to the browser user.

window.APP_CONFIG = {
    couchdb: {
        protocol: "http",
        port: "5984",
        dbName: "personal",
        localDbName: "personal",

        // Leave empty for CouchDB without auth, or set a limited demo user.
        username: "",
        password: "",

        // "auto" uses the current app hostname plus localhost fallbacks on desktop.
        // You can also force hosts, e.g. ["192.168.0.169", "localhost"].
        hostCandidates: "auto"
    }
};
