import { ref, get, set, update, remove, query, orderByChild, equalTo, onValue } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// Get the database instance
const database = window.firebaseDatabase;

// References to database nodes
const canchasRef = ref(database, 'canchas');
const reservacionesRef = ref(database, 'reservaciones');
const clientesRef = ref(database, 'clientes');

// Utility functions
function $(id) {
    return document.getElementById(id);
}

function formatoFecha(fecha) {
    return new Date(fecha).toLocaleDateString();
}

function formatoHora(hora) {
    return hora.slice(0, 5);
}

// Hamburger menu functionality
function toggleMenu() {
    const nav = $('main-nav');
    const hamburger = $('hamburger-menu');
    nav.classList.toggle('active');
    hamburger.classList.toggle('active');
}

// Dashboard Updates
function actualizarDashboard() {
    onValue(canchasRef, (snapshot) => {
        const canchas = snapshot.val() || {};
        const totalCanchas = Object.keys(canchas).length;
        const canchasOcupadas = Object.values(canchas).filter(c => c.ocupada).length;

        if ($("total-canchas")) $("total-canchas").querySelector(".big-number").textContent = totalCanchas;
        if ($("canchas-ocupadas")) $("canchas-ocupadas").querySelector(".big-number").textContent = canchasOcupadas;
        if ($("canchas-disponibles")) $("canchas-disponibles").querySelector(".big-number").textContent = totalCanchas - canchasOcupadas;
    });

    actualizarListaReservaciones();
}

// Update Reservations List
function actualizarListaReservaciones() {
    onValue(reservacionesRef, async (snapshot) => {
        const reservaciones = snapshot.val() || {};
        const listaReservaciones = $("reservaciones-container");
        if (listaReservaciones) {
            const canchasSnapshot = await get(canchasRef);
            const canchas = canchasSnapshot.val() || {};

            listaReservaciones.innerHTML = Object.entries(reservaciones).map(([id, r]) => {
                const cancha = canchas[r.cancha] || {};
                const nombreCancha = cancha.numero ? `Cancha ${cancha.numero}: ${cancha.nombre}` : 'Cancha no encontrada';

                return `
                    <div class="reservacion">
                        <p>Fecha: ${formatoFecha(r.fecha)} - Hora: ${formatoHora(r.hora)}</p>
                        <p>Cancha: ${nombreCancha}</p>
                        <p>Cliente: ${r.cliente} - Teléfono: ${r.telefono}</p>
                        <button onclick="cancelarReservacion('${id}')">Cancelar Reservación</button>
                    </div>
                `;
            }).join('');
        }

        const totalReservaciones = Object.keys(reservaciones).length;
        if ($("reservaciones-hoy")) $("reservaciones-hoy").querySelector(".big-number").textContent = totalReservaciones;

        const proximasReservaciones = $("lista-proximas-reservaciones");
        if (proximasReservaciones) {
            const canchasSnapshot = await get(canchasRef);
            const canchas = canchasSnapshot.val() || {};

            proximasReservaciones.innerHTML = Object.values(reservaciones).map(r => {
                const cancha = canchas[r.cancha] || {};
                const nombreCancha = cancha.numero ? `Cancha ${cancha.numero}: ${cancha.nombre}` : 'Cancha no encontrada';

                return `
                    <div class="reservacion">
                        <p>Cancha: ${nombreCancha}</p>
                        <p>Hora: ${formatoHora(r.hora)}</p>
                        <p>Cliente: ${r.cliente}</p>
                    </div>
                `;
            }).join('') || '<p>No hay reservaciones</p>';
        }
    });
}

