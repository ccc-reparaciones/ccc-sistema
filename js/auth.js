// =============================================
// AUTH.JS — Sistema de login, cuentas y registros
// =============================================

// ── CUENTAS ──────────────────────────────────
// Se guardan en Firestore como array de objetos (SIN contraseña: las
// contraseñas viven en Firebase Authentication):
// { id, usuario, email, rol, roles, secciones... }
// rol: "admin" | "usuario"
// La cuenta admin siempre existe y no se puede eliminar

function getCuentas() {
    if (!Array.isArray(cuentas)) cuentas = [];
    // La cuenta Admin siempre existe (su contraseña vive en Firebase Authentication)
    if (!cuentas.find(c => c.usuario === "Admin")) {
        cuentas.push({ id: "admin", usuario: "Admin", rol: "admin", email: ADMIN_EMAIL });
    }
    return cuentas;
}

function guardarCuentas(lista) {
    cuentas = lista;
    guardarClave("cuentas");
}

// ── SESIÓN ────────────────────────────────────
// Guardamos el usuario logueado en sessionStorage (se borra al cerrar pestaña)

function getSesion() {
    return JSON.parse(sessionStorage.getItem("sesionCCC")) || null;
}

function setSesion(cuenta) {
    sessionStorage.setItem("sesionCCC", JSON.stringify({ id: cuenta.id, usuario: cuenta.usuario, rol: cuenta.rol }));
}

async function cerrarSesion() {
    guardarRegistro("SISTEMA", "LOGOUT", "Cierre de sesión");
    try { await flushGuardado(); } catch (e) {}
    sessionStorage.removeItem("sesionCCC");
    limpiarDatosEnMemoria();
    try { await auth.signOut(); } catch (e) {}
    if(typeof mostrarBotonMenu === "function") mostrarBotonMenu(false);
    if(typeof cerrarSidebar === "function") cerrarSidebar();
    mostrarLogin();
}

function esAdmin() {
    const s = getSesion();
    return s && s.rol === "admin";
}

function usuarioActual() {
    return getSesion()?.usuario || "Desconocido";
}

// ── SECCIONES Y PERMISOS ──────────────────────
// El orden coincide con el de los botones fijos del sidebar.
const SECCIONES = [
    { key: "inicio",      label: "Inicio",       fn: "mostrarInicio" },
    { key: "crearOrden",  label: "Crear Orden",  fn: "mostrarOrdenes" },
    { key: "ordenes",     label: "Órdenes",      fn: "mostrarListadoOrdenes" },
    { key: "clientes",    label: "Clientes",     fn: "mostrarClientes" },
    { key: "stock",       label: "Stock",        fn: "mostrarStock" },
    { key: "facturacion", label: "Facturación",  fn: "mostrarFacturacion" },
    { key: "caja",        label: "Caja",         fn: "mostrarCaja" },
    { key: "tecnicos",    label: "Técnicos",     fn: "mostrarTecnicos" }
];

const ROLES = [
    { key: "administrador", label: "Administrador" },
    { key: "gerente",       label: "Gerente" },
    { key: "tecnico",       label: "Técnico" },
    { key: "vendedor",      label: "Vendedor" }
];

// ¿La sesión actual puede ver esta sección?
// - El administrador ve todo.
// - Las cuentas con lista de secciones ven solo esas.
// - Las cuentas viejas (sin lista) ven todo, como antes.
function puedeVer(key) {
    const s = getSesion();
    if (!s) return false;
    if (s.rol === "admin") return true;
    const cuenta = getCuentas().find(c => c.id === s.id);
    if (!cuenta) return false;
    if (!Array.isArray(cuenta.secciones)) return true;
    return cuenta.secciones.includes(key);
}

// Envuelve las funciones mostrar* para bloquear secciones sin permiso
function aplicarPermisos() {
    if (window._permisosAplicados) return;
    window._permisosAplicados = true;

    SECCIONES.forEach(sec => {
        const original = window[sec.fn];
        if (typeof original !== "function") return;
        window[sec.fn] = function (...args) {
            if (getSesion() && !puedeVer(sec.key)) {
                alert("NO TENÉS PERMISO PARA ACCEDER A ESTA SECCIÓN.");
                return;
            }
            return original.apply(this, args);
        };
    });
}

// Abre la primera sección a la que la cuenta tiene acceso
function irAPrimeraSeccion() {
    const primera = SECCIONES.find(sec => puedeVer(sec.key));
    if (primera) {
        window[primera.fn]();
        return;
    }
    document.getElementById("contenido").innerHTML = `
        <h1>SIN SECCIONES ASIGNADAS</h1>
        <p style="color:#ccc; max-width:520px; line-height:1.6;">
            Tu cuenta todavía no tiene secciones habilitadas. Pedile al administrador que te asigne las que necesites.
        </p>
    `;
}

// ── SESIÓN DE CLIENTE ─────────────────────────
// Los clientes no tienen una "cuenta" creada manualmente: su acceso se
// genera automáticamente a partir de sus órdenes (DNI = usuario,
// primer nombre = contraseña). Por eso su sesión se maneja aparte.

function getSesionCliente() {
    return JSON.parse(sessionStorage.getItem("sesionClienteCCC")) || null;
}

function setSesionCliente(dni, nombre, clave) {
    sessionStorage.setItem("sesionClienteCCC", JSON.stringify({ dni, nombre, clave }));
}

function cerrarSesionCliente() {
    sessionStorage.removeItem("sesionClienteCCC");
    limpiarDatosEnMemoria();
    if(typeof mostrarBotonMenu === "function") mostrarBotonMenu(false);
    document.getElementById("contenido").classList.remove("portal-cliente");
    mostrarLogin();
}

// ── REGISTROS DE ACTIVIDAD ────────────────────
// Cada registro: { fecha, usuario, seccion, accion, detalle }

