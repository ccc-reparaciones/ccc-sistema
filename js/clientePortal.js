// =============================================
// clientePortal.js
// Portal de seguimiento para CLIENTES.
// Se muestra dentro de #contenido cuando la sesión activa
// es una sesión de cliente (ver auth.js → setSesionCliente).
//
// Reutiliza datos y helpers ya globales del resto de la app:
//   - `ordenes`  (storage.js)
//   - `tecnicos` (tecnicos.js)
//   - fm(), ftTel() (fechas.js)
// =============================================

// ═══════════════════════════════════════════
// TELÉFONO DEL LOCAL — editá este número
// Solo dígitos, sin el 0 ni el 15, con código de país
// Ej Argentina: 5491140615429
// ═══════════════════════════════════════════
const LOCAL_WHATSAPP = "5491173740412"; // 11 7374-0412

// Pasos del flujo (excluye datos internos, solo lo que el cliente necesita saber)
const PASOS_CLIENTE = [
    { key: "INGRESADO",            label: "Ingresado"    },
    { key: "EN REVISION",          label: "En revisión"  },
    { key: "PRESUPUESTO ENVIADO",  label: "Presupuesto"  },
    { key: "EN REPARACION",        label: "En reparación"},
    { key: "LISTO",                label: "Listo"        },
    { key: "ENTREGADO",            label: "Entregado"    }
];

// Convierte "EN REPARACION" → "en-reparacion"
function clienteEstadoClass(estado){
    return estado.replace(/ /g,"-").toLowerCase();
}

function clienteRender(html){
    const app = document.getElementById("appCliente");
    if (app) app.innerHTML = html;
}

// ─── PANTALLA PRINCIPAL DEL PORTAL ───────────
// Se llama luego de un login exitoso como cliente, o al recargar
// la página si ya había una sesión de cliente activa.
function mostrarPortalCliente(){
    const sesion = getSesionCliente();
    if (!sesion) { mostrarLogin(); return; }

    const contenido = document.getElementById("contenido");
    contenido.classList.add("portal-cliente");
    contenido.innerHTML = `
        <div class="header">
            <img class="logo-portal" src="${LOGO_BLANCO}" alt="CCC Reparación de Celulares">
            <div class="header-text">
                <p>Portal de seguimiento de reparaciones</p>
            </div>
        </div>
        <div id="appCliente"></div>
    `;

    clienteMostrarMisOrdenes();
}

// ─── SELECCIÓN DE ORDEN ──────────────────
function clienteMostrarMisOrdenes(){
    const sesion = getSesionCliente();
    if (!sesion) { mostrarLogin(); return; }

    const mis = ordenes.filter(o =>
        String(o.cliente.documento).replace(/\./g,"") === sesion.dni
    );

    if(mis.length === 0){
        clienteRender(`
            <div class="top-bar">
                <div class="top-bar-info">Hola, <strong>${sesion.nombre}</strong></div>
                <button class="btn-logout" onclick="cerrarSesionCliente()">Salir</button>
            </div>
            <div class="card no-orders">
                <div class="icon">📭</div>
                <h3>No encontramos órdenes</h3>
                <p>No hay órdenes asociadas a tu documento en este momento.</p>
            </div>
        `);
        return;
    }

    if(mis.length === 1){
        // Si solo hay una orden, ir directo
        clienteMostrarOrden(mis[0].id);
        return;
    }

    let botones = "";
    mis.forEach(o => {
        botones += `
            <div class="orden-btn" onclick="clienteMostrarOrden(${o.id})">
                <div>
                    <div class="num">ORDEN N° ${o.numero} — ${o.fechaCreacion}</div>
                    <div class="eq">${o.equipo.marca} ${o.equipo.modelo}</div>
                </div>
                <span class="estado-pill estado-${clienteEstadoClass(o.estado)}">${o.estado}</span>
            </div>
        `;
    });

    clienteRender(`
        <div class="top-bar">
            <div class="top-bar-info">Hola, <strong>${sesion.nombre}</strong></div>
            <button class="btn-logout" onclick="cerrarSesionCliente()">Salir</button>
        </div>

        <div class="card">
            <div class="section-title">Tus órdenes</div>
            <div class="orden-selector">
                ${botones}
            </div>
        </div>
    `);
}

