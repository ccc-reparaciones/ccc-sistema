function capitalizar(texto){
    return texto
        .toLowerCase()
        .split(" ")
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" ");
}

function mostrarOrdenes(){
    if (!verificarAcceso()) return;
    activarBoton(1);
    guardarRegistro("CREAR ORDEN", "VER", "Accedió a Crear Orden");

    const numeroOrden = generarNumeroOrden();
    const fechaActual = obtenerFechaArgentina();

    document.getElementById("contenido").innerHTML = `

        <h1>NUEVA ORDEN DE REPARACIÓN</h1>

        <div class="info-orden">
            <div><strong>ORDEN N°:</strong> ${numeroOrden}</div>
            <div><strong>FECHA:</strong> ${fechaActual}</div>
        </div>

        <div class="formulario">

            <h2>DATOS DEL CLIENTE</h2>

            <div class="fila">
                <div class="campo">
                    <label>NOMBRE *</label>
                    <input type="text" id="nombre">
                </div>
                <div class="campo">
                    <label>APELLIDO *</label>
                    <input type="text" id="apellido">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>DNI *</label>
                    <input type="text" id="documento" oninput="fmInput(this)">
                </div>
                <div class="campo">
                    <label>TELÉFONO</label>
                    <input type="text" id="telefono" oninput="ftTelInput(this)" placeholder="Ej: 1140615429">
                </div>
            </div>

            <h2>DATOS DEL EQUIPO</h2>

            <div class="fila">
                <div class="campo">
                    <label>MARCA *</label>
                    <input type="text" id="marca">
                </div>
                <div class="campo">
                    <label>MODELO *</label>
                    <input type="text" id="modelo">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>IMEI</label>
                    <input type="text" id="imei">
                </div>
                <div class="campo">
                    <label>COLOR *</label>
                    <input type="text" id="color">
                </div>
            </div>

            <h2>DATOS DEL TRABAJO</h2>

            <div class="fila">
                <div class="campo">
                    <label>PRESUPUESTO ESTIMADO *</label>
                    <input type="text" id="presupuesto" oninput="fmInput(this)" placeholder="0">
                </div>
                <div class="campo">
                    <label>ADELANTO</label>
                    <input type="text" id="adelanto" oninput="fmInput(this)" placeholder="0">
                </div>
            </div>

            <div class="fila-revision">
                <label>SE REVISAN FUNCIONES *</label>
                <select id="revisanFunciones">
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                </select>
            </div>

            <div class="campo">
                <label>FALLA REPORTADA *</label>
                <input type="text" id="fallaReportada">
            </div>

            <div class="campo">
                <label>ESTADO DEL EQUIPO *</label>
                <textarea id="estadoEquipo"></textarea>
            </div>

            <button class="guardar-btn" onclick="guardarOrden()">
                GUARDAR ORDEN
            </button>

        </div>

    `;
}


function guardarOrden(){
    if (!verificarAcceso()) return;

    const nombre        = capitalizar(document.getElementById("nombre").value.trim());
    const apellido      = capitalizar(document.getElementById("apellido").value.trim());
    const documento     = String(leerNumero("documento") || document.getElementById("documento").value.trim());
    const telefono      = leerTel("telefono");
    const marca         = capitalizar(document.getElementById("marca").value.trim());
    const modelo        = capitalizar(document.getElementById("modelo").value.trim());
    const imei          = document.getElementById("imei").value.trim();
    const color         = capitalizar(document.getElementById("color").value.trim());
    const presupuesto   = leerNumero("presupuesto");
    const adelanto      = leerNumero("adelanto") || 0;
    const revisanFunciones = document.getElementById("revisanFunciones").value;
    const fallaReportada   = capitalizar(document.getElementById("fallaReportada").value.trim());
    const estadoEquipo     = capitalizar(document.getElementById("estadoEquipo").value.trim());

    if(
        nombre === "" || apellido === "" || documento === "0" || documento === "" ||
        marca === ""  || modelo === ""   || color === ""     ||
        presupuesto === 0 ||
        fallaReportada === "" || estadoEquipo === ""
    ){
        alert("COMPLETÁ TODOS LOS CAMPOS OBLIGATORIOS.");
        return;
    }

    const fechaActual = obtenerFechaArgentina();

    ordenes.push({
        id: Date.now(),
        numero: generarNumeroOrden(),
        fechaCreacion: fechaActual,
        fechaUltimaModificacion: fechaActual,
        cliente:{ nombre, apellido, documento, telefono },
        equipo:{ marca, modelo, imei, color },
        trabajo:{
            presupuesto,
            adelanto,
            revisanFunciones,
            fallaReportada,
            estadoEquipo,
            observaciones: ""
        },
        estado: "INGRESADO",
        historial:[{
            fecha:   fechaActual,
            tipo:    "INGRESO",
            detalle: `Ingresa equipo al local — creado por ${usuarioActual()}`
        }]
    });

    const nuevaOrden = ordenes[ordenes.length - 1];
    ultimoNumeroOrden++;
    guardarDatos();

    guardarRegistro("CREAR ORDEN", "NUEVA ORDEN", `Orden N°${nuevaOrden.numero} — ${nombre} ${apellido} — ${marca} ${modelo}`);

    if(adelanto > 0){
        const metodoAdelanto = confirm(
            `SE REGISTRÓ UN ADELANTO DE $${fm(adelanto)}.\n\n` +
            `¿Con qué método se cobró?\n\nOK → EFECTIVO\nCANCELAR → MERCADO PAGO`
        ) ? "EFECTIVO" : "MP";

        registrarMovimientoCaja({
            fecha:       obtenerFechaArgentina(),
            tipo:        "INGRESO",
            descripcion: `Adelanto Orden #${nuevaOrden.numero} — ${nombre} ${apellido} (${marca} ${modelo})`,
            monto:       adelanto,
            metodoPago:  metodoAdelanto
        });

        nuevaOrden.metodoPagoAdelanto = metodoAdelanto;
        guardarDatos();

        guardarRegistro("CAJA", "ADELANTO", `Adelanto $${fm(adelanto)} (${metodoAdelanto}) — Orden N°${nuevaOrden.numero}`);
    }

    verOrden(nuevaOrden.id);
}