// =============================================
// STOCK
// Cada producto tiene: id, descripcion, costo,
// precioEfectivo, precioDebito (efectivo +10%),
// cantidad (stock disponible)
// Opcionales para la web (página principal):
//   mostrarWeb (bool), detalle (texto), imagen (dataURL),
//   descuento (% > 1, opcional)
// =============================================

function guardarStock(){
    guardarClave("stock");
    // Actualiza la lista pública y la portada
    if(typeof actualizarProductosWeb === "function") actualizarProductosWeb();
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function escapeHTML(txt){
    return String(txt ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Descuento: solo aplica si es mayor a 1%. El precio nuevo se redondea
// al múltiplo de 500 más cercano. Si el redondeo no lo deja por debajo
// del original, el descuento no se aplica.
function infoDescuento(p){
    const original = Number(p.precioEfectivo) || 0;
    const pct      = Number(p.descuento) || 0;
    if(pct > 1 && pct < 100 && original > 0){
        const nuevo = Math.round(original * (1 - pct / 100) / 500) * 500;
        if(nuevo > 0 && nuevo < original){
            return { aplica: true, original, pct, final: nuevo };
        }
    }
    return { aplica: false, original, pct: 0, final: original };
}

function fmPct(pct){
    return String(Number(pct)).replace(".", ",");
}

// Precios que se usan al VENDER (facturación)
function precioVentaEfectivo(p){
    return infoDescuento(p).final;
}
function precioVentaDebito(p){
    const d = infoDescuento(p);
    return d.aplica ? Math.round(d.final * 1.10) : p.precioDebito;
}

// ─────────────────────────────────────────────
// IMAGEN: se achica a 600px y se guarda como JPEG
// para no llenar la base de datos
// ─────────────────────────────────────────────
window._imgTmp = window._imgTmp || {};

function cargarImagenProducto(input, previewId){
    const archivo = input.files && input.files[0];
    const preview = document.getElementById(previewId);
    if(!archivo){
        delete window._imgTmp[input.id];
        if(preview){ preview.style.display = "none"; preview.removeAttribute("src"); }
        return;
    }
    if(!archivo.type.startsWith("image/")){
        alert("EL ARCHIVO TIENE QUE SER UNA IMAGEN.");
        input.value = "";
        return;
    }

    const lector = new FileReader();
    lector.onload = e => {
        const img = new Image();
        img.onload = () => {
            const MAX = 600;
            const escala = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.width  * escala);
            canvas.height = Math.round(img.height * escala);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            window._imgTmp[input.id] = dataUrl;
            if(preview){ preview.src = dataUrl; preview.style.display = "block"; }
        };
        img.onerror = () => alert("NO SE PUDO LEER LA IMAGEN.");
        img.src = e.target.result;
    };
    lector.readAsDataURL(archivo);
}

function toggleBloqueWeb(idBloque, visible){
    const b = document.getElementById(idBloque);
    if(b) b.style.display = visible ? "block" : "none";
}

function previewDescuento(idPrecio, idDescuento, idPreview){
    const cont = document.getElementById(idPreview);
    if(!cont) return;
    const precio = leerNumero(idPrecio);
    const pct    = Number(document.getElementById(idDescuento).value) || 0;
    if(pct === 0){ cont.textContent = ""; return; }
    if(pct <= 1){
        cont.style.color = "#FF9800";
        cont.textContent = "El descuento tiene que ser mayor a 1% para mostrarse.";
        return;
    }
    const d = infoDescuento({ precioEfectivo: precio, descuento: pct });
    if(!precio){
        cont.style.color = "#9ED1F7";
        cont.textContent = "Ingresá el precio efectivo para ver el precio con descuento.";
    } else if(d.aplica){
        cont.style.color = "#4CAF50";
        cont.textContent = `Precio con descuento: $${fm(d.final)} (redondeado a múltiplo de 500)`;
    } else {
        cont.style.color = "#FF9800";
        cont.textContent = "Con este porcentaje el precio redondeado no baja; el descuento no se mostraría.";
    }
}

// Bloque de campos para la web (se usa al agregar y al editar)
function bloqueWebHTML(p, idsPrefix, idPrecio){
    const mostrar = !!p.mostrarWeb;
    const pre = idsPrefix;
    return `
        <div style="margin:6px 0 14px; padding:14px 16px; background:rgba(255,255,255,.06); border-radius:12px;">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; font-weight:800; text-transform:uppercase;">
                <input type="checkbox" id="${pre}MostrarWeb" ${mostrar ? "checked" : ""}
                    onchange="toggleBloqueWeb('${pre}Web', this.checked)"
                    style="width:18px; height:18px; cursor:pointer;">
                MOSTRAR EN LA PÁGINA PRINCIPAL (PRODUCTOS)
            </label>

            <div id="${pre}Web" style="display:${mostrar ? "block" : "none"}; margin-top:14px;">

                <div class="campo" style="margin-bottom:14px;">
                    <label>DESCRIPCIÓN DETALLADA (se ve en "Ver descripción")</label>
                    <textarea id="${pre}Detalle" placeholder="Ej: Pantalla original con marco, incluye instalación y garantía..." style="color:black;">${escapeHTML(p.detalle || "")}</textarea>
                </div>

                <div class="fila">
                    <div class="campo">
                        <label>IMAGEN DEL PRODUCTO</label>
                        <input type="file" id="${pre}Imagen" accept="image/*"
                            onchange="cargarImagenProducto(this, '${pre}ImgPreview')"
                            style="background:white; color:black;">
                        <img id="${pre}ImgPreview"
                            ${p.imagen ? `src="${p.imagen}"` : ""}
                            alt="Vista previa"
                            style="display:${p.imagen ? "block" : "none"}; margin-top:10px; max-width:160px; max-height:160px; object-fit:contain; border-radius:10px; background:white;">
                    </div>
                    <div class="campo">
                        <label>DESCUENTO % (OPCIONAL, MAYOR A 1)</label>
                        <input type="number" id="${pre}Descuento" min="0" max="99" step="0.5"
                            placeholder="Ej: 15" value="${p.descuento || ""}"
                            oninput="previewDescuento('${idPrecio}', '${pre}Descuento', '${pre}DescPreview')"
                            style="color:black;">
                        <div id="${pre}DescPreview" style="margin-top:8px; font-size:12px; font-weight:700;"></div>
                    </div>
                </div>

            </div>
        </div>
    `;
}

// Lee los campos web del formulario (devuelve null si no se muestra en la web)
function leerBloqueWeb(pre, imagenActual){
    const mostrarWeb = document.getElementById(pre + "MostrarWeb")?.checked || false;
    if(!mostrarWeb) return { mostrarWeb: false };

    const detalle   = document.getElementById(pre + "Detalle").value.trim();
    const descuento = Number(document.getElementById(pre + "Descuento").value) || 0;
    const imagen    = window._imgTmp[pre + "Imagen"] || imagenActual || "";

    return { mostrarWeb: true, detalle, descuento: descuento > 1 ? descuento : 0, imagen };
}

// ─────────────────────────────────────────────
// PANTALLA STOCK
// ─────────────────────────────────────────────
function mostrarStock(){
    if (!verificarAcceso()) return;
    guardarRegistro("STOCK", "VER", "Accedió a Stock");
    activarBoton(4);
    renderStock();
}

function filaProductoHTML(producto){
    const cantidad = producto.cantidad ?? 0;
    const alertaStyle = cantidad <= 2 ? "color:#C0392B; font-weight:800;" : "";
    const d = infoDescuento(producto);
    const webTxt = producto.mostrarWeb
        ? `<span style="background:#D4EDDA; color:#155724; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:800;">EN WEB${d.aplica ? " -" + fmPct(d.pct) + "%" : ""}</span>`
        : `<span style="color:#888; font-size:11px; font-weight:700;">NO</span>`;
    return `
        <tr>
            <td>${escapeHTML(producto.id)}</td>
            <td>${escapeHTML(producto.descripcion)}</td>
            <td>$${fm(producto.costo)}</td>
            <td>$${fm(producto.precioEfectivo)}</td>
            <td>$${fm(producto.precioDebito)}</td>
            <td style="text-align:center; ${alertaStyle}">
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                    <button onclick="ajustarCantidad('${producto.id}', -1)" style="background:#F8D7DA; color:#721C24; border:none; border-radius:4px; width:24px; height:24px; font-weight:800; cursor:pointer; font-size:14px;">-</button>
                    <span style="min-width:24px; text-align:center;">${cantidad}</span>
                    <button onclick="ajustarCantidad('${producto.id}', 1)" style="background:#D4EDDA; color:#155724; border:none; border-radius:4px; width:24px; height:24px; font-weight:800; cursor:pointer; font-size:14px;">+</button>
                </div>
            </td>
            <td style="text-align:center;">
                ${webTxt}
                <div style="margin-top:6px;">
                    <button onclick="editarWebProducto('${producto.id}')" style="background:#CCE5FF; color:#004085; border:none; border-radius:6px; padding:4px 10px; font-weight:800; cursor:pointer; font-size:11px;">EDITAR WEB</button>
                </div>
            </td>
            <td style="text-align:center;">
                <button onclick="eliminarProducto('${producto.id}')" style="background:#F8D7DA; color:#721C24; border:none; border-radius:6px; padding:5px 12px; font-weight:800; cursor:pointer;">X</button>
            </td>
        </tr>
    `;
}

function filasStockHTML(lista){
    if(lista.length === 0){
        return `<tr><td colspan="8" style="text-align:center;color:#888;">NO HAY PRODUCTOS</td></tr>`;
    }
    return lista.map(filaProductoHTML).join("");
}

function renderStock(){

    window._imgTmp = {};

    // Buscador actual (si existe)
    const busquedaActual = document.getElementById("buscadorStock")?.value || "";

    let productosMostrados = stock;
    if(busquedaActual.trim() !== ""){
        const txt = busquedaActual.trim().toLowerCase();
        productosMostrados = stock.filter(p =>
            p.descripcion.toLowerCase().includes(txt) ||
            p.id.toLowerCase().includes(txt)
        );
    }

    document.getElementById("contenido").innerHTML = `

        <h1>STOCK</h1>

        <h2>AGREGAR PRODUCTO</h2>

        <div class="formulario">

            <div class="fila">
                <div class="campo">
                    <label>ID DEL PRODUCTO *</label>
                    <input type="text" id="stockId" placeholder="Ej: SAM-A15, REP-001..." style="text-transform:uppercase;">
                </div>
                <div class="campo">
                    <label>NOMBRE / DESCRIPCIÓN CORTA *</label>
                    <input type="text" id="stockDesc" placeholder="Ej: Pantalla Samsung A15...">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>COSTO *</label>
                    <input type="text" id="stockCosto" placeholder="0" oninput="fmInput(this);calcularPrecios()">
                </div>
                <div class="campo">
                    <label>PRECIO FINAL EFECTIVO *</label>
                    <input type="text" id="stockEfectivo" placeholder="0" oninput="fmInput(this);calcularDebito();previewDescuento('stockEfectivo','stockDescuento','stockDescPreview')">
                </div>
            </div>

            <div class="fila">
                <div class="campo">
                    <label>PRECIO FINAL DÉBITO (efectivo +10%)</label>
                    <input type="number" id="stockDebito" min="0" placeholder="Se calcula automáticamente" readonly style="background:#e9ecef; cursor:not-allowed;">
                </div>
                <div class="campo">
                    <label>CANTIDAD INICIAL EN STOCK</label>
                    <input type="number" id="stockCantidad" min="0" placeholder="0" value="0">
                </div>
            </div>

            ${bloqueWebHTML({}, "stock", "stockEfectivo")}

            <button class="guardar-btn" onclick="agregarProducto()" style="margin-top:5px;">
                AGREGAR PRODUCTO
            </button>

        </div>

        <br>

        <h2>PRODUCTOS EN STOCK</h2>

        <!-- BUSCADOR -->
        <div class="campo" style="max-width:400px; margin-bottom:20px;">
            <input
                type="text"
                id="buscadorStock"
                placeholder="BUSCAR POR ID O DESCRIPCIÓN..."
                oninput="filtrarStock()"
                style="text-transform:uppercase;"
                value="${escapeHTML(busquedaActual)}"
            >
        </div>

        <div style="overflow-x:auto;">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>DESCRIPCIÓN</th>
                    <th>COSTO</th>
                    <th>PRECIO EFECTIVO</th>
                    <th>PRECIO DÉBITO</th>
                    <th>CANTIDAD</th>
                    <th>WEB</th>
                    <th>ELIMINAR</th>
                </tr>
            </thead>
            <tbody>
                ${filasStockHTML(productosMostrados)}
            </tbody>
        </table>
        </div>

    `;

    // Restaurar el foco en el buscador si había texto
    if(busquedaActual !== ""){
        const inp = document.getElementById("buscadorStock");
        if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
}


function filtrarStock(){
    const txt = document.getElementById("buscadorStock").value.trim().toLowerCase();
    const tbody = document.querySelector("#contenido table tbody");
    if(!tbody) return;

    const filtrados = stock.filter(p =>
        p.descripcion.toLowerCase().includes(txt) ||
        p.id.toLowerCase().includes(txt)
    );
    tbody.innerHTML = filasStockHTML(filtrados);
}


function ajustarCantidad(idProducto, delta){
    const producto = stock.find(p => p.id === idProducto);
    if(!producto) return;
    const nueva = (producto.cantidad ?? 0) + delta;
    if(nueva < 0) return;
    guardarRegistro("STOCK", "AJUSTE DE CANTIDAD",
        `${producto.id} — ${producto.descripcion}: cantidad ${producto.cantidad ?? 0} → ${nueva}`, "stk-" + producto.id);
    producto.cantidad = nueva;
    guardarStock();
    filtrarStock(); // re-render solo el tbody sin perder el buscador
}


function calcularDebito(){
    const efectivo = leerNumero("stockEfectivo");
    if(efectivo > 0){
        const debitoVal = Math.round(efectivo * 1.10);
        document.getElementById("stockDebito").value = fm(debitoVal);
        document.getElementById("stockDebito").dataset.valor = debitoVal;
    } else {
        document.getElementById("stockDebito").value = "";
        document.getElementById("stockDebito").dataset.valor = "";
    }
}

function calcularPrecios(){
    // Por ahora no hace nada automático desde el costo
}


function agregarProducto(){

    const idProducto     = document.getElementById("stockId").value.trim().toUpperCase();
    const descripcion    = capitalizar(document.getElementById("stockDesc").value.trim());
    const costo          = leerNumero("stockCosto");
    const precioEfectivo = leerNumero("stockEfectivo");
    const precioDebito   = leerNumero("stockDebito");
    const cantidad       = Number(document.getElementById("stockCantidad").value) || 0;

    if(idProducto === "" || descripcion === "" || !costo || !precioEfectivo){
        alert("COMPLETÁ TODOS LOS CAMPOS OBLIGATORIOS.");
        return;
    }

    const existe = stock.find(p => p.id === idProducto);
    if(existe){
        alert("YA EXISTE UN PRODUCTO CON ESE ID.");
        return;
    }

    const web = leerBloqueWeb("stock", "");

    stock.push({ id: idProducto, descripcion, costo, precioEfectivo, precioDebito, cantidad, ...web });

    guardarRegistro("STOCK", "AGREGAR PRODUCTO",
        `${idProducto} — ${descripcion} (cantidad ${cantidad}, efectivo $${fm(precioEfectivo)})` +
        (web.mostrarWeb ? " — publicado en la web" + (web.descuento > 1 ? ` con ${fmPct(web.descuento)}% de descuento` : "") : ""));

    guardarStock();
    renderStock();
}


// ─────────────────────────────────────────────
// EDITAR LOS DATOS WEB DE UN PRODUCTO EXISTENTE
// ─────────────────────────────────────────────
function editarWebProducto(idProducto){

    const p = stock.find(x => x.id === idProducto);
    if(!p) return;

    window._imgTmp = {};

    document.getElementById("contenido").innerHTML = `

        <h1>PRODUCTO EN LA WEB</h1>

        <div class="formulario" style="max-width:800px;">

            <div style="background:rgba(255,255,255,.06); border-radius:12px; padding:14px 18px; margin-bottom:16px;">
                <div style="font-size:12px; color:#9ED1F7; font-weight:700;">${escapeHTML(p.id)}</div>
                <div style="font-size:18px; font-weight:800;">${escapeHTML(p.descripcion)}</div>
                <div style="font-size:13px; color:#ccc; margin-top:4px;">Precio efectivo: $${fm(p.precioEfectivo)}</div>
                <input type="hidden" id="editWebPrecio" data-valor="${p.precioEfectivo}" value="${p.precioEfectivo}">
            </div>

            ${bloqueWebHTML(p, "editWeb", "editWebPrecio")}

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button class="guardar-btn" onclick="guardarWebProducto('${p.id}')">GUARDAR CAMBIOS</button>
                <button class="guardar-btn" style="background:#E2E3E5; color:#333;" onclick="renderStock()">CANCELAR</button>
            </div>

        </div>
    `;

    previewDescuento("editWebPrecio", "editWebDescuento", "editWebDescPreview");
}

function guardarWebProducto(idProducto){
    const p = stock.find(x => x.id === idProducto);
    if(!p) return;

    const web = leerBloqueWeb("editWeb", p.imagen);

    guardarRegistro("STOCK", "EDITAR WEB",
        `${p.id} — ${p.descripcion}: ` + (web.mostrarWeb
            ? "publicado en la web" + (web.descuento > 1 ? ` con ${fmPct(web.descuento)}% de descuento` : " sin descuento")
            : "quitado de la web"));

    p.mostrarWeb = web.mostrarWeb;
    if(web.mostrarWeb){
        p.detalle   = web.detalle;
        p.descuento = web.descuento;
        p.imagen    = web.imagen;
    }

    guardarStock();
    renderStock();
}


function eliminarProducto(idProducto){

    const confirmar = confirm("¿SEGURO QUE QUERÉS ELIMINAR ESTE PRODUCTO?");
    if(!confirmar) return;

    const _prod = stock.find(p => p.id === idProducto);
    if(_prod) guardarRegistro("STOCK", "ELIMINAR PRODUCTO", `${_prod.id} — ${_prod.descripcion}`);

    stock = stock.filter(p => p.id !== idProducto);

    guardarStock();
    renderStock();
}


// ─────────────────────────────────────────────
// PRODUCTOS EN LA PÁGINA PRINCIPAL (LANDING)
// ─────────────────────────────────────────────
function renderLandingProductos(){
    const cont = document.getElementById("lpProductosWeb");
    if(!cont) return;

    const lista = (Array.isArray(productosWeb) ? productosWeb : []);
    if(lista.length === 0){ cont.innerHTML = ""; return; }

    const placeholder = `
        <svg width="110" height="110" viewBox="0 0 160 160" fill="none" aria-hidden="true">
            <circle cx="80" cy="80" r="70" fill="#9ED1F7" fill-opacity=".12"/>
            <rect x="48" y="20" width="64" height="120" rx="13" fill="#172137" stroke="#9ED1F7" stroke-width="3"/>
            <rect x="55" y="35" width="50" height="86" rx="4" fill="#26334E"/>
            <circle cx="80" cy="130" r="4" fill="#9ED1F7"/>
        </svg>`;

    const tarjetas = lista.map(p => {
        const d = infoDescuento(p);
        const agotado = (p.cantidad ?? 0) <= 0;

        const precio = d.aplica
            ? `<div class="lp-price-row">
                   <span class="lp-price-old">$${fm(d.original)}</span>
                   <span class="lp-badge-desc">-${fmPct(d.pct)}%</span>
               </div>
               <div class="lp-price-new">$${fm(d.final)}</div>`
            : `<div class="lp-price-new">$${fm(d.original)}</div>`;

        return `
            <article class="lp-card">
                <div class="lp-card-img">
                    ${p.imagen
                        ? `<img src="${p.imagen}" alt="${escapeHTML(p.descripcion)}" loading="lazy">`
                        : placeholder}
                </div>
                <h3>${escapeHTML(p.descripcion)}</h3>
                ${p.detalle
                    ? `<details><summary><span>Ver descripción +</span></summary><p>${escapeHTML(p.detalle).replace(/\n/g, "<br>")}</p></details>`
                    : ""}
                <div class="lp-card-price">
                    ${precio}
                    ${agotado ? `<div class="lp-agotado">Sin stock por el momento</div>` : ""}
                </div>
            </article>`;
    }).join("");

    cont.innerHTML = `
        <h3 class="lp-sub-title">Productos disponibles</h3>
        <div class="lp-productos-grid">${tarjetas}</div>
    `;
}
