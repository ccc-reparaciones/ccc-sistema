function mostrarCaja(){
    if (!verificarAcceso()) return;
    guardarRegistro("CAJA", "VER", "Accedió a Caja");
    activarBoton(6);
    renderCaja();
}


// ─────────────────────────────────────────────
// HELPER: desglosa un array de movimientos en
// efectivo, MP, egresos efectivo, egresos MP
// ─────────────────────────────────────────────
function desglosarMovimientos(movs){

    const esEfectivo = m => (m.metodoPago || "").toUpperCase() === "EFECTIVO";
    const esMP       = m => !esEfectivo(m); // todo lo que no es efectivo va a MP

    const ingEfectivo = movs.filter(m => m.monto > 0 && esEfectivo(m)).reduce((a, m) => a + m.monto, 0);
    const ingMP       = movs.filter(m => m.monto > 0 && esMP(m)).reduce((a, m) => a + m.monto, 0);

    const egEfectivo  = movs.filter(m => m.monto < 0 && esEfectivo(m)).reduce((a, m) => a + m.monto, 0);
    const egMP        = movs.filter(m => m.monto < 0 && esMP(m)).reduce((a, m) => a + m.monto, 0);

    const totalEfectivo = ingEfectivo + egEfectivo;
    const totalMP       = ingMP + egMP;
    const totalGeneral  = totalEfectivo + totalMP;

    return { ingEfectivo, ingMP, egEfectivo, egMP, totalEfectivo, totalMP, totalGeneral };
}