// ─── DETALLE DE ORDEN ────────────────────
function clienteMostrarOrden(id){
    const sesion = getSesionCliente();
    if (!sesion) { mostrarLogin(); return; }

    const o = ordenes.find(ord => ord.id === id);

    if(!o || String(o.cliente.documento).replace(/\./g,"") !== sesion.dni){
        clienteRender(`<div class="card"><p style="color:#E74C3C;">Orden no encontrada.</p></div>`);
        return;
    }

    // Técnico asignado (solo nombre, sin %)
    let tecnicoHTML = `<span style="color:var(--muted); font-size:13px;">Sin asignar aún</span>`;
    if(o.tecnicoId){
        const tec = tecnicos.find(t => t.id === o.tecnicoId);
        if(tec){
            tecnicoHTML = `
                <span class="tecnico-badge">
                    <span class="tecnico-dot"></span>
                    ${tec.nombre} ${tec.apellido}
                </span>
            `;
        }
    }

    // Progress tracker
    const esSinSolucion = o.estado === "SIN SOLUCION";
    let progressHTML = "";

    if(esSinSolucion){
        progressHTML = `
            <div style="
                background:var(--danger-bg);
                border:1px solid var(--danger);
                border-radius:10px;
                padding:14px 18px;
                font-size:13px;
                color:var(--danger);
                font-weight:600;
                margin-bottom:20px;
            ">
                ⚠️ No fue posible reparar el equipo. Por favor acercate al local para coordinar la devolución.
            </div>
        `;
    } else {
        const idxActual = PASOS_CLIENTE.findIndex(p => p.key === o.estado);

        let steps = "";
        PASOS_CLIENTE.forEach((paso, i) => {
            const esDone    = i < idxActual;
            const esCurrent = i === idxActual;

            const dotClass = esDone ? "done" : esCurrent ? "current" : "";
            const lblClass = esDone || esCurrent ? (esDone ? "done" : "current") : "";

            if(i > 0){
                steps += `<div class="step-connector ${esDone ? 'done' : ''}"></div>`;
            }

            steps += `
                <div class="step">
                    <div class="step-dot ${dotClass}">
                        ${esDone ? "✓" : (i + 1)}
                    </div>
                    <div class="step-label ${lblClass}">${paso.label}</div>
                </div>
            `;
        });

        progressHTML = `<div class="progress-track">${steps}</div>`;
    }

    // Saldo restante
    const pres    = o.trabajo.presupuesto || 0;
    const adelanto = o.trabajo.adelanto   || 0;
    const saldo   = Math.max(0, pres - adelanto);

    // Observaciones del técnico (solo si hay algo escrito)
    let obsHTML = "";
    if(o.trabajo.observaciones){
        obsHTML = `
            <div class="card" style="margin-bottom:16px;">
                <div class="section-title">Diagnóstico / Trabajo realizado</div>
                <div class="obs-box">${o.trabajo.observaciones}</div>
            </div>
        `;
    }

    // Historial (filtrado: no mostramos tipos internos)
    const historialPublico = (o.historial || []).filter(h =>
        h.tipo !== "COBRO_INTERNO"
    );

    let histHTML = "";
    if(historialPublico.length === 0){
        histHTML = `<p class="empty">Aún no hay cambios registrados.</p>`;
    } else {
        const revertido = [...historialPublico].reverse();
        histHTML = `<div class="historial-list">`;
        revertido.forEach((h, i) => {
            histHTML += `
                <div class="historial-item">
                    <div class="hist-dot ${i === revertido.length-1 ? 'primer' : ''}"></div>
                    <div style="flex:1; min-width:0;">
                        <div class="hist-tipo">${h.tipo}</div>
                        <div class="hist-detalle">${h.detalle}</div>
                    </div>
                    <div class="hist-fecha">${h.fecha}</div>
                </div>
            `;
        });
        histHTML += `</div>`;
    }

    // Tiene múltiples órdenes?
    const todasLasOrdenes = ordenes.filter(ord =>
        String(ord.cliente.documento).replace(/\./g,"") === sesion.dni
    );
    const botonVolver = todasLasOrdenes.length > 1
        ? `<button class="btn-back" onclick="clienteMostrarMisOrdenes()">← Mis órdenes</button>`
        : "";

    clienteRender(`
        <div class="top-bar">
            <div class="top-bar-info">Hola, <strong>${sesion.nombre}</strong></div>
            <button class="btn-logout" onclick="cerrarSesionCliente()">Salir</button>
        </div>

        <div class="card">

            <div class="orden-header">
                <div>
                    <div class="orden-numero">ORDEN N° ${o.numero} · ${o.fechaCreacion}</div>
                    <div class="orden-titulo">${o.equipo.marca} ${o.equipo.modelo}</div>
                </div>
                <span class="estado-pill estado-${clienteEstadoClass(o.estado)}">${o.estado}</span>
            </div>

            ${progressHTML}

            <div class="section-title">Técnico asignado</div>
            <div style="margin-bottom:24px;">${tecnicoHTML}</div>

            <div class="section-title">Datos del equipo</div>
            <div class="info-grid" style="margin-bottom:24px;">
                <div class="info-cell">
                    <div class="lbl">Marca</div>
                    <div class="val">${o.equipo.marca}</div>
                </div>
                <div class="info-cell">
                    <div class="lbl">Modelo</div>
                    <div class="val">${o.equipo.modelo}</div>
                </div>
                <div class="info-cell">
                    <div class="lbl">Color</div>
                    <div class="val">${o.equipo.color}</div>
                </div>
                <div class="info-cell">
                    <div class="lbl">IMEI</div>
                    <div class="val">${o.equipo.imei || "—"}</div>
                </div>
            </div>

            <div class="section-title">Falla reportada</div>
            <div class="obs-box" style="margin-bottom:24px;">${o.trabajo.fallaReportada}</div>

            <div class="section-title">Presupuesto</div>
            <div class="monto-grid" style="margin-bottom:8px;">
                <div class="monto-card">
                    <div class="lbl">Total</div>
                    <div class="num">$${fm(pres)}</div>
                </div>
                <div class="monto-card">
                    <div class="lbl">Adelanto</div>
                    <div class="num">$${fm(adelanto)}</div>
                </div>
                <div class="monto-card saldo">
                    <div class="lbl">Saldo restante</div>
                    <div class="num">$${fm(saldo)}</div>
                </div>
            </div>

        </div>

        ${obsHTML}

        <div class="card">
            <div class="section-title">Historial de cambios</div>
            ${histHTML}
        </div>

        <div class="card" style="margin-bottom:16px;">
            <div class="section-title">¿Tenés alguna consulta?</div>
            <p style="font-size:13px; color:var(--muted); margin-bottom:16px; line-height:1.6;">
                Envianos un mensaje por WhatsApp y te respondemos a la brevedad.
            </p>
            <a
                href="https://wa.me/${LOCAL_WHATSAPP}?text=${encodeURIComponent(`Hola, mi nombre es ${o.cliente.nombre} ${o.cliente.apellido}, me comunico por la orden N° ${o.numero}. Mi consulta era la siguiente: `)}"
                target="_blank"
                style="
                    display:inline-flex;
                    align-items:center;
                    gap:10px;
                    background:#25D366;
                    color:white;
                    text-decoration:none;
                    padding:13px 22px;
                    border-radius:10px;
                    font-family:'Sora',sans-serif;
                    font-size:14px;
                    font-weight:700;
                    text-transform:uppercase;
                    letter-spacing:.5px;
                    transition:opacity .2s, transform .15s;
                "
                onmouseover="this.style.opacity='.88';this.style.transform='translateY(-1px)'"
                onmouseout="this.style.opacity='1';this.style.transform='translateY(0)'"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Consultar por WhatsApp
            </a>
        </div>

        <div class="card" style="margin-bottom:16px;">
            <div class="section-title">Términos y condiciones</div>

            <div style="display:flex; flex-direction:column; gap:14px;">

                <div style="display:flex; gap:14px; align-items:flex-start;">
                    <div style="font-size:20px; flex-shrink:0; margin-top:2px;">🔧</div>
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px;">Garantía de Reparación</div>
                        <div style="font-size:13px; color:var(--muted); line-height:1.6;">Los equipos tienen 30 días de garantía sobre la reparación realizada, únicamente por fallas relacionadas con el servicio efectuado.</div>
                    </div>
                </div>

                <div style="border-top:1px solid var(--border);"></div>

                <div style="display:flex; gap:14px; align-items:flex-start;">
                    <div style="font-size:20px; flex-shrink:0; margin-top:2px;">🚫</div>
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px;">Exclusiones de Garantía</div>
                        <div style="font-size:13px; color:var(--muted); line-height:1.6;">No se cubren bajo garantía: equipos mojados o que no puedan ser revisados en el momento de la entrega; sistemas operativos, desbloqueos o cualquier modificación de software.</div>
                    </div>
                </div>

                <div style="border-top:1px solid var(--border);"></div>

                <div style="display:flex; gap:14px; align-items:flex-start;">
                    <div style="font-size:20px; flex-shrink:0; margin-top:2px;">📦</div>
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px;">Equipos Abandonados</div>
                        <div style="font-size:13px; color:var(--muted); line-height:1.6;">Los equipos que permanezcan más de 60 días en el local sin retiro serán considerados abandonados y pasarán a ser propiedad del local.</div>
                    </div>
                </div>

                <div style="border-top:1px solid var(--border);"></div>

                <div style="display:flex; gap:14px; align-items:flex-start;">
                    <div style="font-size:20px; flex-shrink:0; margin-top:2px;">💾</div>
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px;">Responsabilidad sobre Contenido</div>
                        <div style="font-size:13px; color:var(--muted); line-height:1.6;">Ni el local ni los técnicos se hacen responsables por pérdida de datos, información personal o contenido almacenado en los equipos.</div>
                    </div>
                </div>

                <div style="border-top:1px solid var(--border);"></div>

                <div style="display:flex; gap:14px; align-items:flex-start;">
                    <div style="font-size:20px; flex-shrink:0; margin-top:2px;">✅</div>
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px;">Revisión y Aceptación</div>
                        <div style="font-size:13px; color:var(--muted); line-height:1.6;">Al dejar su equipo, el cliente acepta estos términos y condiciones.</div>
                    </div>
                </div>

            </div>
        </div>

        ${botonVolver}
    `);
}