function getRegistros() {
    return Array.isArray(registros) ? registros : [];
}

// "clave" (opcional): si el último registro es del mismo usuario y tiene la misma
// clave, se actualiza en vez de agregar otro (evita llenar el registro cuando se
// escribe un número letra por letra).
function guardarRegistro(seccion, accion, detalle, clave) {
    const sesion = getSesion();
    if (!sesion) return;
    const lista = getRegistros();
    const nuevo = {
        fecha:   obtenerFechaArgentina(),
        usuario: sesion.usuario,
        seccion,
        accion,
        detalle: detalle || ""
    };
    if (clave) nuevo.clave = clave;

    const ultimo = lista[lista.length - 1];
    if (clave && ultimo && ultimo.clave === clave && ultimo.usuario === sesion.usuario) {
        lista[lista.length - 1] = nuevo;
    } else {
        lista.push(nuevo);
    }

    // Máximo 1500 registros: primero se descartan las visitas viejas,
    // después lo más antiguo
    while (lista.length > 1500) {
        const idx = lista.findIndex(r => r.accion === "VER");
        lista.splice(idx >= 0 ? idx : 0, 1);
    }
    registros = lista;
    guardarClave("registros");
}

// "#12 (Juan Pérez)" para describir una orden en los registros
function descOrden(o) {
    const c = o.cliente || {};
    const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ");
    return `#${o.numero}${nombre ? " (" + nombre + ")" : ""}`;
}

// ── PANTALLA DE LOGIN ─────────────────────────

function mostrarLogin() {
    // Ocultar sidebar y mostrar solo el login
    document.querySelector(".sidebar").style.display = "none";

    document.getElementById("contenido").innerHTML = `
        <div style="
            min-height:100vh;
            display:flex;
            justify-content:center;
            align-items:center;
            background:#1F2A44;
        ">
            <div style="
                background:rgba(255,255,255,.07);
                border:1px solid rgba(255,255,255,.12);
                border-radius:20px;
                padding:48px 40px;
                width:380px;
                max-width:90vw;
                box-shadow:0 24px 64px rgba(0,0,0,.4);
            ">
                <!-- Logo -->
                <img src="${LOGO_BLANCO}" alt="CCC Reparación de Celulares" style="display:block; width:200px; max-width:80%; height:auto; margin:0 auto 22px;">

                <p style="
                    text-align:center;
                    font-size:13px;
                    color:#9ED1F7;
                    margin-bottom:6px;
                    text-transform:uppercase;
                    font-weight:600;
                    letter-spacing:0.5px;
                ">Iniciar sesión</p>

                <p style="
                    text-align:center;
                    font-size:12px;
                    color:rgba(255,255,255,.45);
                    margin-bottom:28px;
                    line-height:1.5;
                    text-transform:none;
                ">¿Sos cliente? Ingresá tu DNI como usuario<br>y tu nombre como contraseña.</p>

                <div style="margin-bottom:16px;">
                    <label style="display:block; font-size:12px; font-weight:700; color:#aaa; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">Usuario</label>
                    <input
                        type="text"
                        id="loginUsuario"
                        placeholder="Ingresá tu usuario"
                        onkeydown="if(event.key==='Enter') hacerLogin()"
                        style="
                            width:100%; padding:13px 14px;
                            background:rgba(255,255,255,.1);
                            border:1px solid rgba(255,255,255,.15);
                            border-radius:10px;
                            color:white;
                            font-family:'Inter',sans-serif;
                            font-size:14px;
                            outline:none;
                        "
                    >
                </div>

                <div style="margin-bottom:28px;">
                    <label style="display:block; font-size:12px; font-weight:700; color:#aaa; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">Contraseña</label>
                    <input
                        type="password"
                        id="loginPassword"
                        placeholder="••••••••"
                        onkeydown="if(event.key==='Enter') hacerLogin()"
                        style="
                            width:100%; padding:13px 14px;
                            background:rgba(255,255,255,.1);
                            border:1px solid rgba(255,255,255,.15);
                            border-radius:10px;
                            color:white;
                            font-family:'Inter',sans-serif;
                            font-size:14px;
                            outline:none;
                        "
                    >
                </div>

                <div id="loginError" style="
                    display:none;
                    background:#F8D7DA;
                    color:#721C24;
                    border-radius:8px;
                    padding:10px 14px;
                    font-size:13px;
                    font-weight:700;
                    text-align:center;
                    margin-bottom:16px;
                    text-transform:uppercase;
                "></div>

                <button
                    onclick="hacerLogin()"
                    style="
                        width:100%; padding:14px;
                        background:#9ED1F7;
                        border:none; border-radius:10px;
                        font-family:'Inter',sans-serif;
                        font-size:14px; font-weight:800;
                        text-transform:uppercase;
                        cursor:pointer;
                        transition:.2s;
                        color:#1F2A44;
                        letter-spacing:0.5px;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.transform=''"
                >
                    INGRESAR
                </button>
            </div>
        </div>
    `;

    // Foco automático en usuario
    setTimeout(() => document.getElementById("loginUsuario")?.focus(), 50);
}

// Devuelve el email de Firebase que corresponde a lo escrito en "Usuario",
// o null si no es personal (en ese caso se prueba como cliente).
async function resolverEmailPersonal(usuario) {
    const u = usuario.trim().toLowerCase();
    if (u === "admin" || u === ADMIN_EMAIL) return ADMIN_EMAIL;
    if (u.includes("@")) return u;
    try {
        const snap = await db.collection("acceso").doc(claveAcceso(u)).get();
        return snap.exists ? snap.data().email : null;
    } catch (e) { return null; }
}