// Update Courts List
function actualizarListaCanchas() {
    onValue(canchasRef, (snapshot) => {
        const canchas = snapshot.val() || {};
        const listaCanchas = $("lista-canchas");
        if (listaCanchas) {
            listaCanchas.innerHTML = Object.entries(canchas).map(([id, c]) => `
                <div class="cancha ${c.ocupada ? 'ocupada' : 'disponible'} p-4 border rounded-lg mb-4">
                    <h3 class="text-lg font-semibold mb-2">Cancha ${c.numero}: <span id="nombre-cancha-${id}">${c.nombre}</span></h3>
                    <input type="text" id="edit-nombre-cancha-${id}" value="${c.nombre}" class="hidden border rounded px-2 py-1 mb-2 w-full">
                    <p class="mb-2">Estado: ${c.ocupada ? 'Ocupada' : 'Disponible'}</p>
                    <div class="flex space-x-2">
                        <button onclick="toggleOcupacion('${id}')" class="bg-blue-500 text-white px-3 py-1 rounded">
                            ${c.ocupada ? 'Marcar como Disponible' : 'Marcar como Ocupada'}
                        </button>
                        <button onclick="toggleEditarNombreCancha('${id}')" class="bg-green-500 text-white px-3 py-1 rounded">
                            Editar Nombre
                        </button>
                    </div>
                </div>
            `).join('');
        }

        const selectCancha = $("cancha-reserva");
        if (selectCancha) {
            selectCancha.innerHTML = '<option value="">Seleccione una cancha</option>' +
                Object.entries(canchas).map(([id, c]) => `<option value="${id}">Cancha ${c.numero}: ${c.nombre}</option>`).join('');
        }
    });
}

// Add Court
async function agregarCancha(evento) {
    evento.preventDefault();
    const numero = $("numero-cancha").value;
    const nombre = $("nombre-cancha").value;
    const capacidad = $("capacidad-cancha").value;
    const precio = $("precio-cancha").value;

    const nuevaCancha = {
        numero,
        nombre,
        capacidad,
        precio,
        ocupada: false
    };

    try {
        await set(ref(database, 'canchas/' + Date.now()), nuevaCancha);
        console.log("Cancha agregada exitosamente");
        mostrarAlerta("Cancha agregada exitosamente", "exito");
        evento.target.reset();
    } catch (error) {
        console.error("Error al agregar la cancha:", error);
        mostrarAlerta("Error al agregar la cancha. Por favor, intente nuevamente.", "error");
    }
}

// Toggle Court Occupation
async function toggleOcupacion(id) {
    const canchaRef = ref(database, 'canchas/' + id);
    const canchaSnapshot = await get(canchaRef);
    const cancha = canchaSnapshot.val();
    if (cancha) {
        await update(canchaRef, { ocupada: !cancha.ocupada });
    }
}

// Add Reservation
async function agregarReservacion(evento) {
    evento.preventDefault();
    const fecha = $("fecha-reserva").value;
    const hora = $("hora-reserva").value;
    const canchaId = $("cancha-reserva").value;
    const cliente = $("cliente-reserva").value;
    const telefono = $("telefono-reserva").value;

    const nuevaReservacion = {
        fecha,
        hora,
        cancha: canchaId,
        cliente,
        telefono
    };

    try {
        await set(ref(database, 'reservaciones/' + Date.now()), nuevaReservacion);
        console.log("Reservación agregada exitosamente");
        mostrarAlerta("Reservación realizada correctamente", "exito");
        evento.target.reset();

        // Update client's reservation count
        const clienteRef = ref(database, 'clientes/' + telefono);
        const clienteSnapshot = await get(clienteRef);
        const clienteData = clienteSnapshot.val();
        if (clienteData) {
            await update(clienteRef, { reservaciones: (clienteData.reservaciones || 0) + 1 });
        } else {
            await set(clienteRef, { nombre: cliente, telefono, reservaciones: 1 });
        }

        actualizarDashboard();
    } catch (error) {
        console.error("Error al agregar la reservación:", error);
        mostrarAlerta("Error al realizar la reservación. Por favor, intente nuevamente.", "error");
    }
}

// Cancel Reservation
async function cancelarReservacion(id) {
    try {
        const reservacionRef = ref(database, 'reservaciones/' + id);
        const reservacionSnapshot = await get(reservacionRef);
        const reservacion = reservacionSnapshot.val();
        if (reservacion) {
            await remove(reservacionRef);

            // Update client's reservation count
            const clienteRef = ref(database, 'clientes/' + reservacion.telefono);
            const clienteSnapshot = await get(clienteRef);
            const cliente = clienteSnapshot.val();
            if (cliente) {
                await update(clienteRef, { reservaciones: cliente.reservaciones - 1 });
            }

            console.log("Reservación cancelada exitosamente");
            mostrarAlerta("Reservación cancelada exitosamente", "exito");
        }
    } catch (error) {
        console.error("Error al cancelar la reservación:", error);
        mostrarAlerta("Error al cancelar la reservación. Por favor, intente nuevamente.", "error");
    }
}

