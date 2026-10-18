function obtenerFechaArgentina(){
    return new Date().toLocaleString(
        "es-AR",
        {
            timeZone:"America/Argentina/Buenos_Aires",
            year:"numeric",
            month:"2-digit",
            day:"2-digit",
            hour:"2-digit",
            minute:"2-digit"
        }
    );
}

// ─────────────────────────────────────────────
// FORMATEAR MILES
// Convierte 268500 → "268.500"
// Funciona con números y strings
// ─────────────────────────────────────────────
function fm(numero){
    if(numero === null || numero === undefined || numero === "") return "0";
    // Separa parte entera de posible decimal
    const partes = String(numero).split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return partes.join(",");
}

// ─────────────────────────────────────────────
// FORMATEAR INPUT MIENTRAS SE ESCRIBE
// Llamar con oninput="fmInput(this)" en el input
// Guarda el valor numérico real en data-valor
// ─────────────────────────────────────────────
function fmInput(el){
    // Saca todo lo que no sea número
    const soloNumeros = el.value.replace(/\./g, "").replace(/[^0-9]/g, "");
    // Guarda el valor numérico real para poder leerlo al guardar
    el.dataset.valor = soloNumeros;
    // Muestra formateado con puntos
    if(soloNumeros === ""){
        el.value = "";
    } else {
        el.value = soloNumeros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
}

// ─────────────────────────────────────────────
// LEER VALOR NUMÉRICO DE UN INPUT CON FORMATO
// Uso: leerNumero("presupuesto") → 268500
// ─────────────────────────────────────────────
function leerNumero(id){
    const el = document.getElementById(id);
    if(!el) return 0;
    // Si tiene data-valor lo usamos, sino limpiamos puntos manualmente
    const raw = el.dataset.valor || el.value.replace(/\./g, "");
    return Number(raw) || 0;
}

// ─────────────────────────────────────────────
// FORMATEAR TELÉFONO
// Guarda solo dígitos, muestra con guiones
// 10 dígitos: 11-4061-5429
// 8 dígitos:  4061-5429
// Otro largo: se muestra tal cual con dígitos
// ─────────────────────────────────────────────
function ftTel(numero){
    if(!numero) return "-";
    const s = String(numero).replace(/\D/g,""); // solo dígitos
    if(s.length === 10) return s.slice(0,2) + "-" + s.slice(2,6) + "-" + s.slice(6);
    if(s.length === 11) return s.slice(0,3) + "-" + s.slice(3,7) + "-" + s.slice(7);
    if(s.length === 8)  return s.slice(0,4) + "-" + s.slice(4);
    return s; // otro largo: devuelve solo dígitos sin formato
}

// Para usar en oninput="ftTelInput(this)"
// Mientras escribís muestra el formato con guiones en tiempo real
function ftTelInput(el){
    const soloDigitos = el.value.replace(/\D/g,"");
    el.dataset.valor = soloDigitos;
    el.value = ftTel(soloDigitos) === "-" ? "" : ftTel(soloDigitos);
}

// Leer el valor limpio (solo dígitos) de un input de teléfono
function leerTel(id){
    const el = document.getElementById(id);
    if(!el) return "";
    return (el.dataset.valor || el.value.replace(/\D/g,""));
}