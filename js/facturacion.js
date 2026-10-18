// =============================================
// FACTURACIÓN — funciona como caja de super:
//   1. Buscás/seleccionás items (órdenes o productos de stock)
//   2. Elegís método de pago (efectivo o MP)
//   3. Cobras y se registra en caja
// =============================================

// Estado temporal de la venta en curso
let ventaActual = {
    items: [],          // { tipo, descripcion, precio, cantidad, idRef }
    metodoPago: "EFECTIVO"
};

function mostrarFacturacion(){
    if (!verificarAcceso()) return;
    guardarRegistro("FACTURACIÓN", "VER", "Accedió a Facturación");

    activarBoton(5);

    ventaActual = { items: [], metodoPago: "EFECTIVO" };

    renderFacturacion();
}


// Selector de vendedor: solo aparece si hay vendedores cargados en Cuentas.
// Si quien cobra es un vendedor, queda elegido por defecto.
function selectVendedorHTML(){
    const vendedores = tecnicos.filter(esVendedor);
    if(vendedores.length === 0) return "";

    const sesion = getSesion();
    const propio = vendedores.find(v => v.cuentaId && sesion && v.cuentaId === sesion.id);

    return `
        <div style="margin-bottom:14px;">
            <label style="font-weight:700; font-size:13px; text-transform:uppercase; display:block; margin-bottom:6px;">VENDEDOR (COMISIÓN)</label>
            <select id="selectVendedor" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:13px; font-weight:700; color:black;">
                <option value="">— SIN VENDEDOR —</option>
                ${vendedores.map(v => `
                    <option value="${v.id}" ${propio && propio.id === v.id ? "selected" : ""}>
                        ${v.nombre} ${v.apellido} (${v.porcentajeVenta ?? 0}%)
                    </option>`).join("")}
            </select>
        </div>
    `;
}

