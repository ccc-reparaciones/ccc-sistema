// =============================================
// DATOS DEL LOCAL — EDITÁ ESTOS VALORES
// =============================================
const LOCAL_TELEFONO   = "1173740412"; // 11 7374-0412
const LOCAL_DIRECCION  = "";          // Ej: "Av. Siempreviva 742, CABA"
const LOCAL_NOMBRE     = "CCC Reparación de Celulares";
const LOCAL_SEGUIMIENTO = "www.CCCreparaciones.com.ar/seguimiento"; // Portal del cliente
// =============================================


function capitalizar(texto){
    return texto
        .toLowerCase()
        .split(" ")
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" ");
}

// Una orden está CERRADA cuando está LISTO (esperando cobro) o ENTREGADO (cobrada).
// Cerrada: no se puede cambiar nada, salvo las observaciones del técnico.
function ordenCerrada(o){
    return o.estado === "LISTO" || o.estado === "ENTREGADO";
}

// Solo el administrador puede reabrir una orden LISTO que todavía no se cobró
// (por si se marcó LISTO por error).
function puedeReabrirOrden(o){
    return o.estado === "LISTO" && !o.cobrada && esAdmin();
}

function verOrden(id){
    if (!verificarAcceso()) return;

    const orden = ordenes.find(o => o.id === id);

    if(!orden){
        alert("ORDEN NO ENCONTRADA");
        return;
    }

    const observaciones = orden.trabajo.observaciones || "";
    const cerrada = ordenCerrada(orden);
    const bloqEstado = cerrada && !puedeReabrirOrden(orden);
    const historial = orden.historial || [];

    let filasHistorial = "";

    if(historial.length === 0){
        filasHistorial = `
            <tr>
                <td colspan="3" style="text-align:center;color:#888;">
                    SIN CAMBIOS REGISTRADOS
                </td>
            </tr>
        `;
    } else {
        [...historial].reverse().forEach(cambio => {
            filasHistorial += `
                <tr>
                    <td>${cambio.fecha}</td>
                    <td>${cambio.tipo}</td>
                    <td>${cambio.detalle}</td>
                </tr>
            `;
        });
    }

    document.getElementById("contenido").innerHTML = `

        <h1>ORDEN N° ${orden.numero}</h1>

        ${cerrada ? `
        <div style="background:rgba(231,76,60,.12); border:1px solid rgba(231,76,60,.45); border-radius:10px;
                    padding:12px 16px; margin-bottom:18px; max-width:700px; font-size:13px; font-weight:700; color:#F5B7B1;">
            🔒 ORDEN CERRADA (${orden.estado}). Ya no se puede modificar nada, excepto las observaciones del técnico.
        </div>` : ""}

        <!-- PANEL PRE-IMPRESIÓN -->
        <div id="panelImprimir" style="
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 18px 22px;
            margin-bottom: 24px;
            max-width: 700px;
        ">
            <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                🔧 TÉCNICO Y REPUESTO
            </div>
            <div style="font-size:12px; color:#aaa; margin-bottom:14px;">${cerrada ? "Datos bloqueados porque la orden está cerrada." : "Completá estos campos para habilitar el estado <strong style='color:#D4EDDA;'>LISTO</strong>."}</div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">

                <div class="campo">
                    <label style="color:white;">TÉCNICO QUE REALIZÓ EL TRABAJO</label>
                    <select id="selectTecnico" ${cerrada ? "disabled" : ""} onchange="actualizarPanelImpresion(${orden.id})" style="color:black;">
                        <option value="">— SELECCIONÁ UN TÉCNICO —</option>
                        ${tecnicos.filter(esTecnico).map(t => `
                            <option value="${t.id}" ${orden.tecnicoId === t.id ? "selected" : ""}>
                                ${t.nombre} ${t.apellido} (${t.porcentaje}%)
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div class="campo">
                    <label style="color:white;">COSTO DEL REPUESTO ($)</label>
                    <input
                        type="number"
                        id="costoRepuesto"
                        ${cerrada ? "disabled" : ""}
                        min="0"
                        placeholder="0"
                        value="${orden.costoRepuesto ?? ''}"
                        oninput="actualizarPanelImpresion(${orden.id})"
                        style="color:black;"
                    >
                </div>

            </div>

            <div id="resumenTecnico" style="display:none;
                background: rgba(158,209,247,0.12);
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom:14px;
                font-size: 13px;
                line-height: 1.8;
            "></div>

            <button
                id="btnImprimir"
                onclick="imprimirOrden(${orden.id})"
                style="
                    padding: 12px 28px;
                    border: none;
                    border-radius: 10px;
                    background: #9ED1F7;
                    color: #1F2A44;
                    font-size: 14px;
                    font-weight: 800;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: .2s;
                "
            >
                🖨️ IMPRIMIR ORDEN
            </button>

        </div>

        <div class="info-orden">
            <div>
                <strong>FECHA INGRESO:</strong>
                ${orden.fechaCreacion}
            </div>
            <div>
                <strong>ÚLTIMA MODIFICACIÓN:</strong>
                ${orden.fechaUltimaModificacion}
            </div>
            <div>
                <label><strong>ESTADO:</strong></label>
                <select id="estadoOrden" ${bloqEstado ? "disabled" : ""} onchange="cambiarEstado(${orden.id})">
                    <option value="INGRESADO"           ${orden.estado==="INGRESADO"            ? "selected":""}>INGRESADO</option>
                    <option value="EN REVISION"         ${orden.estado==="EN REVISION"          ? "selected":""}>EN REVISIÓN</option>
                    <option value="PRESUPUESTO ENVIADO" ${orden.estado==="PRESUPUESTO ENVIADO"  ? "selected":""}>PRESUPUESTO ENVIADO</option>
                    <option value="EN REPARACION"       ${orden.estado==="EN REPARACION"        ? "selected":""}>EN REPARACIÓN</option>
                    <option value="LISTO"               ${orden.estado==="LISTO"                ? "selected":""}>LISTO</option>
                    <option value="SIN SOLUCION"        ${orden.estado==="SIN SOLUCION"         ? "selected":""}>SIN SOLUCIÓN</option>
                    <option value="ENTREGADO"           ${orden.estado==="ENTREGADO"            ? "selected":""}>ENTREGADO</option>
                </select>
            </div>
        </div>

        <h2>CLIENTE</h2>
        <table>
            <tr><th>NOMBRE</th>    <td>${orden.cliente.nombre}</td></tr>
            <tr><th>APELLIDO</th>  <td>${orden.cliente.apellido}</td></tr>
            <tr><th>DNI</th>       <td>${orden.cliente.documento}</td></tr>
            <tr><th>TELÉFONO</th>  <td>${ftTel(orden.cliente.telefono)}</td></tr>
        </table>

        <br>

        <h2>EQUIPO</h2>
        <table>
            <tr><th>MARCA</th>   <td>${orden.equipo.marca}</td></tr>
            <tr><th>MODELO</th>  <td>${orden.equipo.modelo}</td></tr>
            <tr><th>IMEI</th>    <td>${orden.equipo.imei || "-"}</td></tr>
            <tr><th>COLOR</th>   <td>${orden.equipo.color}</td></tr>
        </table>

        <br>

        <h2>TRABAJO</h2>
        <table>
            <tr><th>PRESUPUESTO</th>       <td>${cerrada
                ? "$" + fm(orden.trabajo.presupuesto)
                : `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                       <input type="number" id="presupuestoOrden" min="0" value="${orden.trabajo.presupuesto || 0}"
                              onkeydown="if(event.key==='Enter') cambiarPresupuesto(${orden.id})"
                              style="color:black; max-width:160px;">
                       <button class="guardar-btn" onclick="cambiarPresupuesto(${orden.id})" style="margin:0; padding:8px 16px;">ACTUALIZAR</button>
                   </div>`}</td></tr>
            <tr><th>ADELANTO</th>          <td>$${fm(orden.trabajo.adelanto)}</td></tr>
            <tr><th>REVISAN FUNCIONES</th> <td>${orden.trabajo.revisanFunciones}</td></tr>
            <tr><th>FALLA REPORTADA</th>   <td>${orden.trabajo.fallaReportada}</td></tr>
            <tr><th>ESTADO DEL EQUIPO</th> <td>${orden.trabajo.estadoEquipo}</td></tr>
        </table>

        <br>

        <h2>OBSERVACIONES DEL TÉCNICO</h2>
        <div class="campo">
            <textarea
                id="observacionesTecnico"
                placeholder="Diagnóstico, repuestos usados, trabajos realizados..."
                style="min-height:120px; color:black;"
            >${observaciones}</textarea>
        </div>
        <button
            class="guardar-btn"
            onclick="guardarObservaciones(${orden.id})"
            style="margin-top:10px;"
        >
            GUARDAR OBSERVACIONES
        </button>

        <br><br>

        <h2>HISTORIAL DE CAMBIOS</h2>
        <table>
            <thead>
                <tr>
                    <th>FECHA Y HORA</th>
                    <th>TIPO</th>
                    <th>DETALLE</th>
                </tr>
            </thead>
            <tbody>
                ${filasHistorial}
            </tbody>
        </table>

        <br>

        <button
            class="guardar-btn"
            style="background:#E2E3E5; color:#333;"
            onclick="mostrarListadoOrdenes()"
        >
            VOLVER
        </button>

    `;

    // Inicializar el panel siempre para habilitar/deshabilitar la opción LISTO correctamente
    setTimeout(() => actualizarPanelImpresion(orden.id), 0);
}


function actualizarPanelImpresion(id){

    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    const tecnicoId     = document.getElementById("selectTecnico")?.value || "";
    const costoRepEl    = document.getElementById("costoRepuesto");
    const costoRepuesto = costoRepEl ? Number(costoRepEl.value) || 0 : 0;
    const tecnico       = tecnicos.find(t => t.id === tecnicoId);
    const cerrada       = ordenCerrada(orden);
    const resumenDiv    = document.getElementById("resumenTecnico");

    const completo = tecnicoId !== "" && costoRepEl && costoRepEl.value.trim() !== "";

    if(completo && tecnico){

        const presupuesto = orden.trabajo.presupuesto || 0;
        const adelanto    = orden.trabajo.adelanto    || 0;
        const base        = presupuesto - costoRepuesto;
        const ganTecnico  = Math.round(base * (tecnico.porcentaje / 100));
        const ganLocal    = base - ganTecnico;

        resumenDiv.style.display = "block";
        resumenDiv.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                <div style="background:rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">PRESUPUESTO</div>
                    <div style="font-size:18px; font-weight:800;">$${fm(presupuesto)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">REPUESTO</div>
                    <div style="font-size:18px; font-weight:800; color:#E74C3C;">-$${fm(costoRepuesto)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">BASE CÁLCULO</div>
                    <div style="font-size:18px; font-weight:800;">$${fm(base)}</div>
                </div>
                <div style="background:rgba(76,175,80,0.15); border-radius:8px; padding:10px 14px; border-left:4px solid #4CAF50;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">TÉCNICO (${tecnico.porcentaje}%)</div>
                    <div style="font-size:18px; font-weight:800; color:#4CAF50;">$${fm(ganTecnico)}</div>
                    <div style="font-size:11px; color:#aaa;">${tecnico.nombre} ${tecnico.apellido}</div>
                </div>
                <div style="background:rgba(158,209,247,0.15); border-radius:8px; padding:10px 14px; border-left:4px solid #9ED1F7;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">LOCAL (${100 - tecnico.porcentaje}%)</div>
                    <div style="font-size:18px; font-weight:800; color:#9ED1F7;">$${fm(ganLocal)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
                    <div style="font-size:11px; font-weight:700; color:#9ED1F7; margin-bottom:3px;">ADELANTO</div>
                    <div style="font-size:18px; font-weight:800; color:#aaa;">$${fm(adelanto)}</div>
                </div>
            </div>
        `;

        // Orden cerrada: solo se muestra el resumen, no se modifica nada
        if(cerrada) return;

        // Registro de cambios (solo si realmente cambió algo)
        const tecAnterior = tecnicos.find(t => t.id === orden.tecnicoId);
        const repAnterior = orden.costoRepuesto;
        if((orden.tecnicoId || "") !== tecnicoId){
            guardarRegistro("ÓRDENES", "ASIGNÓ TÉCNICO",
                `Orden ${descOrden(orden)}: técnico ${tecAnterior ? tecAnterior.nombre + " " + tecAnterior.apellido : "sin asignar"} → ${tecnico.nombre} ${tecnico.apellido}`,
                "tec-" + orden.id);
        }
        if(repAnterior === undefined || repAnterior === null || Number(repAnterior) !== costoRepuesto){
            guardarRegistro("ÓRDENES", "COSTO REPUESTO",
                `Orden ${descOrden(orden)}: costo de repuesto ${repAnterior === undefined || repAnterior === null ? "sin cargar" : "$" + fm(Number(repAnterior))} → $${fm(costoRepuesto)}`,
                "rep-" + orden.id);
        }

        // Persistir datos del técnico
        orden.tecnicoId     = tecnicoId;
        orden.costoRepuesto = costoRepuesto;
        orden.ganTecnico    = ganTecnico;
        orden.ganLocal      = ganLocal;
        guardarDatos();

        // Habilitar opción LISTO en el select de estado
        const optListo = document.querySelector('#estadoOrden option[value="LISTO"]');
        if(optListo){
            optListo.disabled = false;
            optListo.text     = "LISTO";
        }

    } else {
        if(resumenDiv) resumenDiv.style.display = "none";

        // Deshabilitar opción LISTO si la orden aún no está en ese estado
        const selectEstado = document.getElementById("estadoOrden");
        const optListo     = document.querySelector('#estadoOrden option[value="LISTO"]');
        if(optListo && selectEstado && selectEstado.value !== "LISTO"){
            optListo.disabled = true;
            optListo.text     = "LISTO (requiere técnico y repuesto)";
        }
    }
}