// Deja la sesión lista una vez que Firebase aceptó al usuario
async function iniciarSesionPersonal(email) {
    const hayDatos = await cargarDatosNube();

    // Primera vez con la nube vacía: ofrecer importar lo que había en este navegador
    if (!hayDatos && email === ADMIN_EMAIL && hayDatosLocalesViejos() &&
        !localStorage.getItem("cccImportacionRechazada")) {
        if (confirm("ENCONTRAMOS DATOS GUARDADOS EN ESTE NAVEGADOR (ÓRDENES, STOCK, CAJA, ETC.).\n\n" +
                    "¿QUERÉS IMPORTARLOS A LA NUBE?\n\n" +
                    "Los empleados importados tendrán que recibir una contraseña nueva (botón CAMBIAR PASS en Cuentas).")) {
            importarDatosLocales();
            actualizarProductosWeb();
        } else {
            localStorage.setItem("cccImportacionRechazada", "1");
        }
    }

    getCuentas();
    let cuenta = cuentas.find(c => c.email && c.email.toLowerCase() === email);
    if (!cuenta && email === ADMIN_EMAIL) cuenta = cuentas.find(c => c.usuario === "Admin");
    if (!cuenta) {
        await auth.signOut();
        limpiarDatosEnMemoria();
        throw { codigoPropio: "SIN_CUENTA" };
    }
    if (email === ADMIN_EMAIL) cuenta.email = ADMIN_EMAIL;

    setSesion(cuenta);
    activarListeners();
    guardarRegistro("SISTEMA", "LOGIN", `Inicio de sesión`);
    guardarClave("cuentas"); // por si se agregó la cuenta Admin
    return cuenta;
}

async function hacerLogin() {
    const usuario  = document.getElementById("loginUsuario").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    const boton    = document.querySelector("#contenido button[onclick='hacerLogin()']");

    const mostrarError = (txt) => {
        errorDiv.textContent = txt;
        errorDiv.style.display = "block";
        document.getElementById("loginPassword").value = "";
    };

    if (!usuario || !password) {
        errorDiv.textContent = "COMPLETÁ USUARIO Y CONTRASEÑA";
        errorDiv.style.display = "block";
        return;
    }

    if (boton) { boton.disabled = true; boton.dataset.txt = boton.textContent; boton.textContent = "INGRESANDO…"; }
    errorDiv.style.display = "none";

    try {
        await authListo;

        // ── 1) ¿Es personal (administrador/empleado)? ──
        const email = await resolverEmailPersonal(usuario);
        if (email) {
            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (e) {
                if (e.code === "auth/too-many-requests") mostrarError("DEMASIADOS INTENTOS. ESPERÁ UNOS MINUTOS E INTENTÁ DE NUEVO");
                else if (e.code === "auth/network-request-failed") mostrarError("SIN CONEXIÓN A INTERNET");
                else mostrarError("USUARIO O CONTRASEÑA INCORRECTOS");
                return;
            }
            try {
                await iniciarSesionPersonal(email);
            } catch (e) {
                console.error(e);
                if (e && e.codigoPropio === "SIN_CUENTA") mostrarError("ESTA CUENTA YA NO EXISTE EN EL SISTEMA");
                else { try { await auth.signOut(); } catch (_) {} mostrarError("NO SE PUDIERON CARGAR LOS DATOS. REVISÁ LA CONEXIÓN"); }
                return;
            }

            document.getElementById("contenido").classList.remove("portal-cliente");
            document.querySelector(".sidebar").style.display = "flex";
            if(typeof mostrarBotonMenu === "function") mostrarBotonMenu(true);
            actualizarSidebar();
            irAPrimeraSeccion();
            return;
        }

        // ── 2) ¿Es un cliente? usuario = DNI, contraseña = primer nombre ──
        const dni    = usuario.replace(/\./g, "");
        const nombre = password.trim().toLowerCase();
        const clave  = clavePortal(dni, nombre);

        let encontrado = false;
        try { encontrado = await cargarPortalCliente(clave); } catch (e) { console.error(e); }

        if (encontrado) {
            const primera = ordenes[0].cliente.nombre;
            setSesionCliente(dni, primera, clave);
            document.querySelector(".sidebar").style.display = "none";
            if(typeof mostrarBotonMenu === "function") mostrarBotonMenu(false);
            mostrarPortalCliente();
            return;
        }

        mostrarError("USUARIO O CONTRASEÑA INCORRECTOS");
    } finally {
        const b = document.querySelector("#contenido button[onclick='hacerLogin()']");
        if (b && b.dataset.txt) { b.disabled = false; b.textContent = b.dataset.txt; }
    }
}

// ── CREAR ACCESO DE FIREBASE PARA UN EMPLEADO ─────────
// Se llama al crear una cuenta o al cambiarle la contraseña. Crea un email
// interno nuevo (así la contraseña vieja deja de servir) y autoriza al empleado.
async function darAccesoEmpleado(cuenta, password) {
    const base  = (cuenta.usuario.toLowerCase().replace(/[^a-z0-9]/g, "") || "usuario");
    const email = `${base}.${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMINIO}`;

    await authSecundaria.createUserWithEmailAndPassword(email, password);
    await authSecundaria.signOut();

    const batch = db.batch();
    batch.set(db.collection("staff").doc(email), { usuario: cuenta.usuario, admin: cuenta.rol === "admin", t: Date.now() });
    batch.set(db.collection("acceso").doc(claveAcceso(cuenta.usuario)), { email });
    if (cuenta.email && cuenta.email !== email) {
        batch.delete(db.collection("staff").doc(cuenta.email));
    }
    await batch.commit();
    cuenta.email = email;
}

async function quitarAccesoEmpleado(cuenta) {
    const batch = db.batch();
    if (cuenta.email) batch.delete(db.collection("staff").doc(cuenta.email));
    batch.delete(db.collection("acceso").doc(claveAcceso(cuenta.usuario)));
    await batch.commit();
}

