function mostrarListadoOrdenes(){
    if (!verificarAcceso()) return;
    activarBoton(2);
    guardarRegistro("ÓRDENES", "VER", "Accedió al listado de órdenes");

    let filas = "";

    ordenes.forEach(orden => {
        filas += `
            <tr onclick="verOrden(${orden.id})" style="cursor:pointer">
                <td>${orden.numero}</td>
                <td>${orden.fechaCreacion}</td>
                <td>${orden.cliente.nombre} ${orden.cliente.apellido}</td>
                <td>${orden.equipo.marca} ${orden.equipo.modelo}</td>
                <td>
                    <span class="badge estado-${orden.estado.replace(/ /g,"-").toLowerCase()}">
                        ${orden.estado}
                    </span>
                </td>
            </tr>
        `;
    });

    if(filas === ""){
        filas = `<tr><td colspan="5">NO HAY ÓRDENES CARGADAS</td></tr>`;
    }

    document.getElementById("contenido").innerHTML = `
        <h1>ÓRDENES</h1>
        <div class="tabla-wrapper"><table>
            <thead>
                <tr>
                    <th>N°</th>
                    <th>FECHA</th>
                    <th>CLIENTE</th>
                    <th>EQUIPO</th>
                    <th>ESTADO</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table></div>
    `;
}