// Update Client List
function actualizarListaClientes() {
    onValue(clientesRef, (snapshot) => {
        const clientes = snapshot.val() || {};
        const listaClientes = $("clientes-container");
        if (listaClientes) {
            listaClientes.innerHTML = Object.entries(clientes).map(([id, c]) => `
                <div class="cliente">
                    <p>Nombre: ${c.nombre}</p>
                    <p>Teléfono: ${c.telefono}</p>
                    <p>Email: ${c.email || 'N/A'}</p>
                    <p>Reservaciones: ${c.reservaciones || 0}</p>
                    <button onclick="eliminarCliente('${id}')">Eliminar Cliente</button>
                </div>
            `).join('');
        }
    });
}

// Add Client
async function agregarCliente(evento) {
    evento.preventDefault();
    const nombre = $("nombre-cliente").value;
    const telefono = $("telefono-cliente").value;
    const email = $("email-cliente").value;

    const nuevoCliente = {
        nombre,
        telefono,
        email,
        reservaciones: 0
    };

    try {
        await set(ref(database, 'clientes/' + telefono), nuevoCliente);
        console.log("Cliente agregado exitosamente");
        mostrarAlerta("Cliente agregado exitosamente", "exito");
        evento.target.reset();
    } catch (error) {
        console.error("Error al agregar el cliente:", error);
        mostrarAlerta("Error al agregar el cliente. Por favor, intente nuevamente.", "error");
    }
}

// Delete Client
async function eliminarCliente(id) {
    try {
        await remove(ref(database, 'clientes/' + id));
        console.log("Cliente eliminado exitosamente");
        mostrarAlerta("Cliente eliminado exitosamente", "exito");
    } catch (error) {
        console.error("Error al eliminar el cliente:", error);
        mostrarAlerta("Error al eliminar el cliente. Por favor, intente nuevamente.", "error");
    }
}

// Show alert function
function mostrarAlerta(mensaje, tipo) {
    const alertaContainer = $("alerta-container");
    if (alertaContainer) {
        alertaContainer.innerHTML = `
            <div class="alerta alerta-${tipo}">
                ${mensaje}
            </div>
        `;
        setTimeout(() => {
            alertaContainer.innerHTML = '';
        }, 3000);
    }
}

// Generate Reports
function generarReportes() {
    generarGraficoIngresos();
    generarGraficoOcupacion();
    generarListaClientesFrecuentes();
    generarGraficoReservacionesSemana();
}

// Generate Income Chart
function generarGraficoIngresos() {
    get(reservacionesRef).then((snapshot) => {
        const reservaciones = snapshot.val() || {};
        const ingresosPorMes = {};

        Object.values(reservaciones).forEach(r => {
            const fecha = new Date(r.fecha);
            const mes = fecha.toLocaleString('default', { month: 'long' });
            ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + parseFloat(r.precio);
        });

        const meses = Object.keys(ingresosPorMes);
        const ingresos = Object.values(ingresosPorMes);

        const ctx = $('grafico-ingresos').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [{
                    label: 'Ingresos Mensuales',
                    data: ingresos,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Ingresos ($)'
                        }
                    }
                }
            }
        });
    });
}

// Generate Occupation Chart
function generarGraficoOcupacion() {
    get(canchasRef).then((snapshot) => {
        const canchas = snapshot.val() || {};
        const ocupadas = Object.values(canchas).filter(c => c.ocupada).length;
        const disponibles = Object.values(canchas).length - ocupadas;

        const ctx = $('grafico-ocupacion').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Ocupadas', 'Disponibles'],
                datasets: [{
                    data: [ocupadas, disponibles],
                    backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                    borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
                    borderWidth: 1
                }]
            }
        });
    });
}