function renderFacturacion(){

    document.getElementById("contenido").innerHTML = `

        <h1>FACTURACIÓN</h1>

        <div style="display:grid; grid-template-columns:1fr 420px; gap:24px; align-items:start;">

            <!-- COLUMNA IZQUIERDA: buscadores -->
            <div>

                <!-- BUSCADOR DE ÓRDENES -->
                <h2>AGREGAR ORDEN</h2>
                <div class="campo" style="max-width:500px; margin-bottom:12px;">
                    <input
                        type="text"
                        id="buscadorOrdenFact"
                        placeholder="BUSCAR ORDEN POR N°, CLIENTE O EQUIPO..."
                        oninput="filtrarOrdenesFacturacion()"
                        style="text-transform:uppercase;"
                    >
                </div>
                <div id="resultadosOrdenes" style="margin-bottom:24px;"></div>

                <!-- BUSCADOR DE PRODUCTOS -->
                <h2>AGREGAR PRODUCTO DE STOCK</h2>
                <div class="campo" style="max-width:500px; margin-bottom:12px;">
                    <input
                        type="text"
                        id="buscadorProductoFact"
                        placeholder="BUSCAR PRODUCTO POR ID O DESCRIPCIÓN..."
                        oninput="filtrarProductosFacturacion()"
                        style="text-transform:uppercase;"
                    >
                </div>
                <div id="resultadosProductos" style="margin-bottom:24px;"></div>

                <!-- CARGO MANUAL (ingreso) -->
                <h2>CARGO MANUAL</h2>
                <div class="formulario" style="max-width:500px;">
                    <div class="fila">
                        <div class="campo">
                            <label>DESCRIPCIÓN</label>
                            <input type="text" id="manualDesc" placeholder="Descripción del cargo...">
                        </div>
                        <div class="campo">
                            <label>PRECIO</label>
                            <input type="number" id="manualPrecio" min="0" placeholder="0">
                        </div>
                    </div>
                    <button class="guardar-btn" onclick="agregarManual()" style="margin-top:0; width:200px;">
                        + AGREGAR
                    </button>
                </div>

                <!-- EGRESO -->
                <h2 style="color:#E74C3C;">REGISTRAR EGRESO</h2>
                <div class="formulario" style="max-width:500px;">
                    <div class="fila">
                        <div class="campo">
                            <label>DESCRIPCIÓN DEL EGRESO</label>
                            <input type="text" id="egresoDesc" placeholder="Ej: Compra de repuestos, gastos varios...">
                        </div>
                        <div class="campo">
                            <label>MONTO</label>
                            <input type="number" id="egresoMonto" min="0" placeholder="0">
                        </div>
                    </div>
                    <button
                        class="guardar-btn"
                        onclick="registrarEgreso()"
                        style="margin-top:0; width:220px; background:#F8D7DA; color:#721C24;"
                    >
                        − REGISTRAR EGRESO
                    </button>
                </div>

            </div>

            <!-- COLUMNA DERECHA: ticket/cobro -->
            <div style="position:sticky; top:20px;">

                <h2>TICKET</h2>

                <div id="ticketContainer" style="
                    background:white;
                    color:black;
                    border-radius:12px;
                    padding:20px;
                    min-height:200px;
                ">
                    <div id="ticketItems">
                        <p style="color:#888; text-align:center; padding:20px 0;">AGREGÁ ITEMS PARA COMENZAR</p>
                    </div>

                    <hr style="margin:16px 0; border-color:#ddd;">

                    <!-- SUBTOTAL -->
                    <div style="display:flex; justify-content:space-between; font-weight:700; font-size:15px; margin-bottom:12px;">
                        <span>SUBTOTAL</span>
                        <span id="ticketSubtotal">$0</span>
                    </div>

                    <!-- VENDEDOR (comisión por venta cerrada) -->
                    ${selectVendedorHTML()}

                    <!-- MÉTODO DE PAGO -->
                    <div style="margin-bottom:14px;">
                        <label style="font-weight:700; font-size:13px; text-transform:uppercase; display:block; margin-bottom:6px;">MÉTODO DE PAGO</label>
                        <div style="display:flex; gap:10px;">
                            <button id="btnEfectivo"
                                onclick="seleccionarMetodo('EFECTIVO')"
                                style="flex:1; padding:10px; border:2px solid #155724; border-radius:8px; background:#D4EDDA; color:#155724; font-weight:800; cursor:pointer; font-size:13px;">
                                💵 EFECTIVO
                            </button>
                            <button id="btnMP"
                                onclick="seleccionarMetodo('MP')"
                                style="flex:1; padding:10px; border:2px solid #ccc; border-radius:8px; background:white; color:#333; font-weight:800; cursor:pointer; font-size:13px;">
                                📲 MERCADO PAGO
                            </button>
                        </div>
                    </div>

                    <!-- RECARGO MP -->
                    <div id="recargoMPDiv" style="display:none; justify-content:space-between; color:#C0392B; font-weight:700; margin-bottom:10px;">
                        <span>RECARGO MP (10%)</span>
                        <span id="recargoMPMonto">$0</span>
                    </div>

                    <!-- TOTAL -->
                    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:20px; margin-bottom:14px; padding:10px; background:#f8f8f8; border-radius:8px;">
                        <span>TOTAL A COBRAR</span>
                        <span id="ticketTotal" style="color:#1F2A44;">$0</span>
                    </div>

                    <!-- CAMPO EFECTIVO: con cuánto paga -->
                    <div id="efectivoDiv" style="margin-bottom:14px;">
                        <div class="campo">
                            <label style="color:#333;">CON CUÁNTO ABONA</label>
                            <input
                                type="number"
                                id="montoPagado"
                                min="0"
                                placeholder="$0"
                                oninput="calcularVuelto()"
                                style="color:black; font-size:16px; font-weight:700;"
                            >
                        </div>
                        <div id="vueltoDiv" style="
                            display:none;
                            margin-top:10px;
                            padding:12px;
                            background:#D4EDDA;
                            border-radius:8px;
                            display:flex;
                            justify-content:space-between;
                            font-weight:800;
                            font-size:17px;
                            color:#155724;
                        ">
                            <span>VUELTO</span>
                            <span id="montoVuelto">$0</span>
                        </div>
                    </div>

                    <!-- BOTÓN COBRAR -->
                    <button
                        class="guardar-btn"
                        onclick="procesarCobro()"
                        style="width:100%; margin-top:0; background:#4CAF50; color:white;"
                    >
                        ✓ COBRAR
                    </button>

                </div>

            </div>

        </div>

    `;

    actualizarTicket();
}


// ── BUSCADORES ──────────────────────────────