function imprimirOrden(id){

    const _ordenImp = ordenes.find(o => o.id === id);
    if(_ordenImp) guardarRegistro("ÓRDENES", "IMPRIMIR", `Imprimió la orden ${descOrden(_ordenImp)}`);

    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    const fecha       = obtenerFechaArgentina();
    const tel         = LOCAL_TELEFONO ? ftTel(LOCAL_TELEFONO) : "_______________";
    const dir         = LOCAL_DIRECCION || "_______________";
    const nombreLocal = LOCAL_NOMBRE;

    const datosCliente = `
        <div class="dato"><span class="etiqueta">Cliente:</span> ${orden.cliente.nombre} ${orden.cliente.apellido}</div>
        <div class="dato"><span class="etiqueta">DNI:</span> ${orden.cliente.documento}</div>
        <div class="dato"><span class="etiqueta">Tel:</span> ${ftTel(orden.cliente.telefono)}</div>
    `;

    const datosEquipo = `
        <div class="dato"><span class="etiqueta">Equipo:</span> ${orden.equipo.marca} ${orden.equipo.modelo}</div>
        <div class="dato"><span class="etiqueta">Color:</span> ${orden.equipo.color}</div>
        <div class="dato"><span class="etiqueta">IMEI:</span> ${orden.equipo.imei || "-"}</div>
        <div class="dato"><span class="etiqueta">Falla:</span> ${orden.trabajo.fallaReportada}</div>
        <div class="dato"><span class="etiqueta">Estado equipo:</span> ${orden.trabajo.estadoEquipo}</div>
        <div class="dato"><span class="etiqueta">Presupuesto:</span> $${fm(orden.trabajo.presupuesto)}</div>
        <div class="dato"><span class="etiqueta">Adelanto:</span> $${fm(orden.trabajo.adelanto)}</div>
        <div class="dato" style="margin-top:3mm; padding-top:2mm; border-top:1px dashed #ccc;">
            <span class="etiqueta">Seguí tu reparación:</span> ${LOCAL_SEGUIMIENTO}
        </div>
    `;

    const terminosHTML = `
        <div class="tyc-titulo">TÉRMINOS Y CONDICIONES</div>
        <div class="tyc-item"><strong>Garantía de Reparación:</strong> Los equipos tienen 30 días de garantía sobre la reparación realizada, únicamente por fallas relacionadas con el servicio efectuado.</div>
        <div class="tyc-item"><strong>Exclusiones de Garantía:</strong> No se cubren bajo garantía: equipos mojados o que no puedan ser revisados en el momento de la entrega; sistemas operativos, desbloqueos o cualquier modificación de software.</div>
        <div class="tyc-item"><strong>Equipos Abandonados:</strong> Los equipos que permanezcan más de 60 días en el local sin retiro serán considerados abandonados y pasarán a ser propiedad del local.</div>
        <div class="tyc-item"><strong>Responsabilidad sobre Contenido:</strong> Ni el local ni los técnicos se hacen responsables por pérdida de datos, información personal o contenido almacenado en los equipos.</div>
        <div class="tyc-item"><strong>Revisión y Aceptación:</strong> Al dejar su equipo, el cliente acepta estos términos y condiciones.</div>
        <div class="tyc-item" style="margin-top:2mm; padding-top:2mm; border-top:1px dashed #ccc; font-size:11px;">
            <strong>Estado de tu reparación online:</strong> ${LOCAL_SEGUIMIENTO} — ingresá con tu DNI y nombre.
        </div>
    `;

    const rectPequenio = `
        <div class="rect-pequenio">
            <div class="rect-header">
                <img src="${LOGO_NEGRO}" alt="CCC" style="height:8mm; width:auto; display:block;">
                <span class="rect-orden">N° ${orden.numero}</span>
            </div>
            <div class="rect-dato">${orden.cliente.nombre} ${orden.cliente.apellido}</div>
            <div class="rect-dato">${orden.equipo.marca} ${orden.equipo.modelo} · ${orden.equipo.color}</div>
            <div class="rect-dato"><strong>Falla:</strong> ${orden.trabajo.fallaReportada}</div>
            <div class="rect-dato rect-fecha">${fecha}</div>
        </div>
    `;

    // Bloque invisible del mismo ancho que los rectángulos, para mantener alineación (solo para la copia del local)
    const rectPlaceholder = `
        <div style="width:70mm; flex-shrink:0; visibility:hidden;">
            ${rectPequenio}
            ${rectPequenio}
        </div>
    `;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Orden N° ${orden.numero}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            color: #000;
            background: white;
        }

        @page {
            margin: 5mm;
        }

        .pagina {
            width: 100%;
            padding: 3mm 4mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
        }

        .fila-principal {
            display: flex;
            gap: 4mm;
            align-items: flex-start;
        }

        .col-izquierda {
            flex: 1;
            min-width: 0;
        }

        .col-derecha {
            display: flex;
            flex-direction: column;
            gap: 3mm;
            flex-shrink: 0;
        }

        /* Rectángulo ~7x5cm */
        .rect-pequenio {
            width: 70mm;
            height: 46mm;
            border: 1.5px solid #000;
            border-radius: 3px;
            padding: 3mm 4mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
        }

        .rect-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000;
            padding-bottom: 1.5mm;
            margin-bottom: 1.5mm;
        }

        .rect-logo {
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 1px;
        }

        .rect-orden {
            font-size: 12px;
            font-weight: 700;
        }

        .rect-dato {
            font-size: 10px;
            line-height: 1.4;
        }

        .rect-fecha {
            font-size: 9px;
            color: #555;
            margin-top: auto;
            padding-top: 1.5mm;
        }

        .cabecera {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2mm;
            padding-bottom: 2mm;
            border-bottom: 2px solid #000;
        }

        .cabecera-logo {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 2px;
            line-height: 1;
        }

        .cabecera-info {
            text-align: right;
            font-size: 10px;
            line-height: 1.5;
        }

        .cabecera-orden {
            font-size: 13px;
            font-weight: 800;
        }

        .seccion {
            margin-bottom: 2mm;
        }

        .seccion-titulo {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 1px solid #ccc;
            margin-bottom: 1.5mm;
            padding-bottom: 0.8mm;
        }

        .dato {
            font-size: 11px;
            line-height: 1.5;
        }

        .etiqueta {
            font-weight: 700;
        }

        /* ── COPIA CLIENTE: layout y tipografía ampliada ── */
        .copia-cliente .cabecera-logo { font-size: 28px; }
        .copia-cliente .cabecera-orden { font-size: 17px; }
        .copia-cliente .cabecera-info { font-size: 12px; }
        .copia-cliente .seccion-titulo { font-size: 12px; }
        .copia-cliente .dato { font-size: 14px; line-height: 1.65; }
        .copia-cliente .tyc-titulo { font-size: 10px; }
        .copia-cliente .tyc-item { font-size: 9px; }

        .tyc-titulo {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 1.5mm;
            border-bottom: 1px solid #ccc;
            padding-bottom: 0.8mm;
        }

        .tyc-item {
            font-size: 8px;
            line-height: 1.4;
            margin-bottom: 1mm;
            text-align: justify;
        }

        .firmas {
            display: flex;
            justify-content: space-between;
            margin-top: 3mm;
            gap: 15mm;
        }

        .firma-bloque {
            flex: 1;
            text-align: center;
        }

        .firma-linea {
            border-top: 1px solid #000;
            margin-bottom: 1.5mm;
        }

        .firma-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .linea-corte {
            border: none;
            border-top: 1.5px dashed #555;
            margin: 3mm 0;
            position: relative;
        }

        .linea-corte::after {
            content: "✂";
            position: absolute;
            top: -9px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 0 3mm;
            font-size: 13px;
            color: #555;
        }

        @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>