function textoErrorCuenta(e) {
    if (e && e.code === "auth/weak-password") return "LA CONTRASEÑA ES MUY DÉBIL (MÍNIMO 6 CARACTERES).";
    if (e && e.code === "auth/network-request-failed") return "SIN CONEXIÓN A INTERNET.";
    return "NO SE PUDO CREAR EL ACCESO: " + ((e && (e.code || e.message)) || "error desconocido");
}

// ── ACTUALIZAR SIDEBAR SEGÚN ROL ──────────────

function actualizarSidebar() {
    const sidebar    = document.querySelector(".sidebar");
    const esAdminNow = esAdmin();

    // Eliminar botones dinámicos previos
    sidebar.querySelectorAll(".btn-dinamico").forEach(b => b.remove());

    // Botón cerrar sesión — siempre visible
    const btnCerrar = document.createElement("button");
    btnCerrar.className  = "btn-dinamico";
    btnCerrar.textContent = "Cerrar Sesión";
    btnCerrar.onclick    = cerrarSesion;
    btnCerrar.style.cssText = "margin-top:auto; color:#F8D7DA; font-weight:700;";

    // Etiqueta de usuario
    const lblUsuario = document.createElement("div");
    lblUsuario.className = "btn-dinamico";
    lblUsuario.style.cssText = "font-size:11px; color:#9ED1F7; font-weight:700; text-transform:uppercase; padding:8px 12px; margin-top:auto; letter-spacing:0.5px;";
    lblUsuario.textContent = "👤 " + usuarioActual();

    if (esAdminNow) {
        const btnCuentas = document.createElement("button");
        btnCuentas.className  = "btn-dinamico";
        btnCuentas.textContent = "Cuentas";
        btnCuentas.onclick    = mostrarCuentas;
        sidebar.appendChild(btnCuentas);

        const btnRegistros = document.createElement("button");
        btnRegistros.className  = "btn-dinamico";
        btnRegistros.textContent = "Registros";
        btnRegistros.onclick    = mostrarRegistros;
        sidebar.appendChild(btnRegistros);
    }

    sidebar.appendChild(lblUsuario);
    sidebar.appendChild(btnCerrar);

    // Mostrar solo las secciones permitidas para esta cuenta
    const fijos = Array.from(sidebar.children).filter(el => el.tagName === "BUTTON" && !el.classList.contains("btn-dinamico"));
    SECCIONES.forEach((sec, i) => {
        if (fijos[i]) fijos[i].style.display = puedeVer(sec.key) ? "" : "none";
    });
}

// ── VERIFICACIÓN DE ACCESO ────────────────────
// Llamar al inicio de cada función mostrar*

function verificarAcceso() {
    if (!getSesion()) {
        mostrarLogin();
        return false;
    }
    return true;
}

// ── SECCIÓN CUENTAS (solo admin) ──────────────
// Cada cuenta: { id, usuario, password, rol ("admin"|"usuario"),
//   roles[] (administrador|gerente|tecnico|vendedor), secciones[],
//   nombre, apellido, documento, telefono,
//   comisionTecnico (% por reparación), comisionVendedor (% por venta cerrada) }
// Las cuentas con rol técnico o vendedor se sincronizan con la lista
// "tecnicos" (cuentaId) para que aparezcan en órdenes, pagos y facturación.

function etiquetaRol(key) {
    return ROLES.find(r => r.key === key)?.label || key;
}