function filtrarOrdenesFacturacion(){
    const txt = document.getElementById("buscadorOrdenFact").value.trim().toLowerCase();
    const cont = document.getElementById("resultadosOrdenes");
    if(txt === ""){ cont.innerHTML = ""; return; }

    // Solo órdenes en estado LISTO (listas para entregar y cobrar)
    const resultados = ordenes.filter(o =>
        o.estado === "LISTO" &&
        (
            o.numero.includes(txt) ||
            (o.cliente.nombre + " " + o.cliente.apellido).toLowerCase().includes(txt) ||
            (o.equipo.marca + " " + o.equipo.modelo).toLowerCase().includes(txt)
        )
    ).slice(0, 6);

    if(resultados.length === 0){
        cont.innerHTML = `<p style="color:#aaa; font-size:13px; margin-top:6px;">SIN RESULTADOS</p>`;
        return;
    }

    let html = `<table style="margin-top:0;"><thead><tr>
        <th>N°</th><th>CLIENTE</th><th>EQUIPO</th><th>ESTADO</th><th>PRESUP.</th><th></th>
    </tr></thead><tbody>`;

    resultados.forEach(o => {
        const saldo = o.trabajo.presupuesto - (o.trabajo.adelanto || 0);
        html += `<tr>
            <td>${o.numero}</td>
            <td>${o.cliente.nombre} ${o.cliente.apellido}</td>
            <td>${o.equipo.marca} ${o.equipo.modelo}</td>
            <td>${o.estado}</td>
            <td>$${fm(saldo)}</td>
            <td>
                <button onclick="agregarOrdenAlTicket(${o.id})"
                    style="background:#CCE5FF; color:#004085; border:none; border-radius:6px; padding:5px 10px; font-weight:800; cursor:pointer;">
                    + AGREGAR
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    cont.innerHTML = html;
}


function precioConDescuentoHTML(p, precioFinal){
    const d = infoDescuento(p);
    if(!d.aplica) return `$${fm(precioFinal)}`;
    return `<span style="text-decoration:line-through; color:#888; font-size:11px;">$${fm(d.original)}</span>
            <span style="background:#16A34A; color:white; border-radius:4px; padding:1px 5px; font-size:10px; font-weight:800;">-${fmPct(d.pct)}%</span><br>
            $${fm(precioFinal)}`;
}

function filtrarProductosFacturacion(){
    const txt = document.getElementById("buscadorProductoFact").value.trim().toLowerCase();
    const cont = document.getElementById("resultadosProductos");
    if(txt === ""){ cont.innerHTML = ""; return; }

    const resultados = stock.filter(p =>
        p.descripcion.toLowerCase().includes(txt) ||
        p.id.toLowerCase().includes(txt)
    ).slice(0, 6);

    if(resultados.length === 0){
        cont.innerHTML = `<p style="color:#aaa; font-size:13px; margin-top:6px;">SIN RESULTADOS</p>`;
        return;
    }

    let html = `<table style="margin-top:0;"><thead><tr>
        <th>ID</th><th>DESCRIPCIÓN</th><th>EFECTIVO</th><th>DÉBITO/MP</th><th>STOCK</th><th></th>
    </tr></thead><tbody>`;

    resultados.forEach(p => {
        const cantidad = p.cantidad ?? 0;
        const stockStyle = cantidad <= 2 ? "color:#C0392B; font-weight:800;" : "";
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.descripcion}</td>
            <td>${precioConDescuentoHTML(p, precioVentaEfectivo(p))}</td>
            <td>$${fm(precioVentaDebito(p))}</td>
            <td style="${stockStyle}">${cantidad}</td>
            <td>
                <button onclick="agregarProductoAlTicket('${p.id}')"
                    ${cantidad <= 0 ? 'disabled style="background:#eee; color:#aaa; border:none; border-radius:6px; padding:5px 10px; font-weight:800; cursor:not-allowed;"' : 'style="background:#D4EDDA; color:#155724; border:none; border-radius:6px; padding:5px 10px; font-weight:800; cursor:pointer;"'}>
                    ${cantidad <= 0 ? 'SIN STOCK' : '+ AGREGAR'}
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    cont.innerHTML = html;
}


// ── AGREGAR ITEMS AL TICKET ──────────────────

function agregarOrdenAlTicket(id){
    const orden = ordenes.find(o => o.id === id);
    if(!orden) return;

    // No agregar la misma orden dos veces
    if(ventaActual.items.find(i => i.tipo === "ORDEN" && i.idRef === id)){
        alert("ESA ORDEN YA ESTÁ EN EL TICKET.");
        return;
    }

    const saldo = orden.trabajo.presupuesto - (orden.trabajo.adelanto || 0);

    ventaActual.items.push({
        tipo: "ORDEN",
        descripcion: `Orden #${orden.numero} — ${orden.cliente.nombre} ${orden.cliente.apellido} (${orden.equipo.marca} ${orden.equipo.modelo})`,
        precio: saldo,
        cantidad: 1,
        idRef: id
    });

    // Limpiar buscador
    document.getElementById("buscadorOrdenFact").value = "";
    document.getElementById("resultadosOrdenes").innerHTML = "";

    actualizarTicket();
}