<div class="pagina">

    <div class="no-print" style="margin-bottom:8mm; text-align:center;">
        <button onclick="window.print()" style="padding:10px 30px; font-size:14px; font-weight:800; background:#1F2A44; color:white; border:none; border-radius:8px; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">
            🖨️ Imprimir
        </button>
        <button onclick="window.close()" style="padding:10px 30px; font-size:14px; font-weight:800; background:#ccc; color:#333; border:none; border-radius:8px; cursor:pointer; text-transform:uppercase; letter-spacing:1px; margin-left:10px;">
            ✖ Cerrar
        </button>
    </div>

    <!-- ══════════════════════════════════════════
         MITAD SUPERIOR — CLIENTE (ancho completo)
    ══════════════════════════════════════════ -->
    <div class="copia-cliente" style="width:100%;">

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2mm; padding-bottom:2mm; border-bottom:2px solid #000;">
            <div>
                <img src="${LOGO_NEGRO}" alt="${nombreLocal}" style="height:16mm; width:auto; display:block; margin-bottom:1mm;">
                <div style="font-size:11px; margin-top:0.5mm;">📍 ${dir}</div>
                <div style="font-size:11px;">📞 ${tel}</div>
            </div>
            <div class="cabecera-info" style="text-align:right;">
                <div class="cabecera-orden">ORDEN N° ${orden.numero}</div>
                <div>${fecha}</div>
                <div style="font-size:11px; font-weight:700; margin-top:1.5mm; background:#000; color:#fff; padding:2px 7px; border-radius:4px;">COPIA CLIENTE</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-bottom:2mm;">
            <div class="seccion">
                <div class="seccion-titulo">Datos del Cliente</div>
                ${datosCliente}
            </div>
            <div class="seccion">
                <div class="seccion-titulo">Datos del Equipo</div>
                ${datosEquipo}
            </div>
        </div>

        <div class="seccion">
            ${terminosHTML}
        </div>

        <div class="firmas">
            <div class="firma-bloque">
                <div style="height:7mm;"></div>
                <div class="firma-linea"></div>
                <div class="firma-label">Firma del Cliente</div>
            </div>
            <div class="firma-bloque">
                <div style="height:7mm;"></div>
                <div class="firma-linea"></div>
                <div class="firma-label">Firma del Local</div>
            </div>
        </div>

    </div>

    <!-- LÍNEA DE CORTE -->
    <hr class="linea-corte">

    <!-- ══════════════════════════════════════════
         MITAD INFERIOR — LOCAL
         Izquierda: datos + firmas
         Derecha: 2 rectángulos para pegar
    ══════════════════════════════════════════ -->
    <div class="fila-principal">

        <div class="col-izquierda">
            <div class="cabecera">
                <div>
                    <img src="${LOGO_NEGRO}" alt="${nombreLocal}" style="height:11mm; width:auto; display:block; margin-bottom:1mm;">
                    <div style="font-size:9px;">📍 ${dir}</div>
                    <div style="font-size:9px;">📞 ${tel}</div>
                </div>
                <div class="cabecera-info">
                    <div class="cabecera-orden">ORDEN N° ${orden.numero}</div>
                    <div>${fecha}</div>
                </div>
            </div>

            <div class="seccion">
                <div class="seccion-titulo">Datos del Cliente</div>
                ${datosCliente}
            </div>

            <div class="seccion">
                <div class="seccion-titulo">Datos del Equipo</div>
                ${datosEquipo}
            </div>

            <div class="firmas">
                <div class="firma-bloque">
                    <div style="height:7mm;"></div>
                    <div class="firma-linea"></div>
                    <div class="firma-label">Firma del Cliente</div>
                </div>
                <div class="firma-bloque">
                    <div style="height:7mm;"></div>
                    <div class="firma-linea"></div>
                    <div class="firma-label">Firma del Local</div>
                </div>
            </div>
        </div>

        <!-- Rectángulos REALES en la mitad inferior (local) -->
        <div class="col-derecha">
            ${rectPequenio}
            ${rectPequenio}
        </div>

    </div>

