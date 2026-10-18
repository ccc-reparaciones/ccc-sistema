// =============================================
// app.js — arranque de la app
// Los datos viven en Firestore: primero se verifica la sesión y
// se descargan los datos, y recién después se muestra la pantalla.
// =============================================

// Permisos por sección (envuelve las funciones mostrar*)
aplicarPermisos();

// Productos publicados en la página principal (los puede ver cualquiera)
cargarProductosPublicos();

function mostrarCargando() {
    document.getElementById("contenido").innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center;
                    height:100vh; font-size:15px; font-weight:700;
                    letter-spacing:1px; color:#9ED1F7; text-transform:uppercase;">
            Cargando datos…
        </div>`;
}

function esperarUsuarioFirebase() {
    return new Promise(resolve => {
        const quitar = auth.onAuthStateChanged(u => { quitar(); resolve(u); });
    });
}

(async function arrancar() {
    const sesion        = getSesion();
    const sesionCliente = getSesionCliente();

    // ── Personal con sesión abierta (recarga de la página) ──
    if (sesion) {
        mostrarCargando();
        try {
            await authListo;
            const usuarioFirebase = await esperarUsuarioFirebase();
            if (!usuarioFirebase) throw new Error("sin sesión de Firebase");

            await cargarDatosNube();
            getCuentas();
            const cuenta = cuentas.find(c => c.id === sesion.id);
            if (!cuenta) throw new Error("la cuenta ya no existe");

            setSesion(cuenta);
            activarListeners();
            document.querySelector(".sidebar").style.display = "flex";
            actualizarSidebar();
            irAPrimeraSeccion();
            mostrarBotonMenu(true);
        } catch (e) {
            console.error("No se pudo restaurar la sesión:", e);
            sessionStorage.removeItem("sesionCCC");
            limpiarDatosEnMemoria();
            try { await auth.signOut(); } catch (_) {}
            mostrarLogin();
            mostrarBotonMenu(false);
        }
        return;
    }

    // ── Cliente con sesión abierta ──
    if (sesionCliente) {
        mostrarCargando();
        let ok = false;
        try { ok = await cargarPortalCliente(sesionCliente.clave); } catch (e) { console.error(e); }
        if (ok) {
            document.querySelector(".sidebar").style.display = "none";
            mostrarBotonMenu(false);
            mostrarPortalCliente();
        } else {
            sessionStorage.removeItem("sesionClienteCCC");
            mostrarLogin();
            mostrarBotonMenu(false);
        }
        return;
    }

    mostrarLogin();
    mostrarBotonMenu(false);
})();

// ── BOTÓN ACTIVO EN EL SIDEBAR ────────────────
function activarBoton(indice) {
    document.querySelectorAll(".sidebar button").forEach(btn => btn.classList.remove("activo"));
    const botones = document.querySelectorAll(".sidebar button");
    if (botones[indice]) botones[indice].classList.add("activo");
    document.querySelectorAll(".btn-dinamico").forEach(b => b.classList.remove("activo"));
}


// ── AJUSTE AUTOMÁTICO DE TABLAS ───────────────
// Envuelve cada tabla en un contenedor deslizable (para que nunca se corte)
// y marca las columnas angostas (N°, ID, cantidad...) para que no se estiren.
function ajustarTablas() {
    const cont = document.getElementById("contenido");
    if (!cont) return;

    cont.querySelectorAll("table").forEach(t => {
        const padre = t.parentElement;
        if (padre && !padre.classList.contains("tabla-wrapper")) {
            const ox = getComputedStyle(padre).overflowX;
            if (ox !== "auto" && ox !== "scroll") {
                const w = document.createElement("div");
                w.className = "tabla-wrapper";
                padre.insertBefore(w, t);
                w.appendChild(t);
            }
        }

        t.querySelectorAll("thead th").forEach(th => {
            const txt = th.textContent.trim().toUpperCase();
            if (txt === "" || /^(N°|N° ORDEN|ID|#|X|ELIMINAR|CANTIDAD|CANT\.?|STOCK)$/.test(txt)) {
                th.classList.add("col-min");
            }
        });
    });
}

(function () {
    const cont = document.getElementById("contenido");
    if (!cont || typeof MutationObserver === "undefined") return;

    let timer = null;
    const obs = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            obs.disconnect();
            ajustarTablas();
            obs.observe(cont, { childList: true, subtree: true });
        }, 0);
    });
    obs.observe(cont, { childList: true, subtree: true });
    ajustarTablas();
})();