function agregarProductoAlTicket(idProducto){
    const producto = stock.find(p => p.id === idProducto);
    if(!producto) return;
    if((producto.cantidad ?? 0) <= 0){ alert("SIN STOCK DISPONIBLE."); return; }

    // Si ya está en el ticket, solo sumar cantidad
    const existing = ventaActual.items.find(i => i.tipo === "PRODUCTO" && i.idRef === idProducto);
    if(existing){
        existing.cantidad++;
    } else {
        // El precio se ajusta según método de pago al momento de calcular
        ventaActual.items.push({
            tipo: "PRODUCTO",
            descripcion: producto.descripcion,
            precioEfectivo: precioVentaEfectivo(producto),   // ya con descuento web si corresponde
            precioDebito: precioVentaDebito(producto),
            precio: precioVentaEfectivo(producto), // default efectivo
            cantidad: 1,
            idRef: idProducto
        });
    }

    document.getElementById("buscadorProductoFact").value = "";
    document.getElementById("resultadosProductos").innerHTML = "";

    actualizarTicket();
}


function agregarManual(){
    const desc = document.getElementById("manualDesc").value.trim();
    const precio = Number(document.getElementById("manualPrecio").value);

    if(!desc || !precio || precio <= 0){
        alert("COMPLETÁ LA DESCRIPCIÓN Y EL PRECIO.");
        return;
    }

    ventaActual.items.push({
        tipo: "MANUAL",
        descripcion: capitalizar(desc),
        precio: precio,
        cantidad: 1,
        idRef: null
    });

    document.getElementById("manualDesc").value = "";
    document.getElementById("manualPrecio").value = "";

    actualizarTicket();
}


function registrarEgreso(){

    const desc  = document.getElementById("egresoDesc").value.trim();
    const monto = Number(document.getElementById("egresoMonto").value);

    if(!desc || !monto || monto <= 0){
        alert("COMPLETÁ LA DESCRIPCIÓN Y EL MONTO DEL EGRESO.");
        return;
    }

    const confirmar = confirm(`REGISTRAR EGRESO DE $${fm(monto)}?\n"${capitalizar(desc)}"`);
    if(!confirmar) return;

    registrarMovimientoCaja({
        fecha:       obtenerFechaArgentina(),
        tipo:        "EGRESO",
        descripcion: capitalizar(desc),
        monto:       -monto,   // negativo
        metodoPago:  "EFECTIVO"
    });

    guardarRegistro("FACTURACIÓN", "EGRESO", `${capitalizar(desc)} — $${fm(monto)}`);

    document.getElementById("egresoDesc").value  = "";
    document.getElementById("egresoMonto").value = "";

    alert(`✓ EGRESO DE $${fm(monto)} REGISTRADO.`);
}


function quitarItem(index){
    ventaActual.items.splice(index, 1);
    actualizarTicket();
}


// ── TICKET / CÁLCULOS ────────────────────────

function seleccionarMetodo(metodo){
    ventaActual.metodoPago = metodo;

    document.getElementById("btnEfectivo").style.border = metodo === "EFECTIVO" ? "2px solid #155724" : "2px solid #ccc";
    document.getElementById("btnEfectivo").style.background = metodo === "EFECTIVO" ? "#D4EDDA" : "white";
    document.getElementById("btnEfectivo").style.color = metodo === "EFECTIVO" ? "#155724" : "#333";

    document.getElementById("btnMP").style.border = metodo === "MP" ? "2px solid #004085" : "2px solid #ccc";
    document.getElementById("btnMP").style.background = metodo === "MP" ? "#CCE5FF" : "white";
    document.getElementById("btnMP").style.color = metodo === "MP" ? "#004085" : "#333";

    // Mostrar/ocultar recargo y campo efectivo
    document.getElementById("recargoMPDiv").style.display = metodo === "MP" ? "flex" : "none";
    document.getElementById("efectivoDiv").style.display = metodo === "EFECTIVO" ? "block" : "none";

    actualizarTicket();
}


