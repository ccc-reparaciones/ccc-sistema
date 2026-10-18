// =============================================
// storage.js — datos del sistema, guardados en Firestore
//
// Las variables globales (ordenes, caja, stock...) funcionan igual que
// siempre: cada módulo las usa y llama a guardarDatos() / guardarX().
// La diferencia es que ahora se guardan en la nube (Firestore) en vez
// de en el navegador, y se sincronizan entre dispositivos.
// =============================================

let ordenes           = [];
let ultimoNumeroOrden = 1;
let caja              = [];
let registros         = [];
let stock             = [];
let tecnicos          = [];
let facturacionExtra  = [];
let pagosTecnicos     = [];
let cuentas           = [];
let gastosFijos       = [];
let portalIndex       = {};   // control interno de lo publicado para clientes
let productosWeb      = [];   // productos que se ven en la página principal

const CLAVES_NUBE = ["ordenes", "ultimoNumeroOrden", "caja", "registros", "stock",
                     "tecnicos", "facturacionExtra", "pagosTecnicos", "cuentas",
                     "gastosFijos", "portalIndex"];
const COL_DATOS = "cccData";

function _valorDe(k) {
    switch (k) {
        case "ordenes": return ordenes;
        case "ultimoNumeroOrden": return ultimoNumeroOrden;
        case "caja": return caja;
        case "registros": return registros;
        case "stock": return stock;
        case "tecnicos": return tecnicos;
        case "facturacionExtra": return facturacionExtra;
        case "pagosTecnicos": return pagosTecnicos;
        case "cuentas": return cuentas;
        case "gastosFijos": return gastosFijos;
        case "portalIndex": return portalIndex;
    }
}
function _asignar(k, v) {
    switch (k) {
        case "ordenes": ordenes = v; break;
        case "ultimoNumeroOrden": ultimoNumeroOrden = v; break;
        case "caja": caja = v; break;
        case "registros": registros = v; break;
        case "stock": stock = v; break;
        case "tecnicos": tecnicos = v; break;
        case "facturacionExtra": facturacionExtra = v; break;
        case "pagosTecnicos": pagosTecnicos = v; break;
        case "cuentas": cuentas = v; break;
        case "gastosFijos": gastosFijos = v; break;
        case "portalIndex": portalIndex = v; break;
    }
}
function _defecto(k) {
    if (k === "ultimoNumeroOrden") return 1;
    if (k === "portalIndex") return {};
    return [];
}

const _ultimoTexto = {};   // último texto sincronizado con la nube, por clave
const _partesNube  = {};
const _pendientes  = new Set();
let _timerGuardado = null;
let _cola          = Promise.resolve();
let _avisoErrorMostrado = false;
let _desuscribir   = [];

// ── CARGA INICIAL (después del login del personal) ───────
async function cargarDatosNube() {
    const lecturas = await Promise.all(CLAVES_NUBE.map(k => nubeLeer(COL_DATOS, k)));
    let hayAlgo = false;
    CLAVES_NUBE.forEach((k, i) => {
        const r = lecturas[i];
        if (r) {
            hayAlgo = true;
            _ultimoTexto[k] = r.texto;
            _partesNube[k]  = r.partes;
            _asignar(k, JSON.parse(r.texto));
        } else {
            _ultimoTexto[k] = undefined;
            _asignar(k, _defecto(k));
        }
    });
    if (!Array.isArray(cuentas)) cuentas = [];
    actualizarProductosWeb();
    return hayAlgo; // false = la nube está vacía (primera vez)
}

// ── ESCUCHA EN TIEMPO REAL (cambios desde otros dispositivos) ───────
function activarListeners() {
    detenerListeners();
    CLAVES_NUBE.forEach(k => {
        _desuscribir.push(nubeEscuchar(COL_DATOS, k, r => {
            if (!r) return;
            if (r.texto === _ultimoTexto[k]) return;
            _ultimoTexto[k] = r.texto;
            _partesNube[k]  = r.partes;
            _asignar(k, JSON.parse(r.texto));
            if (k === "stock") actualizarProductosWeb();
        }));
    });
}
function detenerListeners() {
    _desuscribir.forEach(f => { try { f(); } catch (e) {} });
    _desuscribir = [];
}

// ── GUARDADO ───────────────────────────────────
function guardarClave(k) {
    _pendientes.add(k);
    clearTimeout(_timerGuardado);
    const soloRegistros = _pendientes.size === 1 && _pendientes.has("registros");
    _timerGuardado = setTimeout(flushGuardado, soloRegistros ? 2500 : 400);
}

// Escribe en la nube lo que esté pendiente (solo lo que realmente cambió)
function flushGuardado() {
    clearTimeout(_timerGuardado);
    _timerGuardado = null;
    _cola = _cola.then(_flushInterno).catch(e => console.error("Guardado:", e));
    return _cola;
}

