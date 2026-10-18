function mostrarClientes(){
    if (!verificarAcceso()) return;
    guardarRegistro("CLIENTES", "VER", "Accedió a Clientes");

    activarBoton(3);

    // Construimos la lista de clientes únicos agrupando por DNI
    const clientesMap = {};

    ordenes.forEach(orden => {
        const dni = orden.cliente.documento;
        if(!clientesMap[dni]){
            clientesMap[dni] = {
                nombre:    orden.cliente.nombre,
                apellido:  orden.cliente.apellido,
                documento: dni,
                telefono:  orden.cliente.telefono
            };
        }
    });

    const clientes = Object.values(clientesMap);

    document.getElementById("contenido").innerHTML = `

        <h1>CLIENTES</h1>

        <!-- BUSCADOR -->
        <!-- oninput se ejecuta cada vez que escribís una letra, sin necesidad de apretar Enter -->
        <div class="campo" style="max-width:400px; margin-bottom:20px;">
            <input
                type="text"
                id="buscadorClientes"
                placeholder="BUSCAR POR NOMBRE, APELLIDO O DNI..."
                oninput="filtrarClientes()"
                style="text-transform:uppercase;"
            >
        </div>

        <table>
            <thead>
                <tr>
                    <th>NOMBRE Y APELLIDO</th>
                    <th>DNI</th>
                    <th>TELÉFONO</th>
                </tr>
            </thead>
            <tbody id="tablaClientes">
                <!-- Las filas se generan acá abajo con renderTablaClientes() -->
            </tbody>
        </table>

    `;

    // Guardamos la lista completa en una variable global
    // para que filtrarClientes() pueda acceder a ella
    window._listaClientes = clientes;

    // Mostramos todos los clientes al arrancar
    renderTablaClientes(clientes);
}


// Dibuja las filas en la tabla según la lista que recibe
function renderTablaClientes(lista){

    const tbody = document.getElementById("tablaClientes");

    if(!tbody) return;

    if(lista.length === 0){
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center;color:#888;">
                    NO SE ENCONTRARON CLIENTES
                </td>
            </tr>
        `;
        return;
    }

    let filas = "";

    lista.forEach(cliente => {
        filas += `
            <tr onclick="verCliente('${cliente.documento}')">
                <td>${cliente.nombre} ${cliente.apellido}</td>
                <td>${cliente.documento}</td>
                <td>${ftTel(cliente.telefono)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = filas;
}


// Se ejecuta cada vez que escribís en el buscador
function filtrarClientes(){

    const texto = document.getElementById("buscadorClientes")
        .value.trim().toLowerCase();

    // Si el campo está vacío mostramos todos
    if(texto === ""){
        renderTablaClientes(window._listaClientes);
        return;
    }

    // Filtramos: buscamos el texto en nombre, apellido o DNI
    const filtrados = window._listaClientes.filter(cliente => {
        const nombreCompleto = (cliente.nombre + " " + cliente.apellido).toLowerCase();
        const dni = cliente.documento.toLowerCase();
        return nombreCompleto.includes(texto) || dni.includes(texto);
    });

    renderTablaClientes(filtrados);
}


// Muestra el historial de órdenes de un cliente
function verCliente(dni){

    const datosCliente = ordenes.find(o => o.cliente.documento === dni)?.cliente;

    if(!datosCliente){
        alert("CLIENTE NO ENCONTRADO");
        return;
    }

    const ordenesCliente = ordenes.filter(o => o.cliente.documento === dni);

    let filas = "";

    ordenesCliente.forEach(orden => {
        filas += `
            <tr onclick="verOrden(${orden.id})">
                <td>${orden.numero}</td>
                <td>${orden.fechaCreacion}</td>
                <td>${orden.equipo.marca} ${orden.equipo.modelo}</td>
                <td>
                    <span class="badge estado-${orden.estado.replace(/ /g,"-").toLowerCase()}">
                        ${orden.estado}
                    </span>
                </td>
                <td>$${orden.trabajo.presupuesto}</td>
            </tr>
        `;
    });

    document.getElementById("contenido").innerHTML = `

        <h1>${datosCliente.nombre} ${datosCliente.apellido}</h1>

        <div class="info-orden">
            <div><strong>DNI:</strong> ${datosCliente.documento}</div>
            <div><strong>TELÉFONO:</strong> ${ftTel(datosCliente.telefono)}</div>
        </div>

        <h2>HISTORIAL DE ÓRDENES</h2>

        <table>
            <thead>
                <tr>
                    <th>N°</th>
                    <th>FECHA</th>
                    <th>EQUIPO</th>
                    <th>ESTADO</th>
                    <th>PRESUPUESTO</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>

        <br>

        <button
            class="guardar-btn"
            style="background:#E2E3E5; color:#333;"
            onclick="mostrarClientes()"
        >
            VOLVER
        </button>

    `;
}