function renderCaja(){

    const hoy = obtenerFechaArgentina().split(",")[0].trim();

    const movHoy = caja.filter(m => m.fecha.split(",")[0].trim() === hoy);

    const d = desglosarMovimientos(movHoy);

    // ── Últimos 10 movimientos de hoy ──────────────────
    const ultimos10 = [...movHoy].reverse().slice(0, 10);

    let filasRecientes = "";
    if(ultimos10.length === 0){
        filasRecientes = `
            <tr>
                <td colspan="4" style="text-align:center; color:#888;">
                    SIN MOVIMIENTOS HOY
                </td>
            </tr>
        `;
    } else {
        ultimos10.forEach(m => {
            const color = m.monto > 0 ? "#155724" : m.monto < 0 ? "#721C24" : "#555";
            const bg    = m.monto > 0 ? "#D4EDDA"  : m.monto < 0 ? "#F8D7DA"  : "#E2E3E5";
            filasRecientes += `
                <tr>
                    <td>${m.fecha}</td>
                    <td>${m.descripcion}</td>
                    <td>${m.metodoPago || "-"}</td>
                    <td style="font-weight:800; color:${color}; background:${bg}; text-align:right;">
                        ${m.monto >= 0 ? "+" : ""}$${fm(m.monto)}
                    </td>
                </tr>
            `;
        });
    }

    // ── Facturación agrupada por día ───────────────────
    const { porDia, diasOrdenados } = agruparCajaPorDia();

    // Colores del total general
    const colorTotalEf = d.totalEfectivo >= 0 ? "#155724" : "#721C24";
    const bgTotalEf    = d.totalEfectivo >= 0 ? "#D4EDDA"  : "#F8D7DA";
    const colorTotalMP = d.totalMP >= 0 ? "#004085" : "#721C24";
    const bgTotalMP    = d.totalMP >= 0 ? "#CCE5FF"  : "#F8D7DA";
    const colorTotal   = d.totalGeneral > 0 ? "#155724" : d.totalGeneral < 0 ? "#721C24" : "#555";
    const bgTotal      = d.totalGeneral > 0 ? "#D4EDDA"  : d.totalGeneral < 0 ? "#F8D7DA"  : "#E2E3E5";

    document.getElementById("contenido").innerHTML = `

        <h1>CAJA</h1>

        <!-- RESUMEN DEL DÍA — 2 columnas: EFECTIVO | MP -->
        <h2>HOY</h2>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; max-width:900px;">

            <!-- EFECTIVO -->
            <div style="background:rgba(255,255,255,.06); border-radius:14px; padding:20px; border-top:4px solid #4CAF50;">
                <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; margin-bottom:14px; letter-spacing:1px;">💵 EFECTIVO</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">INGRESOS</span>
                    <span style="font-weight:800; color:#4CAF50;">+$${fm(d.ingEfectivo)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">EGRESOS</span>
                    <span style="font-weight:800; color:#F1948A;">$${fm(d.egEfectivo)}</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,.15); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:800; color:#aaa;">TOTAL</span>
                    <span style="font-size:24px; font-weight:800; color:${colorTotalEf}; background:${bgTotalEf}; padding:4px 14px; border-radius:8px;">
                        ${d.totalEfectivo >= 0 ? "+" : ""}$${fm(d.totalEfectivo)}
                    </span>
                </div>
            </div>

            <!-- MP -->
            <div style="background:rgba(255,255,255,.06); border-radius:14px; padding:20px; border-top:4px solid #2196F3;">
                <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; margin-bottom:14px; letter-spacing:1px;">📱 MERCADO PAGO / OTROS</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">INGRESOS</span>
                    <span style="font-weight:800; color:#4CAF50;">+$${fm(d.ingMP)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">EGRESOS</span>
                    <span style="font-weight:800; color:#F1948A;">$${fm(d.egMP)}</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,.15); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:800; color:#aaa;">TOTAL</span>
                    <span style="font-size:24px; font-weight:800; color:${colorTotalMP}; background:${bgTotalMP}; padding:4px 14px; border-radius:8px;">
                        ${d.totalMP >= 0 ? "+" : ""}$${fm(d.totalMP)}
                    </span>
                </div>
            </div>

        </div>

        <!-- TOTAL GENERAL DEL DÍA -->
        <div style="max-width:900px; background:${bgTotal}; color:${colorTotal}; border-radius:12px; padding:16px 24px; margin-bottom:32px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:800; text-transform:uppercase;">TOTAL GENERAL HOY</span>
            <span style="font-size:32px; font-weight:800;">${d.totalGeneral >= 0 ? "+" : ""}$${fm(d.totalGeneral)}</span>
        </div>

        <!-- RESULTADO DEL DÍA DESPUÉS DE GASTOS FIJOS -->
        ${resultadoDiaHTML(hoy, d)}

        <!-- GASTOS FIJOS DIARIOS -->
        ${panelGastosFijosHTML()}

        <!-- ÚLTIMOS 10 MOVIMIENTOS DE HOY -->
        <h2>ÚLTIMOS MOVIMIENTOS DE HOY</h2>

        <table style="margin-bottom:30px;">
            <thead>
                <tr>
                    <th>HORA</th>
                    <th>DESCRIPCIÓN</th>
                    <th>MÉTODO</th>
                    <th style="text-align:right;">MONTO</th>
                </tr>
            </thead>
            <tbody>
                ${filasRecientes}
            </tbody>
        </table>

        <!-- HISTORIAL POR DÍA -->
        <h2>HISTORIAL POR DÍA</h2>

        <div class="campo" style="max-width:300px; margin-bottom:20px;">
            <input
                type="text"
                id="buscadorCajaDia"
                placeholder="FILTRAR POR DÍA (DD/MM/AAAA)..."
                oninput="filtrarCajaDia()"
                style="text-transform:uppercase;"
            >
        </div>

        <div id="tablaDias">
            ${renderTablaDias(diasOrdenados, porDia)}
        </div>

    `;
}


