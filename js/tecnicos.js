// =============================================
// TÉCNICOS
// Cada técnico: { id, nombre, apellido, documento, telefono, porcentaje }
// =============================================


// =============================================
// FACTURACIÓN EXTRA DE TÉCNICOS
// Para ventas, desbloqueos u otros cobros sin orden
// Cada item: { id, tecnicoId, fecha, detalle, monto, metodoPago }
// =============================================

// Los técnicos viejos no tienen "roles": se los considera técnicos.
function esTecnico(t){ return !t.roles || t.roles.includes("tecnico"); }
function esVendedor(t){ return !!t.roles && t.roles.includes("vendedor"); }

function guardarFacturacionExtra(){
    guardarClave("facturacionExtra");
}

// =============================================
// PAGOS A TÉCNICOS
// Cada pago: { id, tecnicoId, fecha, monto, metodoPago }
// =============================================

function guardarPagosTecnicos(){
    guardarClave("pagosTecnicos");
}

// Devuelve cuánto le queda por cobrar a un técnico en una fecha (DD/MM/YYYY)
function saldoPendienteTecnico(tecId, dia){
    const tec = tecnicos.find(t => t.id === tecId);
    if(!tec) return 0;

    // Reparaciones del día
    const repDia = ordenes.filter(o =>
        o.tecnicoId === tecId &&
        o.ganTecnico !== undefined &&
        (o.fechaCobro || o.fechaUltimaModificacion || "").split(",")[0].trim() === dia
    ).reduce((acc, o) => acc + (o.ganTecnico || 0), 0);

    // Extras del día
    const extrasDia = facturacionExtra
        .filter(f => f.tecnicoId === tecId && f.fecha === dia)
        .reduce((acc, f) => acc + f.monto, 0);

    const ganado = redondear500(repDia) + extrasDia;

    // Pagos ya realizados ese día
    const pagado = pagosTecnicos
        .filter(p => p.tecnicoId === tecId && p.fecha === dia)
        .reduce((acc, p) => acc + p.monto, 0);

    return Math.max(0, ganado - pagado);
}

function guardarTecnicos(){
    guardarClave("tecnicos");
}


function mostrarTecnicos(){
    if (!verificarAcceso()) return;
    guardarRegistro("TÉCNICOS", "VER", "Accedió a Técnicos");
    activarBoton(7); // 8vo botón del menú (índice 7)
    renderTecnicos();
}

function etiquetasEmpleado(t){
    const r = [];
    if(esTecnico(t))  r.push("Técnico");
    if(esVendedor(t)) r.push("Vendedor");
    return r.join(" · ");
}

function comisionesEmpleado(t){
    const r = [];
    if(esTecnico(t))  r.push(`${t.porcentaje}% por reparación`);
    if(esVendedor(t)) r.push(`${t.porcentajeVenta ?? 0}% por venta`);
    return r.join("<br>");
}