function formCuentaHTML(c) {
    const edit   = !!c;
    const roles  = c?.roles || [];
    const secs   = Array.isArray(c?.secciones) ? c.secciones : SECCIONES.map(x => x.key);
    const esAdm  = roles.includes("administrador");
    const esTec  = roles.includes("tecnico");
    const esVen  = roles.includes("vendedor");

    const chkRoles = ROLES.map(r => `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:700; text-transform:none;">
            <input type="checkbox" class="cuRol" value="${r.key}" ${roles.includes(r.key) ? "checked" : ""}
                onchange="actualizarFormCuenta()" style="width:18px; height:18px; cursor:pointer;">
            ${r.label}
        </label>`).join("");

    const chkSecs = SECCIONES.map(sec => `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:700; text-transform:none;">
            <input type="checkbox" class="cuSec" value="${sec.key}" ${secs.includes(sec.key) ? "checked" : ""}
                style="width:18px; height:18px; cursor:pointer;">
            ${sec.label}
        </label>`).join("");

    return `
        <div class="formulario" style="max-width:760px;">

            <div class="fila">
                <div class="campo">
                    <label>USUARIO *</label>
                    <input type="text" id="cuUsuario" placeholder="Ej: Empleado1" value="${escapeHTML(c?.usuario || "")}" ${edit ? "readonly style=\"background:#e9ecef; cursor:not-allowed;\"" : ""}>
                </div>
                <div class="campo">
                    <label>TELÉFONO</label>
                    <input type="text" id="cuTelefono" placeholder="Ej: 1140615429" value="${escapeHTML(ftTel(c?.telefono) === "-" ? "" : ftTel(c?.telefono))}" oninput="ftTelInput(this)">
                </div>
            </div>

            ${edit ? "" : `
            <div class="fila">
                <div class="campo">
                    <label>CONTRASEÑA *</label>
                    <input type="password" id="cuPass" placeholder="Contraseña">
                </div>
                <div class="campo">
                    <label>REPETIR CONTRASEÑA *</label>
                    <input type="password" id="cuPass2" placeholder="Repetir contraseña">
                </div>
            </div>`}

            <div class="fila">
                <div class="campo">
                    <label>NOMBRE <span id="cuReqNombre">${(esTec || esVen) ? "*" : ""}</span></label>
                    <input type="text" id="cuNombre" placeholder="Nombre" value="${escapeHTML(c?.nombre || "")}">
                </div>
                <div class="campo">
                    <label>APELLIDO <span id="cuReqApellido">${(esTec || esVen) ? "*" : ""}</span></label>
                    <input type="text" id="cuApellido" placeholder="Apellido" value="${escapeHTML(c?.apellido || "")}">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>N° DE DOCUMENTO <span id="cuReqDoc">${(esTec || esVen) ? "*" : ""}</span></label>
                    <input type="text" id="cuDocumento" placeholder="DNI" value="${escapeHTML(c?.documento || "")}">
                </div>
                <div class="campo"></div>
            </div>

            <div style="margin:6px 0 16px; padding:14px 16px; background:rgba(255,255,255,.06); border-radius:12px;">
                <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; margin-bottom:10px;">ROLES *</div>
                <div style="display:flex; flex-wrap:wrap; gap:10px 24px;">${chkRoles}</div>

                <div class="fila" style="margin:14px 0 0;">
                    <div class="campo" id="cuBoxTec" style="display:${esTec ? "flex" : "none"};">
                        <label>% POR REPARACIÓN (TÉCNICO) *</label>
                        <input type="number" id="cuComTec" min="0" max="100" placeholder="Ej: 50" value="${c?.comisionTecnico ?? ""}">
                    </div>
                    <div class="campo" id="cuBoxVen" style="display:${esVen ? "flex" : "none"};">
                        <label>% POR VENTA CERRADA (VENDEDOR) *</label>
                        <input type="number" id="cuComVen" min="0" max="100" step="0.5" placeholder="Ej: 5" value="${c?.comisionVendedor ?? ""}">
                    </div>
                </div>
            </div>

            <div style="margin:6px 0 16px; padding:14px 16px; background:rgba(255,255,255,.06); border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase;">SECCIONES QUE PUEDE VER</div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="marcarSecciones(true)"  style="background:#CCE5FF; color:#004085; border:none; border-radius:6px; padding:4px 10px; font-weight:800; font-size:11px; cursor:pointer;">TODAS</button>
                        <button type="button" onclick="marcarSecciones(false)" style="background:#E2E3E5; color:#333; border:none; border-radius:6px; padding:4px 10px; font-weight:800; font-size:11px; cursor:pointer;">NINGUNA</button>
                    </div>
                </div>
                <div id="cuSecAviso" style="display:${esAdm ? "block" : "none"}; font-size:12px; color:#9ED1F7; font-weight:700; margin-bottom:10px;">
                    👑 El administrador ve todas las secciones, además de Cuentas y Registros.
                </div>
                <div id="cuSecLista" style="display:flex; flex-wrap:wrap; gap:10px 24px; ${esAdm ? "opacity:.5; pointer-events:none;" : ""}">${chkSecs}</div>
            </div>

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${edit
                    ? `<button class="guardar-btn" onclick="guardarEdicionCuenta('${c.id}')">GUARDAR CAMBIOS</button>
                       <button class="guardar-btn" style="background:#E2E3E5; color:#333;" onclick="mostrarCuentas()">CANCELAR</button>`
                    : `<button class="guardar-btn" onclick="crearCuenta()">CREAR CUENTA</button>`}
            </div>
        </div>
    `;
}

// Muestra/oculta campos según los roles tildados
function actualizarFormCuenta() {
    const roles = Array.from(document.querySelectorAll(".cuRol:checked")).map(x => x.value);
    const esTec = roles.includes("tecnico");
    const esVen = roles.includes("vendedor");
    const esAdm = roles.includes("administrador");

    document.getElementById("cuBoxTec").style.display = esTec ? "flex" : "none";
    document.getElementById("cuBoxVen").style.display = esVen ? "flex" : "none";

    const marca = (esTec || esVen) ? "*" : "";
    document.getElementById("cuReqNombre").textContent   = marca;
    document.getElementById("cuReqApellido").textContent = marca;
    document.getElementById("cuReqDoc").textContent      = marca;

    document.getElementById("cuSecAviso").style.display = esAdm ? "block" : "none";
    const lista = document.getElementById("cuSecLista");
    lista.style.opacity       = esAdm ? ".5" : "";
    lista.style.pointerEvents = esAdm ? "none" : "";
}

function marcarSecciones(valor) {
    document.querySelectorAll(".cuSec").forEach(x => { x.checked = valor; });
}

// Lee y valida el formulario. Devuelve null si hay algún error (ya avisó).
function leerFormCuenta(idActual) {
    const roles = Array.from(document.querySelectorAll(".cuRol:checked")).map(x => x.value);
    if (roles.length === 0) { alert("ELEGÍ AL MENOS UN ROL."); return null; }

    const esTec = roles.includes("tecnico");
    const esVen = roles.includes("vendedor");
    const esAdm = roles.includes("administrador");

    const nombre    = capitalizar(document.getElementById("cuNombre").value.trim());
    const apellido  = capitalizar(document.getElementById("cuApellido").value.trim());
    const documento = document.getElementById("cuDocumento").value.trim();
    const telefono  = leerTel("cuTelefono");

    if ((esTec || esVen) && (!nombre || !apellido || !documento)) {
        alert("PARA TÉCNICOS Y VENDEDORES COMPLETÁ NOMBRE, APELLIDO Y DOCUMENTO.");
        return null;
    }

    let comisionTecnico = 0, comisionVendedor = 0;
    if (esTec) {
        comisionTecnico = Number(document.getElementById("cuComTec").value);
        if (document.getElementById("cuComTec").value === "" || isNaN(comisionTecnico) || comisionTecnico < 0 || comisionTecnico > 100) {
            alert("INGRESÁ UN PORCENTAJE VÁLIDO POR REPARACIÓN (0-100)."); return null;
        }
    }
    if (esVen) {
        comisionVendedor = Number(document.getElementById("cuComVen").value);
        if (document.getElementById("cuComVen").value === "" || isNaN(comisionVendedor) || comisionVendedor < 0 || comisionVendedor > 100) {
            alert("INGRESÁ UN PORCENTAJE VÁLIDO POR VENTA CERRADA (0-100)."); return null;
        }
    }

    // El documento no puede repetirse con otro empleado
    if ((esTec || esVen) && documento) {
        const dup = tecnicos.find(t => t.documento === documento && t.cuentaId !== idActual);
        if (dup) { alert("YA EXISTE UN TÉCNICO O VENDEDOR CON ESE DOCUMENTO."); return null; }
    }

    const secciones = esAdm
        ? SECCIONES.map(x => x.key)
        : Array.from(document.querySelectorAll(".cuSec:checked")).map(x => x.value);

    return { roles, secciones, nombre, apellido, documento, telefono, comisionTecnico, comisionVendedor,
             rol: esAdm ? "admin" : "usuario" };
}