async function _flushInterno() {
    if (!auth.currentUser) { _pendientes.clear(); return; }
    const claves = Array.from(_pendientes);
    _pendientes.clear();
    const cambiadas = [];

    for (const k of claves) {
        const texto = JSON.stringify(_valorDe(k));
        if (texto === _ultimoTexto[k]) continue;
        try {
            _partesNube[k] = await nubeEscribir(COL_DATOS, k, texto, _partesNube[k]);
            _ultimoTexto[k] = texto;
            cambiadas.push(k);
            _avisoErrorMostrado = false;
        } catch (e) {
            console.error(`Error guardando "${k}":`, e);
            _pendientes.add(k);
            avisarErrorGuardado(e);
        }
    }

    try {
        if (cambiadas.includes("stock")) await publicarProductos();
        if (cambiadas.includes("ordenes") || cambiadas.includes("tecnicos")) await publicarPortal();
    } catch (e) {
        console.error("Publicación:", e);
    }
}

function avisarErrorGuardado(e) {
    if (_avisoErrorMostrado) return;
    _avisoErrorMostrado = true;
    alert("NO SE PUDO GUARDAR EN LA NUBE.\n\nRevisá tu conexión a internet. " +
          "Si cerrás la página ahora, los últimos cambios se pierden.\n\n(" + (e && e.code || "error") + ")");
}

// Intenta guardar lo pendiente si se cierra la pestaña
window.addEventListener("pagehide", () => { if (_pendientes.size) flushGuardado(); });
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && _pendientes.size) flushGuardado();
});

// ── PRODUCTOS PÚBLICOS (página principal) ──────
// Se publican SOLO los datos que se muestran en la web
// (sin costos ni stock interno).
function derivarProductosWeb() {
    return (Array.isArray(stock) ? stock : [])
        .filter(p => p.mostrarWeb)
        .map(p => ({
            id: p.id, descripcion: p.descripcion, detalle: p.detalle || "",
            imagen: p.imagen || "", precioEfectivo: p.precioEfectivo,
            descuento: p.descuento || 0, cantidad: p.cantidad, mostrarWeb: true
        }));
}
function actualizarProductosWeb() {
    productosWeb = derivarProductosWeb();
    if (typeof renderLandingProductos === "function") renderLandingProductos();
}
async function publicarProductos() {
    const texto = JSON.stringify(derivarProductosWeb());
    if (texto === _ultimoTexto["__publico_productos"]) return;
    const partes = await nubeEscribir("publico", "productos", texto, _partesNube["__publico_productos"]);
    _partesNube["__publico_productos"]  = partes;
    _ultimoTexto["__publico_productos"] = texto;
}
async function cargarProductosPublicos() {
    try {
        const r = await nubeLeer("publico", "productos");
        productosWeb = r ? JSON.parse(r.texto) : [];
    } catch (e) {
        console.error("Productos públicos:", e);
        productosWeb = [];
    }
    if (typeof renderLandingProductos === "function") renderLandingProductos();
}

// ── PORTAL DE CLIENTES ─────────────────────────
// Cada cliente (DNI + primer nombre) tiene su propio documento con SUS
// órdenes. Quien no conozca ambos datos no puede leerlo ni listarlo.
function _ordenParaCliente(o) {
    return {
        id: o.id, numero: o.numero, fechaCreacion: o.fechaCreacion,
        cliente: { nombre: o.cliente.nombre, apellido: o.cliente.apellido, documento: o.cliente.documento },
        equipo:  { marca: o.equipo.marca, modelo: o.equipo.modelo, color: o.equipo.color, imei: o.equipo.imei },
        trabajo: {
            presupuesto: o.trabajo.presupuesto, adelanto: o.trabajo.adelanto,
            observaciones: o.trabajo.observaciones, fallaReportada: o.trabajo.fallaReportada
        },
        estado: o.estado,
        tecnicoId: o.tecnicoId || null,
        historial: (o.historial || []).filter(h => h.tipo !== "COBRO_INTERNO")
                                      .map(h => ({ fecha: h.fecha, tipo: h.tipo, detalle: h.detalle }))
    };
}

