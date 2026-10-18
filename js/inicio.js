function mostrarInicio(){
    if (!verificarAcceso()) return;

    activarBoton(0);
    guardarRegistro("INICIO", "VER", "Accedió al dashboard");

    const fechaActual = obtenerFechaArgentina();
    const hoy  = fechaActual.split(",")[0].trim();

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit", month: "2-digit", year: "numeric"
    });

    const ordenesActivas = ordenes.filter(o => o.estado !== "ENTREGADO");

    let filas = "";
    ordenesActivas.forEach(orden => {
        filas += `
            <tr onclick="verOrden(${orden.id})">
                <td>${orden.numero}</td>
                <td>${orden.fechaCreacion}</td>
                <td>${orden.cliente.nombre} ${orden.cliente.apellido}</td>
                <td>${orden.equipo.marca} ${orden.equipo.modelo}</td>
                <td>${ftTel(orden.cliente.telefono)}</td>
                <td>$${fm(orden.trabajo.presupuesto)}</td>
                <td>
                    <span class="badge estado-${orden.estado.replace(/ /g,"-").toLowerCase()}">
                        ${orden.estado}
                    </span>
                </td>
            </tr>
        `;
    });

    if(filas === ""){
        filas = `
            <tr>
                <td colspan="7" style="text-align:center;color:#888;">
                    NO HAY ÓRDENES ACTIVAS
                </td>
            </tr>
        `;
    }

    function resumenDia(dia){
        const movs = caja.filter(m => m.fecha.split(",")[0].trim() === dia);
        const ingresos  = movs.filter(m => m.monto > 0 && m.tipo !== "EGRESO");
        const egresos   = movs.filter(m => m.monto < 0);
        const ingEquipos = ingresos.filter(m => m.descripcion.toLowerCase().includes("orden")).reduce((a, m) => a + m.monto, 0);
        const ingVentas  = ingresos.filter(m => !m.descripcion.toLowerCase().includes("orden")).reduce((a, m) => a + m.monto, 0);
        const totalIngresos = ingresos.reduce((a, m) => a + m.monto, 0);
        const totalEgresos  = egresos.reduce((a, m)  => a + m.monto, 0);
        const totalNeto     = totalIngresos + totalEgresos;
        const cantMovs      = movs.length;
        return { ingEquipos, ingVentas, totalIngresos, totalEgresos, totalNeto, cantMovs };
    }

    function bloqueResumen(res){
        const colorNeto = res.totalNeto > 0 ? "#155724" : res.totalNeto < 0 ? "#721C24" : "#555";
        const bgNeto    = res.totalNeto > 0 ? "#D4EDDA"  : res.totalNeto < 0 ? "#F8D7DA"  : "#E2E3E5";
        return `
            <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:20px;">
                <div style="background:white; color:black; border-radius:10px; padding:14px 16px; border-left:5px solid #9ED1F7;">
                    <div style="font-size:11px; font-weight:700; color:#555; margin-bottom:4px; text-transform:uppercase;">MOVIMIENTOS</div>
                    <div style="font-size:22px; font-weight:800;">${res.cantMovs}</div>
                </div>
                <div style="background:white; color:black; border-radius:10px; padding:14px 16px; border-left:5px solid #4CAF50;">
                    <div style="font-size:11px; font-weight:700; color:#555; margin-bottom:4px; text-transform:uppercase;">EQUIPOS</div>
                    <div style="font-size:22px; font-weight:800; color:#155724;">+$${fm(res.ingEquipos)}</div>
                </div>
                <div style="background:white; color:black; border-radius:10px; padding:14px 16px; border-left:5px solid #8B0000;">
                    <div style="font-size:11px; font-weight:700; color:#555; margin-bottom:4px; text-transform:uppercase;">VENTAS</div>
                    <div style="font-size:22px; font-weight:800; color:#8B0000;">+$${fm(res.ingVentas)}</div>
                </div>
                <div style="background:white; color:black; border-radius:10px; padding:14px 16px; border-left:5px solid #E74C3C;">
                    <div style="font-size:11px; font-weight:700; color:#555; margin-bottom:4px; text-transform:uppercase;">EGRESOS</div>
                    <div style="font-size:22px; font-weight:800; color:#721C24;">$${fm(res.totalEgresos)}</div>
                </div>
                <div style="background:${bgNeto}; color:${colorNeto}; border-radius:10px; padding:14px 16px; border-left:5px solid ${colorNeto};">
                    <div style="font-size:11px; font-weight:700; margin-bottom:4px; text-transform:uppercase;">TOTAL NETO</div>
                    <div style="font-size:22px; font-weight:800;">${res.totalNeto >= 0 ? "+" : ""}$${res.totalNeto}</div>
                </div>
            </div>
        `;
    }

    const hoyRes  = resumenDia(hoy);
    const ayerRes = resumenDia(ayerStr);

    document.getElementById("contenido").innerHTML = `
        <h1>${fechaActual}</h1>
        <h2>ÓRDENES ACTIVAS</h2>
        <table>
            <thead>
                <tr>
                    <th>N°</th><th>INGRESO</th><th>CLIENTE</th>
                    <th>EQUIPO</th><th>TELÉFONO</th><th>PRESUPUESTO</th><th>ESTADO</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        <br>
        <h2>FACTURACIÓN HOY</h2>
        ${bloqueResumen(hoyRes)}
        <h2>FACTURACIÓN AYER (${ayerStr})</h2>
        ${bloqueResumen(ayerRes)}
    `;
}