// Generate Frequent Clients List
function generarListaClientesFrecuentes() {
    get(clientesRef).then((snapshot) => {
        const clientes = snapshot.val() || {};
        const clientesOrdenados = Object.values(clientes)
            .sort((a, b) => (b.reservaciones || 0) - (a.reservaciones || 0))
            .slice(0, 5);

        const listaClientesFrecuentes = $('lista-clientes-frecuentes');
        listaClientesFrecuentes.innerHTML = clientesOrdenados.map(c => `
            <div class="cliente-frecuente">
                <p>${c.nombre}: ${c.reservaciones || 0} reservaciones</p>
            </div>
        `).join('');
    });
}

// Generate Reservations by Day of Week Chart
function generarGraficoReservacionesSemana() {
    get(reservacionesRef).then((snapshot) => {
        const reservaciones = snapshot.val() || {};
        const reservacionesPorDia = {
            'Domingo': 0, 'Lunes': 0, 'Martes': 0, 'Miércoles': 0,
            'Jueves': 0, 'Viernes': 0, 'Sábado': 0
        };

        Object.values(reservaciones).forEach(r => {
            const fecha = new Date(r.fecha);
            const dia = fecha.toLocaleString('default', { weekday: 'long' });
            reservacionesPorDia[dia]++;
        });

        const dias = Object.keys(reservacionesPorDia);
        const cantidades = Object.values(reservacionesPorDia);

        const ctx = $('grafico-reservaciones-semana').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: dias,
                datasets: [{
                    label: 'Reservaciones por Día',
                    data: cantidades,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de Reservaciones'
                        }
                    }
                }
            }
        });
    });
}

// Initialize views
function inicializarVistas() {
    actualizarDashboard();
    actualizarListaCanchas();
    actualizarListaClientes();

    const formAgregarCancha = $("form-agregar-cancha");
    if (formAgregarCancha) {
        formAgregarCancha.addEventListener('submit', agregarCancha);
    }

    const formReservacion = $("form-reservacion");
    if (formReservacion) {
        formReservacion.addEventListener('submit', agregarReservacion);
    }

    const formCliente = $("form-cliente");
    if (formCliente) {
        formCliente.addEventListener('submit', agregarCliente);
    }

    if (window.location.pathname.includes('reportes.html')) {
        generarReportes();
    }

    // Initialize hamburger menu
    const hamburgerButton = $('hamburger-menu');
    if (hamburgerButton) {
        hamburgerButton.addEventListener('click', toggleMenu);
    }
}

// Make functions available globally
window.toggleOcupacion = toggleOcupacion;
window.cancelarReservacion = cancelarReservacion;
window.eliminarCliente = eliminarCliente;
window.toggleEditarNombreCancha = toggleEditarNombreCancha;
window.toggleMenu = toggleMenu;

// Add these new functions
function toggleEditarNombreCancha(id) {
    const nombreElement = $(`nombre-cancha-${id}`);
    const inputElement = $(`edit-nombre-cancha-${id}`);
    
    if (inputElement.classList.contains('hidden')) {
        inputElement.classList.remove('hidden');
        nombreElement.classList.add('hidden');
        inputElement.focus();
    } else {
        guardarNombreCancha(id);
    }
}

async function guardarNombreCancha(id) {
    const inputElement = $(`edit-nombre-cancha-${id}`);
    const nombreElement = $(`nombre-cancha-${id}`);
    const nuevoNombre = inputElement.value.trim();
    
    if (nuevoNombre) {
        try {
            await update(ref(database, `canchas/${id}`), { nombre: nuevoNombre });
            nombreElement.textContent = nuevoNombre;
            inputElement.classList.add('hidden');
            nombreElement.classList.remove('hidden');
            mostrarAlerta("Nombre de la cancha actualizado", "exito");
        } catch (error) {
            console.error("Error al actualizar el nombre de la cancha:", error);
            mostrarAlerta("Error al actualizar el nombre de la cancha", "error");
        }
    }
}

// Initialize views when the DOM is loaded
document.addEventListener('DOMContentLoaded', inicializarVistas);