function actualizarTicket(){
    const ticketItems = document.getElementById("ticketItems");
    if(!ticketItems) return;

    const esMP = ventaActual.metodoPago === "MP";

    if(ventaActual.items.length === 0){
        ticketItems.innerHTML = `<p style="color:#888; text-align:center; padding:20px 0;">AGREGÁ ITEMS PARA COMENZAR</p>`;
        document.getElementById("ticketSubtotal").textContent = "$0";
        document.getElementById("ticketTotal").textContent = "$0";
        if(document.getElementById("recargoMPMonto")) document.getElementById("recargoMPMonto").textContent = "$0";
        return;
    }

    let subtotal = 0;
    let htmlItems = "";

    ventaActual.items.forEach((item, i) => {
        // Para productos: el precio cambia según método de pago
        let precioUnitario = item.precio;
        if(item.tipo === "PRODUCTO"){
            precioUnitario = esMP ? item.precioDebito : item.precioEfectivo;
        }
        const precioLinea = precioUnitario * item.cantidad;
        subtotal += precioLinea;

        htmlItems += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #eee; gap:8px;">
                <div style="flex:1; font-size:13px;">
                    <div style="font-weight:600;">${item.descripcion}</div>
                    ${item.cantidad > 1 ? `<div style="color:#888; font-size:11px;">${item.cantidad} x $${fm(precioUnitario)}</div>` : ""}
                </div>
                <div style="font-weight:700; white-space:nowrap;">$${fm(precioLinea)}</div>
                <button onclick="quitarItem(${i})" style="background:#F8D7DA; color:#721C24; border:none; border-radius:4px; width:22px; height:22px; font-weight:800; cursor:pointer; font-size:12px; flex-shrink:0;">×</button>
            </div>
        `;
    });

    ticketItems.innerHTML = htmlItems;
    document.getElementById("ticketSubtotal").textContent = `$${fm(subtotal)}`;

    // Para órdenes y manuales: si es MP se aplica el +10% sobre el total también
    // Para productos ya cambia el precio unitario, así que no volvemos a recargar
    const totalProductos = ventaActual.items
        .filter(i => i.tipo === "PRODUCTO")
        .reduce((acc, i) => acc + (esMP ? i.precioDebito : i.precioEfectivo) * i.cantidad, 0);

    const totalOtros = ventaActual.items
        .filter(i => i.tipo !== "PRODUCTO")
        .reduce((acc, i) => acc + i.precio * i.cantidad, 0);

    let totalFinal;
    let recargo = 0;
    if(esMP){
        recargo = Math.round(totalOtros * 0.10);
        totalFinal = totalProductos + totalOtros + recargo;
    } else {
        totalFinal = subtotal;
    }

    if(document.getElementById("recargoMPMonto")) document.getElementById("recargoMPMonto").textContent = `$${fm(recargo)}`;
    document.getElementById("ticketTotal").textContent = `$${fm(totalFinal)}`;

    calcularVuelto();
}


function calcularVuelto(){
    const totalEl = document.getElementById("ticketTotal");
    if(!totalEl) return;
    const total = Number(totalEl.textContent.replace("$","").replace(/\./g,""));
    const pagado = Number(document.getElementById("montoPagado")?.value || 0);

    const vueltoDiv = document.getElementById("vueltoDiv");
    if(!vueltoDiv) return;

    if(pagado > 0 && pagado >= total){
        const vuelto = pagado - total;
        document.getElementById("montoVuelto").textContent = `$${fm(vuelto)}`;
        vueltoDiv.style.display = "flex";
    } else {
        vueltoDiv.style.display = "none";
    }
}


// ── PROCESAR COBRO ────────────────────────────

function procesarCobro(){

    if(ventaActual.items.length === 0){
        alert("EL TICKET ESTÁ VACÍO.");
        return;
    }

    const totalEl = document.getElementById("ticketTotal");
    const total = Number(totalEl.textContent.replace("$","").replace(/\./g,""));

    if(total <= 0){
        alert("EL TOTAL NO PUEDE SER $0.");
        return;
    }

    // Validación efectivo: que haya ingresado cuánto paga
    if(ventaActual.metodoPago === "EFECTIVO"){
        const pagado = Number(document.getElementById("montoPagado")?.value || 0);
        if(pagado < total){
            alert("EL MONTO ABONADO ES MENOR AL TOTAL.");
            return;
        }
    }

    const confirmar = confirm(`CONFIRMAR COBRO DE $${fm(total)} EN ${ventaActual.metodoPago}?`);
    if(!confirmar) return;

    const fecha = obtenerFechaArgentina();

    // 1. Registrar en caja
    const descripcionCobro = ventaActual.items.map(i => i.descripcion).join(" | ");
    registrarMovimientoCaja({
        fecha,
        tipo: "INGRESO",
        descripcion: descripcionCobro,
        monto: total,
        metodoPago: ventaActual.metodoPago
    });

    // 2. Marcar órdenes como ENTREGADO y descontar stock de productos
    ventaActual.items.forEach(item => {
        if(item.tipo === "ORDEN"){
            const orden = ordenes.find(o => o.id === item.idRef);
            if(orden){
                orden.estado = "ENTREGADO";
                orden.cobrada = true;
                orden.fechaCobro = fecha;
                orden.metodoPago = ventaActual.metodoPago;
                orden.montoCobrado = item.precio;
                orden.fechaUltimaModificacion = fecha;
                // Actualizar adelanto al total para que el saldo quede en $0
                orden.trabajo.adelanto = orden.trabajo.presupuesto;
                if(!orden.historial) orden.historial = [];
                orden.historial.push({
                    fecha,
                    tipo: "COBRO",
                    detalle: `Cobrado $${item.precio} en ${ventaActual.metodoPago}`
                });
            }
        }
        if(item.tipo === "PRODUCTO"){
            const producto = stock.find(p => p.id === item.idRef);
            if(producto){
                producto.cantidad = Math.max(0, (producto.cantidad ?? 0) - item.cantidad);
            }
        }
    });

    // 3. Comisión del vendedor por venta cerrada
    // Base: productos y cobros manuales del ticket (las órdenes de reparación
    // son del técnico). Se acredita en el saldo del vendedor (sección Técnicos).
    let avisoComision = "";
    const vendedorId = document.getElementById("selectVendedor")?.value || "";
    if(vendedorId){
        const vendedor = tecnicos.find(t => t.id === vendedorId);
        const esMPnow  = ventaActual.metodoPago === "MP";
        const baseVenta = ventaActual.items
            .filter(i => i.tipo !== "ORDEN")
            .reduce((acc, i) => {
                const unit = i.tipo === "PRODUCTO" ? (esMPnow ? i.precioDebito : i.precioEfectivo) : i.precio;
                return acc + unit * i.cantidad;
            }, 0);
        const comision = vendedor ? Math.round(baseVenta * ((vendedor.porcentajeVenta || 0) / 100)) : 0;

        if(vendedor && comision > 0){
            facturacionExtra.push({
                id:         "fex_" + Date.now(),
                tecnicoId:  vendedor.id,
                fecha:      fecha.split(",")[0].trim(),
                detalle:    "Comisión venta: " + descripcionCobro.slice(0, 80),
                monto:      comision,
                metodoPago: "EFECTIVO"
            });
            guardarFacturacionExtra();
            avisoComision = `\nCOMISIÓN DE ${vendedor.nombre.toUpperCase()}: $${fm(comision)}`;
        }
    }

    // Registro de actividad: qué se vendió/cobró, cuánto, cómo y quién vendió
    const _vend = tecnicos.find(t => t.id === vendedorId);
    const _hayProductos = ventaActual.items.some(i => i.tipo !== "ORDEN");
    guardarRegistro("FACTURACIÓN", _hayProductos ? "VENTA" : "COBRO DE ORDEN",
        `${descripcionCobro.slice(0, 150)} — Total $${fm(total)} en ${ventaActual.metodoPago}` +
        (_vend ? ` — Vendedor: ${_vend.nombre} ${_vend.apellido}` : ""));

    guardarDatos();
    guardarStock();

    alert(`✓ COBRO REGISTRADO. TOTAL: $${fm(total)}${avisoComision}`);

    // Resetear y volver a la pantalla limpia
    ventaActual = { items: [], metodoPago: "EFECTIVO" };
    renderFacturacion();
}