function renderTecnicos(){

    const hoy = obtenerFechaArgentina().split(",")[0].trim();

    let filas = "";

    if(tecnicos.length === 0){
        filas = `
            <tr>
                <td colspan="6" style="text-align:center; color:#888;">
                    NO HAY TÉCNICOS REGISTRADOS
                </td>
            </tr>
        `;
    } else {
        tecnicos.forEach(t => {

            const saldo = saldoPendienteTecnico(t.id, hoy);

            const colorTotal = saldo > 0 ? "#155724" : "#555";
            const bgTotal    = saldo > 0 ? "#D4EDDA"  : "transparent";

            filas += `
                <tr onclick="abrirTecnico('${t.id}')" style="cursor:pointer;">
                    <td>${t.nombre} ${t.apellido}<div style="font-size:11px; color:#9ED1F7; font-weight:700;">${etiquetasEmpleado(t)}</div></td>
                    <td>${t.documento}</td>
                    <td>${ftTel(t.telefono)}</td>
                    <td style="text-align:center; font-weight:800; color:#004085; font-size:12px;">${comisionesEmpleado(t)}</td>
                    <td style="text-align:center; font-weight:800; color:${colorTotal}; background:${bgTotal};">
                        ${saldo > 0 ? `$${saldo}` : "-"}
                    </td>
                    <td style="text-align:center;" onclick="event.stopPropagation()">
                        ${saldo > 0 ? `
                        <button
                            onclick="abrirModalPago('${t.id}', '${hoy}', 'lista')"
                            style="background:#D4EDDA; color:#155724; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer; margin-right:6px;"
                        >PAGAR</button>` : ""}
                        ${t.cuentaId ? `<span style="font-size:11px; color:#9ED1F7; font-weight:700;">SE EDITA EN CUENTAS</span>` : `
                        <button
                            onclick="editarTecnico('${t.id}')"
                            style="background:#CCE5FF; color:#004085; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer; margin-right:6px;"
                        >EDITAR</button>
                        <button
                            onclick="eliminarTecnico('${t.id}')"
                            style="background:#F8D7DA; color:#721C24; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer;"
                        >X</button>`}
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById("contenido").innerHTML = `

        <h1>TÉCNICOS Y VENDEDORES</h1>

        <div style="
            background:rgba(158,209,247,.08);
            border:1px solid rgba(158,209,247,.2);
            border-radius:10px; padding:12px 16px;
            margin-bottom:20px; max-width:800px;
            font-size:13px; color:#9ED1F7; font-weight:600;
        ">
            Los técnicos y vendedores nuevos se crean desde la sección <strong>Cuentas</strong>,
            eligiendo el rol y el porcentaje que cobra cada uno.
        </div>

        <h2>PERSONAL REGISTRADO</h2>

        <table>
            <thead>
                <tr>
                    <th>NOMBRE Y APELLIDO</th>
                    <th>DOCUMENTO</th>
                    <th>TELÉFONO</th>
                    <th style="text-align:center;">COMISIÓN</th>
                    <th style="text-align:center;">A COBRAR HOY</th>
                    <th style="text-align:center;">ACCIONES</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>

    `;
}


function guardarTecnico(){

    const nombre      = capitalizar(document.getElementById("tecNombre").value.trim());
    const apellido    = capitalizar(document.getElementById("tecApellido").value.trim());
    const documento   = document.getElementById("tecDocumento").value.trim();
    const telefono    = leerTel("tecTelefono");
    const porcentaje  = Number(document.getElementById("tecPorcentaje").value);

    if(!nombre || !apellido || !documento || isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100){
        alert("COMPLETÁ TODOS LOS CAMPOS OBLIGATORIOS Y UN PORCENTAJE VÁLIDO (0-100).");
        return;
    }

    const yaExiste = tecnicos.find(t => t.documento === documento);
    if(yaExiste){
        alert("YA EXISTE UN TÉCNICO CON ESE DOCUMENTO.");
        return;
    }

    tecnicos.push({
        id:          "tec_" + Date.now(),
        nombre,
        apellido,
        documento,
        telefono,
        porcentaje
    });

    guardarTecnicos();
    renderTecnicos();
}


function eliminarTecnico(id){
    const emp = tecnicos.find(t => t.id === id);
    if(emp && emp.cuentaId){ alert("ESTE EMPLEADO SE ADMINISTRA DESDE CUENTAS."); return; }
    if(!confirm("¿SEGURO QUE QUERÉS ELIMINAR ESTE TÉCNICO?")) return;
    if(emp) guardarRegistro("TÉCNICOS", "ELIMINAR TÉCNICO", `${emp.nombre} ${emp.apellido}`);
    tecnicos = tecnicos.filter(t => t.id !== id);
    guardarTecnicos();
    renderTecnicos();
}


function editarTecnico(id){

    const t = tecnicos.find(t => t.id === id);
    if(!t) return;
    if(t.cuentaId){ alert("ESTE EMPLEADO SE ADMINISTRA DESDE CUENTAS."); return; }

    document.getElementById("contenido").innerHTML = `

        <h1>EDITAR TÉCNICO</h1>

        <div class="formulario" style="max-width:800px;">

            <div class="fila">
                <div class="campo">
                    <label>NOMBRE *</label>
                    <input type="text" id="editNombre" value="${t.nombre}">
                </div>
                <div class="campo">
                    <label>APELLIDO *</label>
                    <input type="text" id="editApellido" value="${t.apellido}">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>N° DE DOCUMENTO *</label>
                    <input type="text" id="editDocumento" value="${t.documento}">
                </div>
                <div class="campo">
                    <label>TELÉFONO</label>
                    <input type="text" id="editTelefono" value="${t.telefono || ""}">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>PORCENTAJE DE GANANCIA (%) *</label>
                    <input type="number" id="editPorcentaje" min="0" max="100" value="${t.porcentaje}">
                </div>
                <div class="campo"><!-- espacio --></div>
            </div>

            <div style="display:flex; gap:12px;">
                <button class="guardar-btn" onclick="confirmarEdicionTecnico('${id}')">
                    GUARDAR CAMBIOS
                </button>
                <button
                    class="guardar-btn"
                    style="background:#E2E3E5; color:#333;"
                    onclick="mostrarTecnicos()"
                >
                    CANCELAR
                </button>
            </div>

        </div>

    `;
}


function confirmarEdicionTecnico(id){

    const t = tecnicos.find(t => t.id === id);
    if(!t) return;

    const nombre     = capitalizar(document.getElementById("editNombre").value.trim());
    const apellido   = capitalizar(document.getElementById("editApellido").value.trim());
    const documento  = document.getElementById("editDocumento").value.trim();
    const telefono   = leerTel("editTelefono");
    const porcentaje = Number(document.getElementById("editPorcentaje").value);

    if(!nombre || !apellido || !documento || isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100){
        alert("COMPLETÁ TODOS LOS CAMPOS OBLIGATORIOS Y UN PORCENTAJE VÁLIDO (0-100).");
        return;
    }

    // Verificar que el nuevo documento no pertenezca a otro técnico
    const duplicado = tecnicos.find(tech => tech.documento === documento && tech.id !== id);
    if(duplicado){
        alert("YA EXISTE OTRO TÉCNICO CON ESE DOCUMENTO.");
        return;
    }

    guardarRegistro("TÉCNICOS", "EDITAR TÉCNICO",
        `${t.nombre} ${t.apellido}` + (t.porcentaje !== porcentaje ? ` — porcentaje ${t.porcentaje}% → ${porcentaje}%` : " — datos personales"));

    t.nombre     = nombre;
    t.apellido   = apellido;
    t.documento  = documento;
    t.telefono   = telefono;
    t.porcentaje = porcentaje;

    guardarTecnicos();
    mostrarTecnicos();
}


function abrirTecnico(id){
    window._tecActivoId = id;
    verTecnico(id);
}


// ─────────────────────────────────────────────
// REDONDEO A MÚLTIPLOS DE 500
// < 500 → 0, cualquier fracción de 500 → redondea
// ─────────────────────────────────────────────
function redondear500(valor){
    if(valor < 250) return 0;           // menos de medio tramo → 0
    return Math.round(valor / 500) * 500;
}


// ─────────────────────────────────────────────
// VER DETALLE DE UN TÉCNICO
// ─────────────────────────────────────────────
function verTecnico(id){

    const tec = tecnicos.find(t => t.id === id);
    if(!tec){ alert("TÉCNICO NO ENCONTRADO"); return; }

    const hoy = obtenerFechaArgentina().split(",")[0].trim(); // "DD/MM/YYYY"

    // Órdenes asignadas a este técnico que ya están entregadas (tienen ganTecnico calculado)
    const ordenesDelTec = ordenes.filter(o => o.tecnicoId === id && o.ganTecnico !== undefined);

    // Órdenes de hoy
    const ordenesHoy = ordenesDelTec.filter(o => {
        const fechaOrden = (o.fechaCobro || o.fechaUltimaModificacion || "").split(",")[0].trim();
        return fechaOrden === hoy;
    });

    const totalHoyRaw     = ordenesHoy.reduce((acc, o) => acc + (o.ganTecnico || 0), 0);
    const extrasHoy       = facturacionExtra
        .filter(f => f.tecnicoId === id && f.fecha === hoy)
        .reduce((acc, f) => acc + f.monto, 0);
    const totalHoy        = redondear500(totalHoyRaw) + extrasHoy;
    const totalHoySinExtra = redondear500(totalHoyRaw);
    const cantHoy         = ordenesHoy.length;

    // ── Filas de equipos de hoy ──────────────────
    let filasHoy = "";
    if(ordenesHoy.length === 0){
        filasHoy = `<tr><td colspan="5" style="text-align:center; color:#888;">SIN REPARACIONES HOY</td></tr>`;
    } else {
        ordenesHoy.forEach(o => {
            const ganRedondeada = redondear500(o.ganTecnico);
            filasHoy += `
                <tr onclick="verOrden(${o.id})" style="cursor:pointer;">
                    <td>${o.numero}</td>
                    <td>${o.cliente.nombre} ${o.cliente.apellido}</td>
                    <td>${o.equipo.marca} ${o.equipo.modelo}</td>
                    <td style="text-align:right;">$${o.trabajo.presupuesto}</td>
                    <td style="text-align:right; font-weight:800; color:#155724;">$${ganRedondeada}</td>
                </tr>
            `;
        });
    }

    // ── Agrupado por día (historial) ─────────────
    const porDia = {};
    ordenesDelTec.forEach(o => {
        const dia = (o.fechaCobro || o.fechaUltimaModificacion || "").split(",")[0].trim();
        if(!dia) return;
        if(!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(o);
    });

    // También incluir días que solo tienen facturación extra
    facturacionExtra.filter(f => f.tecnicoId === id).forEach(f => {
        if(!porDia[f.fecha]) porDia[f.fecha] = [];
    });

    const diasOrdenados = Object.keys(porDia).sort((a, b) => {
        const parse = f => { const [d,m,y] = f.split("/"); return new Date(`${y}-${m}-${d}`); };
        return parse(b) - parse(a);
    });

    document.getElementById("contenido").innerHTML = `

        <h1>${tec.nombre} ${tec.apellido}</h1>

        <div class="info-orden" style="margin-bottom:24px;">
            <div><strong>DNI:</strong> ${tec.documento}</div>
            <div><strong>TELÉFONO:</strong> ${ftTel(tec.telefono)}</div>
            <div><strong>COMISIÓN:</strong> ${comisionesEmpleado(tec).replace("<br>", " | ")}</div>
        </div>

        <!-- RESUMEN HOY -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px; max-width:700px;">
            <div style="background:white; color:black; border-radius:12px; padding:20px; border-left:6px solid #9ED1F7;">
                <div style="font-size:13px; font-weight:700; color:#555; margin-bottom:6px;">EQUIPOS HOY</div>
                <div style="font-size:32px; font-weight:800; color:#1F2A44;">${cantHoy}</div>
            </div>
            <div style="background:white; color:black; border-radius:12px; padding:20px; border-left:6px solid #4CAF50;">
                <div style="font-size:13px; font-weight:700; color:#555; margin-bottom:6px;">A COBRAR HOY</div>
                <div style="font-size:32px; font-weight:800; color:#155724;" id="saldoHoyDisplay">$${saldoPendienteTecnico(id, hoy)}</div>
                ${extrasHoy > 0 ? `<div style="font-size:11px; color:#888; margin-top:2px;">reparaciones: $${totalHoySinExtra} + extras: $${extrasHoy}</div>` : (totalHoyRaw !== totalHoySinExtra ? `<div style="font-size:11px; color:#888; margin-top:2px;">sin redondear: $${totalHoyRaw}</div>` : "")}
                ${totalHoy > 0 ? `
                <button
                    onclick="abrirModalPago('${id}', '${hoy}', 'perfil')"
                    style="margin-top:12px; background:#155724; color:white; border:none; border-radius:8px; padding:8px 18px; font-weight:800; font-size:13px; cursor:pointer; text-transform:uppercase; width:100%;"
                >💸 PAGAR AHORA</button>` : ""}
            </div>
        </div>

        <h2>REPARACIONES DE HOY</h2>

        <table style="margin-bottom:32px;">
            <thead>
                <tr>
                    <th>N° ORDEN</th>
                    <th>CLIENTE</th>
                    <th>EQUIPO</th>
                    <th style="text-align:right;">PRESUPUESTO</th>
                    <th style="text-align:right;">GANANCIA TÉCNICO</th>
                </tr>
            </thead>
            <tbody>${filasHoy}</tbody>
        </table>

        <h2>HISTORIAL POR DÍA</h2>

        <div class="campo" style="max-width:300px; margin-bottom:20px;">
            <input
                type="text"
                id="buscadorDiaTec"
                placeholder="FILTRAR POR DÍA (DD/MM/AAAA)..."
                oninput="filtrarHistorialTecnico('${id}')"
                style="text-transform:uppercase;"
            >
        </div>

        <div id="tablaDiasTec">
            ${renderTablaDiasTecnico(diasOrdenados, porDia, id)}
        </div>

        <br>

        <!-- ══════════════════════════════════════════
             FACTURACIÓN EXTRA (ventas, desbloqueos, etc.)
             ══════════════════════════════════════════ -->
        <h2>FACTURACIÓN EXTRA</h2>
        <p style="font-size:13px; color:#9ED1F7; margin-bottom:16px; font-weight:600;">
            VENTAS, DESBLOQUEOS U OTROS COBROS SIN ORDEN DE REPARACIÓN
        </p>

        <!-- FORMULARIO NUEVA ENTRADA -->
        <div class="formulario" style="max-width:800px; background:rgba(255,255,255,.06); border-radius:12px; padding:20px; margin-bottom:24px;">

            <div class="fila">
                <div class="campo">
                    <label>FECHA *</label>
                    <input type="date" id="extraFecha" value="${new Date().toLocaleDateString('en-CA', {timeZone:'America/Argentina/Buenos_Aires'})}">
                </div>
                <div class="campo">
                    <label>MONTO *</label>
                    <input type="number" id="extraMonto" min="0" placeholder="0">
                </div>
            </div>

            <div class="campo" style="margin-bottom:15px;">
                <label>DETALLE *</label>
                <input type="text" id="extraDetalle" placeholder="Ej: Desbloqueo Samsung A54, Venta auriculares...">
            </div>

            <div class="fila">
                <div class="campo">
                    <label>MÉTODO DE PAGO</label>
                    <select id="extraMetodo" style="padding:12px; border:none; border-radius:8px; font-family:'Inter',sans-serif; font-size:14px; font-weight:700; text-transform:uppercase;">
                        <option value="EFECTIVO">EFECTIVO</option>
                        <option value="MP">MERCADO PAGO</option>
                        <option value="DEBITO">DÉBITO</option>
                        <option value="CREDITO">CRÉDITO</option>
                        <option value="-">-</option>
                    </select>
                </div>
                <div class="campo" style="justify-content:flex-end;">
                    <label style="opacity:0;">.</label>
                    <button class="guardar-btn" style="margin-top:0; width:100%;" onclick="agregarFacturacionExtra('${id}')">
                        + AGREGAR
                    </button>
                </div>
            </div>

        </div>

        <!-- TABLA DE ENTRADAS EXTRA -->
        <div id="tablaFacturacionExtra" style="max-width:900px;">
            ${renderFacturacionExtra(id)}
        </div>

        <br>
        <button
            class="guardar-btn"
            style="background:#E2E3E5; color:#333;"
            onclick="mostrarTecnicos()"
        >VOLVER</button>

    `;
}


function renderTablaDiasTecnico(diasOrdenados, porDia, tecId){

    if(diasOrdenados.length === 0){
        return `<p style="color:#888;">SIN HISTORIAL REGISTRADO</p>`;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>FECHA</th>
                    <th style="text-align:center;">EQUIPOS</th>
                    <th style="text-align:right;">GANANCIA TOTAL</th>
                </tr>
            </thead>
            <tbody id="tbodyDiasTec">
    `;

    diasOrdenados.forEach(dia => {
        const ords        = porDia[dia] || [];
        const cant        = ords.length;
        const totalR      = ords.reduce((acc, o) => acc + (o.ganTecnico || 0), 0);
        const totalRep    = redondear500(totalR);
        const extrasDelDia = tecId
            ? facturacionExtra.filter(f => f.tecnicoId === tecId && f.fecha === dia).reduce((acc, f) => acc + f.monto, 0)
            : 0;
        const total       = totalRep + extrasDelDia;

        const detalle = extrasDelDia > 0
            ? `<span style="font-size:11px; color:#888; font-weight:400;"> (rep: $${totalRep} + extra: $${extrasDelDia})</span>`
            : (totalR !== totalRep ? `<span style="font-size:11px; color:#888; font-weight:400;"> (${totalR})</span>` : "");

        // Pagos ya realizados ese día
        const pagadoDia = tecId
            ? pagosTecnicos.filter(p => p.tecnicoId === tecId && p.fecha === dia).reduce((acc, p) => acc + p.monto, 0)
            : 0;
        const saldoDia = Math.max(0, total - pagadoDia);

        const estadoPago = pagadoDia > 0
            ? (saldoDia === 0
                ? `<span style="background:#D4EDDA; color:#155724; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:800; margin-left:6px;">✓ PAGADO</span>`
                : `<span style="background:#FFF3CD; color:#856404; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:800; margin-left:6px;">PARCIAL $${saldoDia}</span>`)
            : "";

        html += `
            <tr onclick="verDetalleDiaTecnico('${dia}')" style="cursor:pointer;">
                <td style="font-weight:700;">${dia}</td>
                <td style="text-align:center; font-weight:700;">${cant}</td>
                <td style="text-align:right; font-weight:800; color:#155724; background:#D4EDDA;">
                    $${total} ${detalle} ${estadoPago}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    return html;
}


function filtrarHistorialTecnico(tecId){

    const txt = document.getElementById("buscadorDiaTec").value.trim().toLowerCase();

    const ordenesDelTec = ordenes.filter(o => o.tecnicoId === tecId && o.ganTecnico !== undefined);

    const porDia = {};
    ordenesDelTec.forEach(o => {
        const dia = (o.fechaCobro || o.fechaUltimaModificacion || "").split(",")[0].trim();
        if(!dia) return;
        if(!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(o);
    });

    // Incluir también días que solo tienen extras
    facturacionExtra.filter(f => f.tecnicoId === tecId).forEach(f => {
        if(!porDia[f.fecha]) porDia[f.fecha] = [];
    });

    let dias = Object.keys(porDia).sort((a, b) => {
        const parse = f => { const [d,m,y] = f.split("/"); return new Date(`${y}-${m}-${d}`); };
        return parse(b) - parse(a);
    });

    if(txt) dias = dias.filter(d => d.includes(txt));

    document.getElementById("tablaDiasTec").innerHTML = renderTablaDiasTecnico(dias, porDia, tecId);
}


// ─────────────────────────────────────────────
// PAGAR TÉCNICO — modal de pago
// origen: 'lista' (vuelve a renderTecnicos) | 'perfil' (vuelve a verTecnico)
// ─────────────────────────────────────────────
function abrirModalPago(tecId, dia, origen){

    const tec    = tecnicos.find(t => t.id === tecId);
    if(!tec) return;

    const saldo  = saldoPendienteTecnico(tecId, dia);
    if(saldo <= 0){
        alert("NO HAY SALDO PENDIENTE PARA PAGAR.");
        return;
    }

    // Crear overlay modal
    const overlay = document.createElement("div");
    overlay.id = "modalPagoOverlay";
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,.65);
        display:flex; justify-content:center; align-items:center; z-index:9999;
    `;

    overlay.innerHTML = `
        <div style="
            background:#1F2A44; color:white; border-radius:16px;
            padding:32px; width:420px; max-width:90vw;
            box-shadow:0 20px 60px rgba(0,0,0,.5);
        ">
            <h2 style="margin:0 0 6px; font-size:20px; font-weight:800; text-transform:uppercase; color:#9ED1F7;">
                PAGAR A ${tec.nombre} ${tec.apellido}
            </h2>
            <p style="font-size:13px; color:#aaa; margin:0 0 24px;">Fecha: ${dia}</p>

            <div style="background:rgba(255,255,255,.07); border-radius:10px; padding:16px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; font-weight:700; color:#aaa; text-transform:uppercase;">Saldo pendiente</span>
                <span style="font-size:28px; font-weight:800; color:#D4EDDA;">$${saldo}</span>
            </div>

            <div class="campo" style="margin-bottom:16px;">
                <label style="font-size:12px; font-weight:700; color:#aaa; margin-bottom:6px; display:block; text-transform:uppercase;">Monto a pagar *</label>
                <input
                    type="number" id="modalMontoPago" min="1" max="${saldo}" value="${saldo}"
                    style="width:100%; padding:12px; border:none; border-radius:8px; font-size:18px; font-weight:800; font-family:'Inter',sans-serif;"
                >
            </div>

            <div class="campo" style="margin-bottom:24px;">
                <label style="font-size:12px; font-weight:700; color:#aaa; margin-bottom:8px; display:block; text-transform:uppercase;">Método de pago *</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <button
                        id="btnEfectivo"
                        onclick="seleccionarMetodoPago('EFECTIVO')"
                        style="padding:14px; border:2px solid #4CAF50; border-radius:10px; background:#D4EDDA; color:#155724; font-weight:800; font-size:14px; cursor:pointer; text-transform:uppercase;"
                    >💵 EFECTIVO</button>
                    <button
                        id="btnMP"
                        onclick="seleccionarMetodoPago('MP')"
                        style="padding:14px; border:2px solid #aaa; border-radius:10px; background:rgba(255,255,255,.08); color:white; font-weight:800; font-size:14px; cursor:pointer; text-transform:uppercase;"
                    >📱 MERCADO PAGO</button>
                </div>
            </div>

            <div style="display:flex; gap:12px;">
                <button
                    onclick="confirmarPago('${tecId}', '${dia}', '${origen}')"
                    style="flex:1; padding:14px; background:#4CAF50; color:white; border:none; border-radius:10px; font-weight:800; font-size:15px; cursor:pointer; text-transform:uppercase;"
                >✓ CONFIRMAR PAGO</button>
                <button
                    onclick="cerrarModalPago()"
                    style="padding:14px 20px; background:rgba(255,255,255,.1); color:white; border:none; border-radius:10px; font-weight:800; font-size:15px; cursor:pointer;"
                >✕</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Efectivo seleccionado por defecto
    window._metodoPagoSeleccionado = "EFECTIVO";
}

function seleccionarMetodoPago(metodo){
    window._metodoPagoSeleccionado = metodo;
    const btnEfectivo = document.getElementById("btnEfectivo");
    const btnMP       = document.getElementById("btnMP");
    if(!btnEfectivo || !btnMP) return;

    if(metodo === "EFECTIVO"){
        btnEfectivo.style.borderColor = "#4CAF50";
        btnEfectivo.style.background  = "#D4EDDA";
        btnEfectivo.style.color       = "#155724";
        btnMP.style.borderColor       = "#aaa";
        btnMP.style.background        = "rgba(255,255,255,.08)";
        btnMP.style.color             = "white";
    } else {
        btnMP.style.borderColor       = "#2196F3";
        btnMP.style.background        = "#CCE5FF";
        btnMP.style.color             = "#004085";
        btnEfectivo.style.borderColor = "#aaa";
        btnEfectivo.style.background  = "rgba(255,255,255,.08)";
        btnEfectivo.style.color       = "white";
    }
}

function cerrarModalPago(){
    const overlay = document.getElementById("modalPagoOverlay");
    if(overlay) overlay.remove();
}

function confirmarPago(tecId, dia, origen){

    const montoPago = Number(document.getElementById("modalMontoPago").value);
    const metodo    = window._metodoPagoSeleccionado || "EFECTIVO";
    const saldo     = saldoPendienteTecnico(tecId, dia);
    const tec       = tecnicos.find(t => t.id === tecId);

    if(!montoPago || montoPago <= 0){
        alert("INGRESÁ UN MONTO VÁLIDO.");
        return;
    }
    if(montoPago > saldo){
        alert(`EL MONTO NO PUEDE SER MAYOR AL SALDO PENDIENTE ($${saldo}).`);
        return;
    }

    const nombreTec = tec ? `${tec.nombre} ${tec.apellido}` : "Técnico";

    // Registrar el pago
    pagosTecnicos.push({
        id:         "pag_" + Date.now(),
        tecnicoId:  tecId,
        fecha:      dia,
        monto:      montoPago,
        metodoPago: metodo
    });
    guardarPagosTecnicos();

    // Registrar como EGRESO en caja global (monto negativo)
    registrarMovimientoCaja({
        fecha:       obtenerFechaArgentina(),
        tipo:        "EGRESO",
        descripcion: `Pago técnico ${nombreTec} — ${dia}`,
        monto:       -montoPago,
        metodoPago:  metodo
    });

    guardarRegistro("TÉCNICOS", "PAGO A EMPLEADO",
        `Pagó $${fm(montoPago)} a ${nombreTec} en ${metodo} (día ${dia})`);

    cerrarModalPago();

    // Volver a renderizar la pantalla de origen
    if(origen === "perfil"){
        verTecnico(tecId);
    } else {
        renderTecnicos();
    }
}
function renderFacturacionExtra(tecId){

    const items = facturacionExtra
        .filter(f => f.tecnicoId === tecId)
        .slice()
        .reverse(); // más reciente primero

    if(items.length === 0){
        return `<p style="color:#888; font-size:13px;">SIN REGISTROS AÚN</p>`;
    }

    let filas = "";
    items.forEach(f => {
        filas += `
            <tr>
                <td style="font-weight:700;">${f.fecha}</td>
                <td>${f.detalle}</td>
                <td>
                    <span style="background:#E2E3E5; color:#333; border-radius:20px; padding:3px 10px; font-size:12px; font-weight:700;">
                        ${f.metodoPago || "-"}
                    </span>
                </td>
                <td style="text-align:right; font-weight:800; color:#155724; background:#D4EDDA; font-size:16px;">
                    +$${f.monto}
                </td>
                <td style="text-align:center;">
                    <button
                        onclick="eliminarFacturacionExtra('${f.id}', '${tecId}')"
                        style="background:#F8D7DA; color:#721C24; border:none; border-radius:6px; padding:4px 10px; font-weight:800; cursor:pointer;"
                    >X</button>
                </td>
            </tr>
        `;
    });

    const totalExtra = facturacionExtra
        .filter(f => f.tecnicoId === tecId)
        .reduce((acc, f) => acc + f.monto, 0);

    return `
        <table>
            <thead>
                <tr>
                    <th>FECHA</th>
                    <th>DETALLE</th>
                    <th>MÉTODO</th>
                    <th style="text-align:right;">MONTO</th>
                    <th style="text-align:center;">ELIMINAR</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
            <tfoot>
                <tr style="background:#D4EDDA; color:#155724;">
                    <td colspan="3" style="font-weight:800; text-transform:uppercase; padding:12px 15px;">TOTAL ACUMULADO</td>
                    <td style="text-align:right; font-weight:800; font-size:18px; padding:12px 15px;">+$${totalExtra}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    `;
}


// ─────────────────────────────────────────────
// FACTURACIÓN EXTRA — agregar registro
// ─────────────────────────────────────────────
function agregarFacturacionExtra(tecId){

    const fechaInput  = document.getElementById("extraFecha").value.trim();
    const detalle     = capitalizar(document.getElementById("extraDetalle").value.trim());
    const monto       = Number(document.getElementById("extraMonto").value);
    const metodoPago  = document.getElementById("extraMetodo").value;

    if(!fechaInput || !detalle || isNaN(monto) || monto <= 0){
        alert("COMPLETÁ FECHA, DETALLE Y MONTO (mayor a 0).");
        return;
    }

    // Convertir fecha input (YYYY-MM-DD) a formato DD/MM/YYYY
    const [y, mo, d] = fechaInput.split("-");
    const fechaFormateada = `${d}/${mo}/${y}`;

    const tec = tecnicos.find(t => t.id === tecId);
    const nombreTec = tec ? `${tec.nombre} ${tec.apellido}` : "Técnico";

    const nuevoItem = {
        id:         "fex_" + Date.now(),
        tecnicoId:  tecId,
        fecha:      fechaFormateada,
        detalle,
        monto,
        metodoPago
    };

    facturacionExtra.push(nuevoItem);
    guardarFacturacionExtra();
    guardarRegistro("TÉCNICOS", "FACTURACIÓN EXTRA", `${nombreTec}: ${detalle} — $${fm(monto)} (${fechaFormateada})`);

    // Limpiar campos
    document.getElementById("extraDetalle").value = "";
    document.getElementById("extraMonto").value   = "";

    // Re-render solo la tabla
    document.getElementById("tablaFacturacionExtra").innerHTML = renderFacturacionExtra(tecId);
}


// ─────────────────────────────────────────────
// FACTURACIÓN EXTRA — eliminar registro
// ─────────────────────────────────────────────
function eliminarFacturacionExtra(itemId, tecId){
    if(!confirm("¿SEGURO QUE QUERÉS ELIMINAR ESTE REGISTRO?")) return;
    const _fex = facturacionExtra.find(f => f.id === itemId);
    if(_fex){
        const _t = tecnicos.find(t => t.id === _fex.tecnicoId);
        guardarRegistro("TÉCNICOS", "ELIMINAR FACTURACIÓN EXTRA",
            `${_t ? _t.nombre + " " + _t.apellido : "Empleado"}: ${_fex.detalle} — $${fm(_fex.monto)} (${_fex.fecha})`);
    }
    facturacionExtra = facturacionExtra.filter(f => f.id !== itemId);
    guardarFacturacionExtra();
    document.getElementById("tablaFacturacionExtra").innerHTML = renderFacturacionExtra(tecId);
}

// ─────────────────────────────────────────────
// DETALLE DE REPARACIONES DE UN DÍA (de un técnico)
// ─────────────────────────────────────────────
function verDetalleDiaTecnico(dia){

    // Encontrar el técnico activo leyendo las órdenes del día
    const ordensDia = ordenes.filter(o =>
        o.ganTecnico !== undefined &&
        (o.fechaCobro || o.fechaUltimaModificacion || "").split(",")[0].trim() === dia
    );

    // Puede haber órdenes de distintos técnicos; agrupamos por tecnicoId para el detalle
    // pero esta pantalla se llama desde verTecnico, así que guardamos el id activo
    // en un parámetro de la URL no es posible sin router, así que usamos window._tecActivoId
    const tecId = window._tecActivoId;
    const tec   = tecnicos.find(t => t.id === tecId);

    const ordensFiltradas = tecId
        ? ordensDia.filter(o => o.tecnicoId === tecId)
        : ordensDia;

    const totalRaw = ordensFiltradas.reduce((acc, o) => acc + (o.ganTecnico || 0), 0);
    const total    = redondear500(totalRaw);

    let items = "";
    ordensFiltradas.forEach(o => {
        const gan = redondear500(o.ganTecnico);
        items += `
            <div style="
                background:white; color:black; border-radius:10px; padding:14px 18px;
                display:grid; grid-template-columns:1fr auto auto;
                gap:16px; align-items:center;
                border-left:5px solid #4CAF50;
                margin-bottom:10px; cursor:pointer;
            " onclick="verOrden(${o.id})">
                <div>
                    <div style="font-weight:700; font-size:14px;">Orden #${o.numero} — ${o.cliente.nombre} ${o.cliente.apellido}</div>
                    <div style="font-size:12px; color:#888; margin-top:2px;">${o.equipo.marca} ${o.equipo.modelo} · Presupuesto: $${o.trabajo.presupuesto}</div>
                </div>
                <div style="background:#E2E3E5; color:#333; border-radius:20px; padding:4px 12px; font-size:12px; font-weight:700;">
                    ${o.metodoPago || "-"}
                </div>
                <div style="font-size:18px; font-weight:800; color:#155724; background:#D4EDDA; padding:6px 14px; border-radius:8px; white-space:nowrap;">
                    $${gan}
                </div>
            </div>
        `;
    });

    document.getElementById("contenido").innerHTML = `

        <h1>REPARACIONES DEL ${dia}${tec ? ` — ${tec.nombre} ${tec.apellido}` : ""}</h1>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px; max-width:600px;">
            <div style="background:white; color:black; border-radius:12px; padding:20px; border-left:6px solid #9ED1F7;">
                <div style="font-size:13px; font-weight:700; color:#555; margin-bottom:6px;">EQUIPOS</div>
                <div style="font-size:32px; font-weight:800; color:#1F2A44;">${ordensFiltradas.length}</div>
            </div>
            <div style="background:white; color:black; border-radius:12px; padding:20px; border-left:6px solid #4CAF50;">
                <div style="font-size:13px; font-weight:700; color:#555; margin-bottom:6px;">TOTAL A COBRAR</div>
                <div style="font-size:32px; font-weight:800; color:#155724;">$${total}</div>
                ${totalRaw !== total ? `<div style="font-size:11px; color:#888; margin-top:4px;">sin redondear: $${totalRaw}</div>` : ""}
            </div>
        </div>

        <h2>DETALLE DE REPARACIONES</h2>

        <div style="max-width:800px;">
            ${items || `<p style="color:#888;">SIN REPARACIONES PARA ESTE DÍA</p>`}
        </div>

        <br>
        <button
            class="guardar-btn"
            style="background:#E2E3E5; color:#333;"
            onclick="verTecnico('${tecId || ""}')"
        >VOLVER</button>

    `;
}
