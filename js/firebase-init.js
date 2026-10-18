// =============================================
// firebase-init.js — conexión con Firebase
// (Authentication + Firestore)
// =============================================

const firebaseConfig = {
    apiKey:            "AIzaSyAb81JtYtLsT6FBqzIgy6HNV8FFih1ksz0",
    authDomain:        "ccc-sistema.firebaseapp.com",
    projectId:         "ccc-sistema",
    storageBucket:     "ccc-sistema.firebasestorage.app",
    messagingSenderId: "149098558081",
    appId:             "1:149098558081:web:623fc71d816692b94a9380"
};
// (La apiKey de Firebase NO es un secreto: lo que protege los datos
//  son el login y las reglas de Firestore.)

// Email del administrador (el que creaste en Firebase → Authentication)
const ADMIN_EMAIL     = "conradotribiani@hotmail.com";
// Los empleados entran con "usuario" y contraseña. Por dentro se les crea
// un email interno inventado (no se envía ningún mail a esa dirección).
const EMAIL_DOMINIO   = "empleados.ccc-sistema.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// La sesión dura mientras la pestaña esté abierta (igual que antes)
const authListo = auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch(e => console.error("Persistencia:", e));

// App secundaria: sirve para crear cuentas de empleados sin
// cerrar la sesión del administrador.
const appSecundaria  = firebase.initializeApp(firebaseConfig, "secundaria");
const authSecundaria = appSecundaria.auth();
authSecundaria.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(() => {});

// ── SHA-256 (para armar claves que no revelan datos del cliente) ──
function sha256Hex(texto) {
    const K = [], H = [];
    const mathPow = Math.pow, maxWord = mathPow(2, 32);
    let primos = 0;
    for (let c = 2; primos < 64; c++) {
        let esPrimo = true;
        for (let i = 2; i * i <= c; i++) if (c % i === 0) { esPrimo = false; break; }
        if (!esPrimo) continue;
        if (primos < 8) H[primos] = (mathPow(c, 1 / 2) * maxWord) | 0;
        K[primos++] = (mathPow(c, 1 / 3) * maxWord) | 0;
    }
    const bytes = Array.from(new TextEncoder().encode(texto));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / maxWord), lo = bitLen >>> 0;
    [hi, lo].forEach(w => { for (let i = 3; i >= 0; i--) bytes.push((w >>> (i * 8)) & 255); });

    let h = H.slice();
    for (let off = 0; off < bytes.length; off += 64) {
        const w = new Array(64);
        for (let i = 0; i < 16; i++) {
            w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) |
                   (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
        }
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15], b = w[i - 2];
            const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
            const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0,
             (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

// ── CLAVES DE ACCESO PÚBLICO ─────────────────
// Usuario de empleado → documento "acceso/<hash>" (guarda su email interno)
function claveAcceso(usuario) {
    return sha256Hex("ccc-acceso|" + String(usuario).trim().toLowerCase());
}
// Cliente → documento "portal/<hash>" (DNI + primer nombre)
function clavePortal(dni, primerNombre) {
    const d = String(dni).replace(/\./g, "").trim();
    const n = String(primerNombre).trim().toLowerCase().split(" ")[0];
    return sha256Hex("ccc-portal|" + d + "|" + n);
}

// ── LECTURA / ESCRITURA EN FIRESTORE POR "TROZOS" ─────────
// Firestore limita cada documento a 1 MB. Para que los datos (órdenes,
// imágenes de productos, etc.) nunca lo superen, cada dato se guarda como
// texto y se parte en trozos de 400.000 caracteres.
const TAM_TROZO = 400000;

function _trocear(texto) {
    const t = [];
    for (let i = 0; i < texto.length; i += TAM_TROZO) t.push(texto.slice(i, i + TAM_TROZO));
    return t.length ? t : [""];
}
function _refTrozo(col, clave, i) {
    return db.collection(col).doc(i === 0 ? clave : clave + "__" + i);
}

// Devuelve { texto, partes } o null si no existe
async function _armarDesdePrimerDoc(col, clave, snap) {
    if (!snap.exists) return null;
    const d = snap.data();
    const partes = d.partes || 1;
    let texto = d.datos || "";
    if (partes > 1) {
        const resto = await Promise.all(
            Array.from({ length: partes - 1 }, (_, i) => _refTrozo(col, clave, i + 1).get())
        );
        resto.forEach(s => { texto += s.exists ? (s.data().datos || "") : ""; });
    }
    return { texto, partes };
}

async function nubeLeer(col, clave) {
    const snap = await _refTrozo(col, clave, 0).get();
    return _armarDesdePrimerDoc(col, clave, snap);
}

// Escribe todo en un solo "batch" (o se guarda todo, o nada)
async function nubeEscribir(col, clave, texto, partesAnteriores) {
    const trozos = _trocear(texto);
    const batch = db.batch();
    trozos.forEach((t, i) => {
        batch.set(_refTrozo(col, clave, i),
            i === 0 ? { partes: trozos.length, datos: t, t: Date.now() } : { datos: t });
    });
    for (let i = trozos.length; i < (partesAnteriores || 1); i++) {
        batch.delete(_refTrozo(col, clave, i));
    }
    await batch.commit();
    return trozos.length;
}

// Escucha cambios hechos desde otros dispositivos
function nubeEscuchar(col, clave, callback) {
    return _refTrozo(col, clave, 0).onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return; // es un cambio nuestro
        _armarDesdePrimerDoc(col, clave, snap)
            .then(r => callback(r))
            .catch(e => console.error("Escucha " + clave, e));
    }, e => console.error("Escucha " + clave, e));
}
