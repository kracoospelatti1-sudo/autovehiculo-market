var interesAutoR1 = 0;
var interesAutoR2 = 0;
var interesAutoR3 = 0;
var cuotasAutoR1 = 0;
var cuotasAutoR2 = 0;
var cuotasAutoR3 = 0;
var intervaloAuto = 0;
var interesMoto = 0;
var cuotasMoto = 0;
var intervaloMoto = 0;

$(document).ready(function () {
    $.getJSON("./assets/js/config.json", function (data) {
        interesAutoR1 = data.interesAutoR1;
        interesAutoR2 = data.interesAutoR2;
        interesAutoR3 = data.interesAutoR3;
        cuotasAutoR1 = data.cuotasAutoR1;
        cuotasAutoR2 = data.cuotasAutoR2;
        cuotasAutoR3 = data.cuotasAutoR3;
        intervaloAuto = data.intervaloAuto;
        interesMoto = data.interesMoto;
        cuotasMoto = data.cuotasMoto;
        intervaloMoto = data.intervaloMoto;
    }).fail(function () {
        console.log("Algo pasÃ³ :(");
    });

    // Cargo opciones al select #modelo, con aÃ±os hasta 15 aÃ±os hacia atras
    const selectModelo = $('#modelo');
    const year = new Date().getFullYear();
    for (let i = 0; i <= 15; i++) {
        selectModelo.append(`<option value="${year - i}">${year - i}</option>`);
    }
});

$("#importe").on('keyup', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        $("#calcular").get(0).click();
    }
});

$('#importe').on('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
});

$("#calcular").click(function () {
    $("#contenido").empty();    
    var tipo = $("#tipo").val();
    var modelo = $("#modelo").val();
    var importe = $("#importe").val();
    var correo = $("#email").val();
    var rango = new Date().getFullYear() - modelo;
    if (tipo == '0' && modelo === "") {
        alert("Por favor ingrese un modelo e intente nuevamente, gracias");
        return;
    }
    if(tipo == '0' && (rango < 0 || rango > 15)){
        alert("Por favor ingrese modelos cuya antigÃ¼edad no sea menor a 0 ni mayor a 15 aÃ±os e intente nuevamente, gracias");
        return;
    }
    if (correo === "") {
        alert("Por favor ingrese un correo electrÃ³nico e intente nuevamente, gracias");
        return;
    }
    else {
        $("#importe-valor").text("$ " + (Math.round(importe).toLocaleString()));
        if (tipo == 0) {
            var interesAuto = 0;
            if(rango >= 11 && rango <= 15){
                interesAuto = interesAutoR1;
                cuotasAuto = cuotasAutoR1;
            }
            else if(rango >= 8 && rango <= 10){
                interesAuto = interesAutoR2;
                cuotasAuto = cuotasAutoR2;
            }
            else if(rango >= 0 && rango <= 7){
                interesAuto = interesAutoR3;
                cuotasAuto = cuotasAutoR3;
            }
            for (var i = intervaloAuto + 2; i <= cuotasAuto; i += intervaloAuto) {
                var importeCuota = PMT(interesAuto / 12, i, importe * -1);
                $("#contenido").append('<tr><td>' + i + '</td><td>$ ' + (Math.round(importeCuota)).toLocaleString() + '</td></tr>');
            };
        }
        else if (tipo == 1) {
            for (var i = intervaloMoto + 2; i <= cuotasMoto; i += intervaloMoto) {
                var importeCuota = PMT(interesMoto / 12, i, importe * -1);
                $("#contenido").append('<tr><td>' + i + '</td><td>$ ' + (Math.round(importeCuota)).toLocaleString() + '</td></tr>');
            };
        }
        $.ajax({
            type: "POST",
            url: 'save.php',
            data: { tipo: tipo == 0 ? 'Auto' : 'Moto', modelo: modelo === "" ? 0 : modelo, importe: importe, correo: correo },
            success: function (data) {
                console.log(data);
            },
            error: function (xhr, status, error) {
                console.error(xhr);
            }
        });
    }
});

$("#openModal").click(function () {
    $("#close").get(0).click();
});

$("#modal").click(function (e) {
    e.stopPropagation();
});

$("#tipo").change(function (e) {    
    if ($("#tipo").val() == '0') {
        //$("#modelo-div").removeAttr('hidden');
        $("#modelo-div").css("display", "flex");
    }
    else {
        //$("#modelo-div").prop('hidden', 'hidden');
        $("#modelo-div").css("display", "none");
        $("#modelo").val("");
    }
});

// https://stackoverflow.com/questions/5294074/pmt-function-in-javascript
function PMT(ir, np, pv, fv, type) {
    /*
     * ir   - interest rate per month
     * np   - number of periods (months)
     * pv   - present value
     * fv   - future value
     * type - when the payments are due:
     *        0: end of the period, e.g. end of month (default)
     *        1: beginning of period
     */
    var pmt, pvif;

    fv || (fv = 0);
    type || (type = 0);

    if (ir === 0)
        return -(pv + fv) / np;

    pvif = Math.pow(1 + ir, np);
    pmt = - ir * (pv * pvif + fv) / (pvif - 1);

    if (type === 1)
        pmt /= (1 + ir);

    return pmt;
}