async function publicarPortal() {
    // Agrupar órdenes por documento del cliente
    const grupos = {};
    ordenes.forEach(o => {
        if (!o.cliente) return;
        const dni = String(o.cliente.documento || "").replace(/\./g, "").trim();
        if (!dni) return;
        (grupos[dni] = grupos[dni] || []).push(o);
    });

    const nuevo = {};   // clave -> { checksum, contenido }
    Object.keys(grupos).forEach(dni => {
        const lista = grupos[dni];
        const primerNombre = String(lista[0].cliente.nombre || "").trim().toLowerCase().split(" ")[0];
        if (!primerNombre) return;
        const clave = clavePortal(dni, primerNombre);
        const ids = new Set(lista.map(o => o.tecnicoId).filter(Boolean));
        const contenido = {
            ordenes:  lista.map(_ordenParaCliente),
            tecnicos: tecnicos.filter(t => ids.has(t.id)).map(t => ({ id: t.id, nombre: t.nombre, apellido: t.apellido || "" }))
        };
        const texto = JSON.stringify(contenido);
        nuevo[clave] = { checksum: sha256Hex(texto), texto };
    });

    const indiceViejo = portalIndex || {};
    const indiceNuevo = {};
    let batch = db.batch(), ops = 0;
    const cerrarBatch = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };

    for (const clave of Object.keys(nuevo)) {
        indiceNuevo[clave] = nuevo[clave].checksum;
        if (indiceViejo[clave] !== nuevo[clave].checksum) {
            batch.set(db.collection("portal").doc(clave), { datos: nuevo[clave].texto, t: Date.now() });
            if (++ops >= 400) await cerrarBatch();
        }
    }
    for (const clave of Object.keys(indiceViejo)) {
        if (!indiceNuevo[clave]) {
            batch.delete(db.collection("portal").doc(clave));
            if (++ops >= 400) await cerrarBatch();
        }
    }
    await cerrarBatch();

    if (JSON.stringify(indiceNuevo) !== JSON.stringify(indiceViejo)) {
        portalIndex = indiceNuevo;
        const texto = JSON.stringify(portalIndex);
        _partesNube["portalIndex"] = await nubeEscribir(COL_DATOS, "portalIndex", texto, _partesNube["portalIndex"]);
        _ultimoTexto["portalIndex"] = texto;
    }
}

// Carga el portal de un cliente (sin login de personal)
async function cargarPortalCliente(clave) {
    const snap = await db.collection("portal").doc(clave).get();
    if (!snap.exists) return false;
    const d = JSON.parse(snap.data().datos);
    ordenes  = d.ordenes  || [];
    tecnicos = d.tecnicos || [];
    return true;
}

// Vacía los datos en memoria (al cerrar sesión)
function limpiarDatosEnMemoria() {
    detenerListeners();
    CLAVES_NUBE.forEach(k => { _asignar(k, _defecto(k)); delete _ultimoTexto[k]; delete _partesNube[k]; });
    _pendientes.clear();
}

// ── IMPORTAR DATOS VIEJOS DEL NAVEGADOR (solo la primera vez) ────────
const _CLAVES_LOCALES = {
    ordenes: "ordenesCCC", ultimoNumeroOrden: "ultimoNumeroOrdenCCC", caja: "cajaCCC",
    registros: "registrosCCC", stock: "stockCCC", tecnicos: "tecnicosCCC",
    facturacionExtra: "facturacionExtraCCC", pagosTecnicos: "pagosTecnicosCCC",
    cuentas: "cuentasCCC", gastosFijos: "gastosFijosCCC"
};
function hayDatosLocalesViejos() {
    try {
        return ["ordenes", "caja", "stock", "tecnicos", "cuentas"].some(k => {
            const v = JSON.parse(localStorage.getItem(_CLAVES_LOCALES[k]) || "[]");
            if (k === "cuentas") return Array.isArray(v) && v.some(c => c.usuario !== "Admin");
            return Array.isArray(v) && v.length > 0;
        });
    } catch (e) { return false; }
}
function importarDatosLocales() {
    Object.keys(_CLAVES_LOCALES).forEach(k => {
        const crudo = localStorage.getItem(_CLAVES_LOCALES[k]);
        if (crudo === null) return;
        let v = JSON.parse(crudo);
        if (k === "cuentas") {
            // Las contraseñas NO se guardan en la base de datos
            v = (v || []).filter(c => c.usuario !== "Admin").map(c => { const { password, ...resto } = c; return resto; });
        }
        if (k === "ultimoNumeroOrden") v = Number(v) || 1;
        _asignar(k, v);
        guardarClave(k);
    });
}

// ── GUARDAR TODO ──────────────────────────────
function guardarDatos() {
    ["ordenes", "ultimoNumeroOrden", "caja", "stock", "tecnicos",
     "facturacionExtra", "pagosTecnicos", "gastosFijos"].forEach(guardarClave);
}

// ── CAJA ──────────────────────────────────────
function guardarCaja() { guardarClave("caja"); }

function registrarMovimientoCaja(movimiento) {
    caja.push(movimiento);
    guardarCaja();
}

function guardarGastosFijos() { guardarClave("gastosFijos"); }

// ── NÚMERO DE ORDEN ───────────────────────────
function generarNumeroOrden() {
    return String(ultimoNumeroOrden).padStart(5, "0");
}