function renderTablaDias(diasOrdenados, porDia){

    if(diasOrdenados.length === 0){
        return `<p style="color:#888;">SIN MOVIMIENTOS REGISTRADOS</p>`;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>FECHA</th>
                    <th style="text-align:right;">ING. EFECTIVO</th>
                    <th style="text-align:right;">ING. MP/OTROS</th>
                    <th style="text-align:right;">EGRESOS EF.</th>
                    <th style="text-align:right;">EGRESOS MP</th>
                    <th style="text-align:right;">TOTAL DÍA</th>
                    <th style="text-align:right;">GASTOS FIJOS</th>
                    <th style="text-align:right;">RESULTADO</th>
                </tr>
            </thead>
            <tbody id="tbodyDias">
    `;

    diasOrdenados.forEach(dia => {
        const movs = porDia[dia];
        const d    = desglosarMovimientos(movs);

        const colorTotal = d.totalGeneral > 0 ? "#155724" : d.totalGeneral < 0 ? "#721C24" : "#555";
        const bgTotal    = d.totalGeneral > 0 ? "#D4EDDA"  : d.totalGeneral < 0 ? "#F8D7DA"  : "#E2E3E5";

        const gastosDia = gastosFijosDelDia(dia);
        const resultado = d.totalGeneral - gastosDia;
        const est       = estadoResultado(resultado);

        html += `
            <tr onclick="verDetalleDia('${dia}')" style="cursor:pointer;">
                <td style="font-weight:700;">${dia}</td>
                <td style="text-align:right; color:#155724; font-weight:700;">+$${fm(d.ingEfectivo)}</td>
                <td style="text-align:right; color:#004085; font-weight:700;">+$${fm(d.ingMP)}</td>
                <td style="text-align:right; color:#721C24; font-weight:700;">${d.egEfectivo === 0 ? "-" : "$" + d.egEfectivo}</td>
                <td style="text-align:right; color:#721C24; font-weight:700;">${d.egMP === 0 ? "-" : "$" + d.egMP}</td>
                <td style="text-align:right; font-weight:800; color:${colorTotal}; background:${bgTotal};">
                    ${d.totalGeneral >= 0 ? "+" : ""}$${fm(d.totalGeneral)}
                </td>
                <td style="text-align:right; color:#721C24; font-weight:700;">${gastosDia === 0 ? "-" : "-$" + fm(gastosDia)}</td>
                <td style="text-align:right; font-weight:800; color:${est.color}; background:${est.bg};" title="${est.texto}">
                    ${resultado >= 0 ? "+" : "-"}$${fm(Math.abs(resultado))}
                    <div style="font-size:10px; font-weight:800;">${est.texto}</div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    return html;
}


function filtrarCajaDia(){

    const txt = document.getElementById("buscadorCajaDia").value.trim().toLowerCase();

    const { porDia, diasOrdenados } = agruparCajaPorDia();
    let diasFiltrados = diasOrdenados;

    if(txt !== ""){
        diasFiltrados = diasFiltrados.filter(d => d.includes(txt));
    }

    document.getElementById("tablaDias").innerHTML = renderTablaDias(diasFiltrados, porDia);
}


function verDetalleDia(dia){

    const movsDia = caja.filter(m => m.fecha.split(",")[0].trim() === dia);
    const d = desglosarMovimientos(movsDia);

    const colorTotalEf = d.totalEfectivo >= 0 ? "#155724" : "#721C24";
    const bgTotalEf    = d.totalEfectivo >= 0 ? "#D4EDDA"  : "#F8D7DA";
    const colorTotalMP = d.totalMP >= 0 ? "#004085" : "#721C24";
    const bgTotalMP    = d.totalMP >= 0 ? "#CCE5FF"  : "#F8D7DA";
    const colorTotal   = d.totalGeneral > 0 ? "#155724" : d.totalGeneral < 0 ? "#721C24" : "#555";
    const bgTotal      = d.totalGeneral > 0 ? "#D4EDDA"  : d.totalGeneral < 0 ? "#F8D7DA"  : "#E2E3E5";

    let items = "";
    [...movsDia].reverse().forEach(m => {
        const color = m.monto > 0 ? "#155724" : m.monto < 0 ? "#721C24" : "#555";
        const bg    = m.monto > 0 ? "#D4EDDA"  : m.monto < 0 ? "#F8D7DA"  : "#E2E3E5";
        items += `
            <div style="
                background:white; color:black; border-radius:10px; padding:14px 18px;
                display:grid; grid-template-columns:1fr auto auto;
                gap:16px; align-items:center;
                border-left:5px solid ${color}; margin-bottom:10px;
            ">
                <div>
                    <div style="font-weight:700; font-size:14px;">${m.descripcion}</div>
                    <div style="font-size:12px; color:#888; margin-top:2px;">${m.fecha}</div>
                </div>
                <div style="background:#E2E3E5; color:#333; border-radius:20px; padding:4px 12px; font-size:12px; font-weight:700;">
                    ${m.metodoPago || "-"}
                </div>
                <div style="font-size:18px; font-weight:800; color:${color}; background:${bg}; padding:6px 14px; border-radius:8px; white-space:nowrap;">
                    ${m.monto >= 0 ? "+" : ""}$${fm(m.monto)}
                </div>
            </div>
        `;
    });

    document.getElementById("contenido").innerHTML = `

        <h1>MOVIMIENTOS DEL ${dia}</h1>

        <!-- RESUMEN: EFECTIVO | MP -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; max-width:900px;">

            <div style="background:rgba(255,255,255,.06); border-radius:14px; padding:20px; border-top:4px solid #4CAF50;">
                <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; margin-bottom:14px; letter-spacing:1px;">💵 EFECTIVO</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">INGRESOS</span>
                    <span style="font-weight:800; color:#4CAF50;">+$${fm(d.ingEfectivo)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">EGRESOS</span>
                    <span style="font-weight:800; color:#F1948A;">$${fm(d.egEfectivo)}</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,.15); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:800; color:#aaa;">TOTAL</span>
                    <span style="font-size:24px; font-weight:800; color:${colorTotalEf}; background:${bgTotalEf}; padding:4px 14px; border-radius:8px;">
                        ${d.totalEfectivo >= 0 ? "+" : ""}$${fm(d.totalEfectivo)}
                    </span>
                </div>
            </div>

            <div style="background:rgba(255,255,255,.06); border-radius:14px; padding:20px; border-top:4px solid #2196F3;">
                <div style="font-size:13px; font-weight:800; color:#9ED1F7; text-transform:uppercase; margin-bottom:14px; letter-spacing:1px;">📱 MERCADO PAGO / OTROS</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">INGRESOS</span>
                    <span style="font-weight:800; color:#4CAF50;">+$${fm(d.ingMP)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
                    <span style="font-size:12px; font-weight:700; color:#aaa;">EGRESOS</span>
                    <span style="font-weight:800; color:#F1948A;">$${fm(d.egMP)}</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,.15); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:800; color:#aaa;">TOTAL</span>
                    <span style="font-size:24px; font-weight:800; color:${colorTotalMP}; background:${bgTotalMP}; padding:4px 14px; border-radius:8px;">
                        ${d.totalMP >= 0 ? "+" : ""}$${fm(d.totalMP)}
                    </span>
                </div>
            </div>

        </div>

        <!-- TOTAL GENERAL -->
        <div style="max-width:900px; background:${bgTotal}; color:${colorTotal}; border-radius:12px; padding:16px 24px; margin-bottom:32px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:800; text-transform:uppercase;">TOTAL GENERAL</span>
            <span style="font-size:32px; font-weight:800;">${d.totalGeneral >= 0 ? "+" : ""}$${fm(d.totalGeneral)}</span>
        </div>

        ${resultadoDiaHTML(dia, d)}

        <h2>DETALLE DE MOVIMIENTOS</h2>

        <div style="max-width:800px;">
            ${items || `<p style="color:#888;">SIN MOVIMIENTOS PARA ESTE DÍA</p>`}
        </div>

        <br>

        <button
            class="guardar-btn"
            style="background:#E2E3E5; color:#333;"
            onclick="mostrarCaja()"
        >
            VOLVER
        </button>

    `;
}


// =============================================
// GASTOS FIJOS DIARIOS
// Cada gasto: { id, nombre, monto (por día), periodo ("dia"|"mes"),
//   montoOriginal, desde (DD/MM/YYYY), baja (DD/MM/YYYY o null) }
// Se restan automáticamente cada día entre "desde" y "baja" para saber
// si el día fue positivo, si solo cubrió los gastos o si dio pérdida.
// Al quitar un gasto no se borra: deja de aplicar desde ese día y el
// historial anterior no cambia.
// =============================================

function parseDiaCaja(f){
    const [dd, mo, y] = f.split("/");
    return new Date(`${y}-${mo}-${dd}`);
}

function gastosFijosVigentes(dia){
    const t = parseDiaCaja(dia);
    return gastosFijos.filter(g =>
        parseDiaCaja(g.desde) <= t &&
        (!g.baja || t < parseDiaCaja(g.baja))
    );
}

function gastosFijosDelDia(dia){
    return gastosFijosVigentes(dia).reduce((acc, g) => acc + g.monto, 0);
}

function estadoResultado(resultado){
    if(resultado > 0) return { texto: "DÍA POSITIVO",      color: "#155724", bg: "#D4EDDA" };
    if(resultado < 0) return { texto: "PÉRDIDA",           color: "#721C24", bg: "#F8D7DA" };
    return                   { texto: "CUBRIÓ LOS GASTOS", color: "#856404", bg: "#FFF3CD" };
}

// Agrupa los movimientos por día; agrega hoy si hay gastos fijos vigentes
function agruparCajaPorDia(){
    const porDia = {};
    caja.forEach(m => {
        const dia = m.fecha.split(",")[0].trim();
        if(!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(m);
    });

    const hoy = obtenerFechaArgentina().split(",")[0].trim();
    if(!porDia[hoy] && gastosFijosVigentes(hoy).length > 0) porDia[hoy] = [];

    const diasOrdenados = Object.keys(porDia).sort((a, b) => parseDiaCaja(b) - parseDiaCaja(a));
    return { porDia, diasOrdenados };
}

// Tarjeta: total del día − gastos fijos = resultado
function resultadoDiaHTML(dia, d){
    const gastos    = gastosFijosDelDia(dia);
    const resultado = d.totalGeneral - gastos;
    const est       = estadoResultado(resultado);
    const hayGastos = gastosFijosVigentes(dia).length > 0;

    if(!hayGastos){
        return `
            <div style="max-width:900px; background:rgba(255,255,255,.06); border-radius:12px; padding:14px 20px; margin-bottom:24px; font-size:13px; font-weight:600; color:#9ED1F7;">
                No hay gastos fijos cargados para este día${dia === obtenerFechaArgentina().split(",")[0].trim() ? ". Podés cargarlos abajo en <strong>Gastos fijos diarios</strong>" : ""}.
            </div>`;
    }

    return `
        <div style="max-width:900px; background:${est.bg}; color:${est.color}; border-radius:12px; padding:16px 24px; margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; margin-bottom:4px;">
                <span>TOTAL GENERAL</span><span>${d.totalGeneral >= 0 ? "+" : "-"}$${fm(Math.abs(d.totalGeneral))}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; margin-bottom:10px;">
                <span>GASTOS FIJOS DEL DÍA</span><span>-$${fm(gastos)}</span>
            </div>
            <div style="border-top:1px solid ${est.color}55; padding-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span style="font-size:14px; font-weight:800; text-transform:uppercase;">RESULTADO DEL DÍA · ${est.texto}</span>
                <span style="font-size:30px; font-weight:800;">${resultado >= 0 ? "+" : "-"}$${fm(Math.abs(resultado))}</span>
            </div>
        </div>`;
}

function panelGastosFijosHTML(){
    const hoy      = obtenerFechaArgentina().split(",")[0].trim();
    const vigentes = gastosFijosVigentes(hoy);
    const total    = vigentes.reduce((acc, g) => acc + g.monto, 0);

    const filas = vigentes.length === 0
        ? `<p style="color:#888; font-size:13px; margin:0 0 14px;">TODAVÍA NO HAY GASTOS FIJOS CARGADOS</p>`
        : vigentes.map(g => `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 14px; background:rgba(255,255,255,.06); border-radius:10px; margin-bottom:8px;">
                <div>
                    <div style="font-weight:700; font-size:14px;">${escapeHTML(g.nombre)}</div>
                    ${g.periodo === "mes" ? `<div style="font-size:11px; color:#9ED1F7; font-weight:600;">$${fm(g.montoOriginal)} por mes ÷ 30 días</div>` : ""}
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-weight:800; color:#F1948A; white-space:nowrap;">-$${fm(g.monto)} / día</span>
                    <button onclick="quitarGastoFijo('${g.id}')" style="background:#F8D7DA; color:#721C24; border:none; border-radius:6px; padding:4px 10px; font-weight:800; cursor:pointer; font-size:11px;">QUITAR</button>
                </div>
            </div>`).join("");

    return `
        <h2>GASTOS FIJOS DIARIOS</h2>

        <div style="max-width:900px; margin-bottom:30px;">

            ${filas}

            ${vigentes.length > 0 ? `
            <div style="text-align:right; font-size:13px; font-weight:800; color:#F1948A; margin-bottom:14px;">
                TOTAL GASTOS FIJOS POR DÍA: -$${fm(total)}
            </div>` : ""}

            <div class="formulario" style="max-width:900px;">
                <div style="display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:12px; align-items:end;" class="fila-gasto-fijo">
                    <div class="campo">
                        <label>GASTO</label>
                        <input type="text" id="gfNombre" placeholder="Ej: Sueldo de Juan, Alquiler...">
                    </div>
                    <div class="campo">
                        <label>MONTO</label>
                        <input type="text" id="gfMonto" placeholder="0" oninput="fmInput(this)">
                    </div>
                    <div class="campo">
                        <label>SE PAGA</label>
                        <select id="gfPeriodo" style="color:black;">
                            <option value="dia">POR DÍA</option>
                            <option value="mes">POR MES (÷30)</option>
                        </select>
                    </div>
                    <button class="guardar-btn" onclick="agregarGastoFijo()" style="margin-top:0; width:auto; padding:12px 18px;">AGREGAR</button>
                </div>
            </div>

        </div>`;
}

function agregarGastoFijo(){
    const nombre  = capitalizar(document.getElementById("gfNombre").value.trim());
    const monto   = leerNumero("gfMonto");
    const periodo = document.getElementById("gfPeriodo").value;

    if(!nombre || !monto || monto <= 0){
        alert("COMPLETÁ EL NOMBRE Y EL MONTO DEL GASTO.");
        return;
    }

    const hoy = obtenerFechaArgentina().split(",")[0].trim();

    gastosFijos.push({
        id:            "gf_" + Date.now(),
        nombre,
        monto:         periodo === "mes" ? Math.round(monto / 30) : monto,
        periodo,
        montoOriginal: monto,
        desde:         hoy,
        baja:          null
    });

    guardarGastosFijos();
    guardarRegistro("CAJA", "GASTO FIJO", `Agregó gasto fijo: ${nombre} ($${fm(monto)} ${periodo === "mes" ? "por mes" : "por día"})`);
    renderCaja();
}

function quitarGastoFijo(id){
    const g = gastosFijos.find(x => x.id === id);
    if(!g) return;

    if(!confirm(`¿QUITAR EL GASTO FIJO "${g.nombre}"?\nDeja de restarse desde hoy; los días anteriores no cambian.`)) return;

    g.baja = obtenerFechaArgentina().split(",")[0].trim();

    guardarGastosFijos();
    guardarRegistro("CAJA", "GASTO FIJO", `Quitó gasto fijo: ${g.nombre}`);
    renderCaja();
}