</div>

</body>
</html>`;

    const ventana = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
    ventana.document.write(html);
    ventana.document.close();
}


function cambiarEstado(id){

    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    const nuevoEstado = document.getElementById("estadoOrden").value;

    // Orden cerrada: no se puede cambiar el estado (salvo reabrir un LISTO sin cobrar, solo admin)
    if(ordenCerrada(orden) && !puedeReabrirOrden(orden)){
        alert("LA ORDEN ESTÁ CERRADA: YA NO SE PUEDE CAMBIAR EL ESTADO.");
        document.getElementById("estadoOrden").value = orden.estado;
        return;
    }

    // Validar: para pasar a LISTO se necesita técnico y costo de repuesto cargados
    if(nuevoEstado === "LISTO"){
        const tieneTecnico  = orden.tecnicoId && orden.tecnicoId !== "";
        const tieneRepuesto = orden.costoRepuesto !== undefined && orden.costoRepuesto !== null && String(orden.costoRepuesto).trim() !== "";
        if(!tieneTecnico || !tieneRepuesto){
            alert("PARA MARCAR COMO LISTO PRIMERO COMPLETÁ EL TÉCNICO Y EL COSTO DEL REPUESTO.");
            // Revertir el select al estado actual
            document.getElementById("estadoOrden").value = orden.estado;
            return;
        }
    }

    guardarRegistro("ÓRDENES", "CAMBIO ESTADO", `Orden ${descOrden(orden)}: estado de ${orden.estado} a ${nuevoEstado}`);

    const fecha = obtenerFechaArgentina();

    orden.estado = nuevoEstado;
    orden.fechaUltimaModificacion = fecha;

    if(!orden.historial) orden.historial = [];

    orden.historial.push({
        fecha:   fecha,
        tipo:    "ESTADO",
        detalle: nuevoEstado
    });

    guardarDatos();
    verOrden(id);
}


function cambiarPresupuesto(id){
    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    if(ordenCerrada(orden)){
        alert("LA ORDEN ESTÁ CERRADA: YA NO SE PUEDE MODIFICAR EL PRESUPUESTO.");
        verOrden(id);
        return;
    }

    const el    = document.getElementById("presupuestoOrden");
    const nuevo = Number(el.value);

    if(el.value.trim() === "" || isNaN(nuevo) || nuevo < 0){
        alert("INGRESÁ UN PRESUPUESTO VÁLIDO.");
        return;
    }

    const anterior = orden.trabajo.presupuesto || 0;
    if(nuevo === anterior) return;

    const adelanto = orden.trabajo.adelanto || 0;
    if(nuevo < adelanto){
        alert("EL PRESUPUESTO NO PUEDE SER MENOR AL ADELANTO ($" + fm(adelanto) + ").");
        el.value = anterior;
        return;
    }

    const fecha = obtenerFechaArgentina();
    orden.trabajo.presupuesto = nuevo;
    orden.fechaUltimaModificacion = fecha;

    if(!orden.historial) orden.historial = [];
    orden.historial.push({
        fecha:   fecha,
        tipo:    "PRESUPUESTO",
        detalle: `$${fm(anterior)} → $${fm(nuevo)}`
    });

    guardarRegistro("ÓRDENES", "PRESUPUESTO", `Orden ${descOrden(orden)}: presupuesto $${fm(anterior)} → $${fm(nuevo)}`);

    guardarDatos();
    verOrden(id);
}


function guardarObservaciones(id){
    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    const rawTexto = document.getElementById("observacionesTecnico").value.trim();

    if(rawTexto === ""){
        alert("ESCRIBÍ ALGO ANTES DE GUARDAR.");
        return;
    }

    const texto = capitalizar(rawTexto);

    orden.trabajo.observaciones = texto;
    orden.fechaUltimaModificacion = obtenerFechaArgentina();

    if(!orden.historial) orden.historial = [];

    const resumen = texto.length > 60 ? texto.substring(0, 60) + "..." : texto;

    orden.historial.push({
        fecha:   obtenerFechaArgentina(),
        tipo:    "OBSERVACIÓN",
        detalle: resumen
    });

    guardarRegistro("ÓRDENES", "OBSERVACIÓN", `Orden ${descOrden(orden)}: guardó observaciones — "${resumen}"`);

    guardarDatos();
    alert("OBSERVACIONES GUARDADAS.");
    verOrden(id);
}