// Mantiene la lista "tecnicos" alineada con las cuentas técnico/vendedor
function sincronizarEmpleadoCuenta(cuenta) {
    const esTec = (cuenta.roles || []).includes("tecnico");
    const esVen = (cuenta.roles || []).includes("vendedor");
    let emp = tecnicos.find(t => t.cuentaId === cuenta.id);

    if (esTec || esVen) {
        if (!emp) {
            emp = { id: "tec_" + Date.now(), cuentaId: cuenta.id };
            tecnicos.push(emp);
        }
        emp.nombre          = cuenta.nombre || cuenta.usuario;
        emp.apellido        = cuenta.apellido || "";
        emp.documento       = cuenta.documento || "";
        emp.telefono        = cuenta.telefono || "";
        emp.roles           = [esTec ? "tecnico" : null, esVen ? "vendedor" : null].filter(Boolean);
        emp.porcentaje      = esTec ? cuenta.comisionTecnico : 0;
        emp.porcentajeVenta = esVen ? cuenta.comisionVendedor : 0;
    } else if (emp) {
        quitarEmpleadoDeCuenta(emp);
    }
    guardarTecnicos();
}

// Si el empleado ya tiene órdenes o movimientos se conserva el historial
function quitarEmpleadoDeCuenta(emp) {
    const tieneHistorial =
        ordenes.some(o => o.tecnicoId === emp.id) ||
        facturacionExtra.some(f => f.tecnicoId === emp.id) ||
        pagosTecnicos.some(p => p.tecnicoId === emp.id);

    if (tieneHistorial) {
        emp.cuentaId = null;
        emp.roles = ["tecnico"];
        emp.porcentajeVenta = 0;
    } else {
        tecnicos = tecnicos.filter(t => t.id !== emp.id);
    }
}

function mostrarCuentas() {
    if (!verificarAcceso()) return;
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    // Marcar botón activo (índice -1 porque es dinámico, usamos clase manual)
    document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("activo"));
    document.querySelectorAll(".btn-dinamico").forEach(b => {
        if (b.textContent === "Cuentas") b.classList.add("activo");
    });

    guardarRegistro("CUENTAS", "VER", "Accedió a la sección Cuentas");

    const lista = getCuentas().filter(c => c.usuario !== "Admin");

    let filas = "";
    if (lista.length === 0) {
        filas = `<tr><td colspan="5" style="text-align:center; color:#888;">NO HAY CUENTAS CREADAS</td></tr>`;
    } else {
        lista.forEach(c => {
            const roles = (c.roles && c.roles.length ? c.roles : ["gerente"]);
            const badges = roles.map(r => `
                <span style="background:#CCE5FF; color:#004085; border-radius:20px; padding:3px 12px; font-size:11px; font-weight:800; text-transform:uppercase; display:inline-block; margin:2px 4px 2px 0;">${etiquetaRol(r)}</span>`).join("");

            const coms = [];
            if (roles.includes("tecnico"))  coms.push(`Técnico: ${c.comisionTecnico ?? 0}% por reparación`);
            if (roles.includes("vendedor")) coms.push(`Vendedor: ${c.comisionVendedor ?? 0}% por venta`);

            const secs = roles.includes("administrador")
                ? "Todas"
                : (Array.isArray(c.secciones)
                    ? (c.secciones.length ? c.secciones.map(k => SECCIONES.find(x => x.key === k)?.label || k).join(", ") : "Ninguna")
                    : "Todas (cuenta anterior)");

            filas += `
                <tr>
                    <td style="font-weight:700;">${escapeHTML(c.usuario)}${c.email ? "" : `<div style="font-size:11px; color:#F5B7B1; font-weight:800;">SIN ACCESO — USÁ "CAMBIAR PASS" PARA HABILITARLA</div>`}${c.nombre ? `<div style="font-size:12px; color:#9ED1F7; font-weight:600;">${escapeHTML(c.nombre)} ${escapeHTML(c.apellido || "")}</div>` : ""}</td>
                    <td>${badges}</td>
                    <td style="font-size:12px;">${coms.length ? coms.join("<br>") : "-"}</td>
                    <td style="font-size:12px; max-width:220px;">${escapeHTML(secs)}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button
                            onclick="editarCuenta('${c.id}')"
                            style="background:#D4EDDA; color:#155724; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer; margin-right:6px;"
                        >EDITAR</button>
                        <button
                            onclick="cambiarPasswordCuenta('${c.id}')"
                            style="background:#CCE5FF; color:#004085; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer; margin-right:6px;"
                        >CAMBIAR PASS</button>
                        <button
                            onclick="eliminarCuenta('${c.id}')"
                            style="background:#F8D7DA; color:#721C24; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer;"
                        >ELIMINAR</button>
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById("contenido").innerHTML = `

        <h1>CUENTAS</h1>

        <h2>CREAR NUEVA CUENTA</h2>

        ${formCuentaHTML(null)}

        <br>

        <h2>CUENTAS EXISTENTES</h2>

        <div style="
            background:rgba(158,209,247,.08);
            border:1px solid rgba(158,209,247,.2);
            border-radius:10px; padding:12px 16px;
            margin-bottom:20px; max-width:900px;
            font-size:13px; color:#9ED1F7; font-weight:600;
        ">
            👑 La cuenta <strong>Admin</strong> es fija y no puede ser eliminada (su contraseña se cambia desde Firebase → Authentication).
            Cada cuenta ve solo las secciones que tildes. Los técnicos y vendedores
            creados acá aparecen automáticamente en la sección Técnicos.
        </div>

        <div style="overflow-x:auto; max-width:1000px;">
        <table>
            <thead>
                <tr>
                    <th>USUARIO</th>
                    <th>ROLES</th>
                    <th>COMISIÓN</th>
                    <th>SECCIONES</th>
                    <th style="text-align:center;">ACCIONES</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>
        </div>

    `;
}


async function crearCuenta() {
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    const usuario = document.getElementById("cuUsuario").value.trim();
    const pass1   = document.getElementById("cuPass").value;
    const pass2   = document.getElementById("cuPass2").value;

    if (!usuario || !pass1 || !pass2) {
        alert("COMPLETÁ USUARIO Y CONTRASEÑA."); return;
    }
    if (pass1 !== pass2) {
        alert("LAS CONTRASEÑAS NO COINCIDEN."); return;
    }
    if (pass1.length < 6) {
        alert("LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES."); return;
    }
    if (/[\/@]/.test(usuario)) {
        alert("EL USUARIO NO PUEDE LLEVAR / NI @."); return;
    }

    const cuentas = getCuentas();
    if (cuentas.find(c => c.usuario.toLowerCase() === usuario.toLowerCase())) {
        alert("YA EXISTE UNA CUENTA CON ESE NOMBRE DE USUARIO."); return;
    }

    const datos = leerFormCuenta(null);
    if (!datos) return;

    const nueva = { id: "usr_" + Date.now(), usuario, ...datos };
    try {
        await darAccesoEmpleado(nueva, pass1);
    } catch (e) {
        console.error(e);
        alert(textoErrorCuenta(e)); return;
    }
    cuentas.push(nueva);

    guardarCuentas(cuentas);
    sincronizarEmpleadoCuenta(nueva);
    guardarRegistro("CUENTAS", "CREAR", `Creó la cuenta: ${usuario} (${datos.roles.map(etiquetaRol).join(", ")})`);
    alert(`CUENTA "${usuario}" CREADA EXITOSAMENTE.`);
    mostrarCuentas();
}


function editarCuenta(id) {
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    const cuenta = getCuentas().find(c => c.id === id);
    if (!cuenta) return;

    // Cuentas anteriores sin roles: se las trata como gerente
    const c = { ...cuenta, roles: cuenta.roles && cuenta.roles.length ? cuenta.roles : ["gerente"] };

    document.getElementById("contenido").innerHTML = `
        <h1>EDITAR CUENTA</h1>
        ${formCuentaHTML(c)}
    `;
}


async function guardarEdicionCuenta(id) {
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    const cuentas = getCuentas();
    const cuenta  = cuentas.find(c => c.id === id);
    if (!cuenta) return;

    const datos = leerFormCuenta(id);
    if (!datos) return;

    Object.assign(cuenta, datos);

    if (cuenta.email) {
        try {
            await db.collection("staff").doc(cuenta.email).set(
                { usuario: cuenta.usuario, admin: cuenta.rol === "admin", t: Date.now() }, { merge: true });
        } catch (e) { console.error(e); }
    }

    guardarCuentas(cuentas);
    sincronizarEmpleadoCuenta(cuenta);
    guardarRegistro("CUENTAS", "EDITAR", `Editó la cuenta: ${cuenta.usuario} (${datos.roles.map(etiquetaRol).join(", ")})`);
    alert("CUENTA ACTUALIZADA.");
    mostrarCuentas();
}


async function eliminarCuenta(id) {
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    const cuentas = getCuentas();
    const cuenta  = cuentas.find(c => c.id === id);
    if (!cuenta) return;
    if (cuenta.usuario === "Admin") { alert("NO SE PUEDE ELIMINAR LA CUENTA ADMIN."); return; }

    if (!confirm(`¿SEGURO QUE QUERÉS ELIMINAR LA CUENTA "${cuenta.usuario}"?`)) return;

    try {
        await quitarAccesoEmpleado(cuenta);
    } catch (e) {
        console.error(e);
        alert("NO SE PUDO QUITAR EL ACCESO. REVISÁ LA CONEXIÓN."); return;
    }

    const emp = tecnicos.find(t => t.cuentaId === id);
    if (emp) { quitarEmpleadoDeCuenta(emp); guardarTecnicos(); }

    guardarCuentas(cuentas.filter(c => c.id !== id));
    guardarRegistro("CUENTAS", "ELIMINAR", `Eliminó la cuenta: ${cuenta.usuario}`);
    mostrarCuentas();
}


async function cambiarPasswordCuenta(id) {
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    const cuentas = getCuentas();
    const cuenta  = cuentas.find(c => c.id === id);
    if (!cuenta) return;

    const nueva = prompt(`NUEVA CONTRASEÑA PARA "${cuenta.usuario}" (MÍNIMO 6 CARACTERES):`);
    if (nueva === null) return;
    if (nueva.trim().length < 6) {
        alert("LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES."); return;
    }

    try {
        await darAccesoEmpleado(cuenta, nueva.trim());
    } catch (e) {
        console.error(e);
        alert(textoErrorCuenta(e)); return;
    }
    guardarCuentas(cuentas);
    guardarRegistro("CUENTAS", "CAMBIAR PASS", `Cambió contraseña de: ${cuenta.usuario}`);
    alert("CONTRASEÑA ACTUALIZADA.");
    mostrarCuentas();
}


// ── SECCIÓN REGISTROS (solo admin) ───────────

function mostrarRegistros() {
    if (!verificarAcceso()) return;
    if (!esAdmin()) { alert("ACCESO DENEGADO"); return; }

    document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("activo"));
    document.querySelectorAll(".btn-dinamico").forEach(b => {
        if (b.textContent === "Registros") b.classList.add("activo");
    });

    guardarRegistro("REGISTROS", "VER", "Accedió a la sección Registros");

    renderRegistros();
}


function renderRegistros() {
    const todos      = getRegistros().slice().reverse(); // más reciente primero
    const usuarios   = [...new Set(todos.map(r => r.usuario))];
    const secciones  = [...new Set(todos.map(r => r.seccion))];

    const filtroUsuario  = document.getElementById("filtroRegUsuario")?.value  || "";
    const filtroSeccion  = document.getElementById("filtroRegSeccion")?.value  || "";
    const filtroBusqueda = document.getElementById("filtroRegBusqueda")?.value?.toLowerCase() || "";
    const filtroTipo     = document.getElementById("filtroRegTipo")?.value || "";

    let filtrados = todos;
    if (filtroTipo === "visitas")  filtrados = filtrados.filter(r => r.accion === "VER");
    if (filtroTipo === "acciones") filtrados = filtrados.filter(r => r.accion !== "VER");
    if (filtroUsuario)  filtrados = filtrados.filter(r => r.usuario === filtroUsuario);
    if (filtroSeccion)  filtrados = filtrados.filter(r => r.seccion === filtroSeccion);
    if (filtroBusqueda) filtrados = filtrados.filter(r =>
        r.accion.toLowerCase().includes(filtroBusqueda) ||
        r.detalle.toLowerCase().includes(filtroBusqueda) ||
        r.usuario.toLowerCase().includes(filtroBusqueda)
    );

    let filas = "";
    if (filtrados.length === 0) {
        filas = `<tr><td colspan="5" style="text-align:center; color:#888;">SIN REGISTROS</td></tr>`;
    } else {
        filtrados.slice(0, 500).forEach(r => {
            const esVisita = r.accion === "VER";
            const badgeAccion = esVisita
                ? `<span style="background:rgba(255,255,255,.08); color:#aaa; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:800;">👁 VIO</span>`
                : `<span style="background:rgba(76,175,80,.2); color:#8FE39A; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:800; text-transform:uppercase;">✎ ${escapeHTML(r.accion)}</span>`;
            filas += `
                <tr>
                    <td style="font-size:12px; color:#aaa;">${escapeHTML(r.fecha)}</td>
                    <td style="font-weight:700; color:#9ED1F7;">${escapeHTML(r.usuario)}</td>
                    <td>
                        <span style="
                            background:rgba(158,209,247,.15);
                            color:#9ED1F7;
                            border-radius:20px; padding:2px 10px;
                            font-size:11px; font-weight:800; text-transform:uppercase;
                        ">${escapeHTML(r.seccion)}</span>
                    </td>
                    <td>${badgeAccion}</td>
                    <td style="font-size:13px; color:${esVisita ? "#999" : "#eee"};">${escapeHTML(r.detalle)}</td>
                </tr>
            `;
        });
    }

    const optsUsuario = ["", ...usuarios].map(u =>
        `<option value="${u}" ${u === filtroUsuario ? "selected" : ""}>${u || "TODOS LOS USUARIOS"}</option>`
    ).join("");

    const optsSeccion = ["", ...secciones].map(s =>
        `<option value="${s}" ${s === filtroSeccion ? "selected" : ""}>${s || "TODAS LAS SECCIONES"}</option>`
    ).join("");

    document.getElementById("contenido").innerHTML = `

        <h1>REGISTROS DE ACTIVIDAD</h1>

        <div style="
            display:grid;
            grid-template-columns:1fr 1fr 1fr 2fr;
            gap:12px;
            max-width:900px;
            margin-bottom:20px;
        ">
            <div class="campo">
                <label>USUARIO</label>
                <select id="filtroRegUsuario" onchange="renderRegistros()" style="color:black; padding:10px; border:none; border-radius:8px; font-size:13px; font-weight:700;">
                    ${optsUsuario}
                </select>
            </div>
            <div class="campo">
                <label>SECCIÓN</label>
                <select id="filtroRegSeccion" onchange="renderRegistros()" style="color:black; padding:10px; border:none; border-radius:8px; font-size:13px; font-weight:700;">
                    ${optsSeccion}
                </select>
            </div>
            <div class="campo">
                <label>TIPO</label>
                <select id="filtroRegTipo" onchange="renderRegistros()" style="color:black; padding:10px; border:none; border-radius:8px; font-size:13px; font-weight:700;">
                    <option value="" ${filtroTipo === "" ? "selected" : ""}>TODO</option>
                    <option value="acciones" ${filtroTipo === "acciones" ? "selected" : ""}>SOLO ACCIONES (lo que hizo)</option>
                    <option value="visitas" ${filtroTipo === "visitas" ? "selected" : ""}>SOLO VISITAS (lo que vio)</option>
                </select>
            </div>
            <div class="campo">
                <label>BUSCAR</label>
                <input
                    type="text"
                    id="filtroRegBusqueda"
                    placeholder="BUSCAR EN ACCIÓN O DETALLE..."
                    oninput="renderRegistros()"
                    style="text-transform:uppercase;"
                    value="${filtroBusqueda.toUpperCase()}"
                >
            </div>
        </div>

        <div style="
            font-size:12px; color:#9ED1F7; font-weight:700;
            margin-bottom:12px; text-transform:uppercase;
        ">
            ${filtrados.length > 500 ? "Mostrando los últimos 500 registros" : `${filtrados.length} registro${filtrados.length !== 1 ? "s" : ""}`}
        </div>

        <table>
            <thead>
                <tr>
                    <th>FECHA Y HORA</th>
                    <th>USUARIO</th>
                    <th>SECCIÓN</th>
                    <th>QUÉ HIZO</th>
                    <th>DETALLE</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>

    `;
}