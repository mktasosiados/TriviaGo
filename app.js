// Inicializar la WebApp de Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Expandir la ventana al tamaño completo del móvil

let bancoPreguntas = []; // Contendrá el JSON original intacto
let preguntasDisponibles = []; // Lista dinámica de donde se sacarán las preguntas
let preguntaActual = null;
let indicePreguntaActual = -1; // Guardamos el índice para poder removerla después
let score = 0;
let lives = 5;
let timerInterval = null;
let cooldownInterval = null;
let timeLeft = 15;

// Variables para control del tiempo de regeneración de vidas (60 minutos = 3600 segundos)
const COOLDOWN_TIME = 3600; 

// Elementos del DOM
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const categoryBadge = document.getElementById("category-badge");
const questionTimerElement = document.getElementById("question-timer");
const scoreDisplay = document.getElementById("score-display");
const livesDisplay = document.getElementById("lives-display");
const cooldownTimerElement = document.getElementById("cooldown-timer");
const quizScreen = document.getElementById("quiz-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const btnRewardVideo = document.getElementById("btn-reward-video");

// --- LÓGICA DE VIDAS Y TIEMPO (PERSISTENCIA) ---
function inicializarVidas() {
    const savedLives = localStorage.getItem("triviago_lives");
    const lastTime = localStorage.getItem("triviago_last_time");

    if (savedLives !== null) {
        lives = parseInt(savedLives);
    }

    if (lastTime !== null && lives < 5) {
        const secondsPassed = Math.floor((Date.now() - parseInt(lastTime)) / 1000);
        const livesGained = Math.floor(secondsPassed / COOLDOWN_TIME);
        
        if (livesGained > 0) {
            lives = Math.min(5, lives + livesGained);
            const remainingTimeLeft = secondsPassed % COOLDOWN_TIME;
            localStorage.setItem("triviago_last_time", (Date.now() - (remainingTimeLeft * 1000)).toString());
        }
    }

    if (lives < 5 && localStorage.getItem("triviago_last_time") === null) {
        localStorage.setItem("triviago_last_time", Date.now().toString());
    }

    actualizarInterfazVidas();
}

function actualizarInterfazVidas() {
    livesDisplay.innerText = "❤️ ".repeat(lives) + "🖤 ".repeat(5 - lives);
    localStorage.setItem("triviago_lives", lives.toString());

    if (lives === 5) {
        cooldownTimerElement.classList.add("hidden");
        clearInterval(cooldownInterval);
        localStorage.removeItem("triviago_last_time");
    } else {
        cooldownTimerElement.classList.remove("hidden");
        if (!cooldownInterval) iniciarRelojRecuperacion();
    }
}

function iniciarRelojRecuperacion() {
    if (cooldownInterval) clearInterval(cooldownInterval);

    cooldownInterval = setInterval(() => {
        const lastTime = parseInt(localStorage.getItem("triviago_last_time"));
        if (!lastTime) return;

        const secondsPassed = Math.floor((Date.now() - lastTime) / 1000);
        const timeRemaining = COOLDOWN_TIME - secondsPassed;

        if (timeRemaining <= 0) {
            lives++;
            if (lives < 5) {
                localStorage.setItem("triviago_last_time", Date.now().toString());
            } else {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
            }
            actualizarInterfazVidas();
        } else {
            const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
            const seconds = (timeRemaining % 60).toString().padStart(2, '0');
            cooldownTimerElement.innerText = `⌛ ${minutes}:${seconds}`;
        }
    }, 1000);
}

function quitarVida() {
    if (lives > 0) {
        if (lives === 5) {
            localStorage.setItem("triviago_last_time", Date.now().toString());
        }
        lives--;
        actualizarInterfazVidas();
    }

    if (lives === 0) {
        mostrarGameOver();
    } else {
        siguientePregunta();
    }
}

// --- LÓGICA DEL JUEGO DE TRIVIA ---
async function cargarPreguntas() {
    try {
        const response = await fetch('preguntas.json');
        const data = await response.json();
        bancoPreguntas = data.preguntas;
        
        // Copiamos todas las preguntas iniciales a la lista de disponibles
        preguntasDisponibles = [...bancoPreguntas];
        
        inicializarVidas();
        
        if (lives > 0) {
            siguientePregunta();
        } else {
            mostrarGameOver();
        }
    } catch (error) {
        questionText.innerText = "Error al cargar las preguntas.";
    }
}

function siguientePregunta() {
    // Si se respondieron todas de manera correcta, reiniciamos la lista para no bloquear el juego
    if (preguntasDisponibles.length === 0) {
        tg.showAlert("¡Increíble! Respondiste correctamente todo nuestro repertorio. Volviendo a mezclar las preguntas.");
        preguntasDisponibles = [...bancoPreguntas];
    }

    quizScreen.classList.remove("hidden");
    gameoverScreen.classList.add("hidden");
    
    clearInterval(timerInterval);
    timeLeft = 15;
    questionTimerElement.innerText = timeLeft;

    // Obtener una pregunta al azar usando como base la lista de disponibles
    indicePreguntaActual = Math.floor(Math.random() * preguntasDisponibles.length);
    preguntaActual = preguntasDisponibles[indicePreguntaActual];

    categoryBadge.innerText = preguntaActual.categoria;
    questionText.innerText = preguntaActual.pregunta;

    // Barajar opciones (Algoritmo Fisher-Yates)
    let opcionesMezcladas = [...preguntaActual.opciones];
    for (let i = opcionesMezcladas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opcionesMezcladas[i], opcionesMezcladas[j]] = [opcionesMezcladas[j], opcionesMezcladas[i]];
    }

    // Renderizar botones
    optionsContainer.innerHTML = "";
    opcionesMezcladas.forEach(opcion => {
        const button = document.createElement("button");
        button.classList.add("btn-option");
        button.innerText = opcion;
        button.onclick = () => verificarRespuesta(opcion);
        optionsContainer.appendChild(button);
    });

    iniciarTemporizadorPregunta();
}

function iniciarTemporizadorPregunta() {
    timerInterval = setInterval(() => {
        timeLeft--;
        questionTimerElement.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            quitarVida(); // Pierde vida por tiempo agotado
        }
    }, 1000);
}

function verificarRespuesta(opcionSeleccionada) {
    clearInterval(timerInterval);
    
    if (opcionSeleccionada === preguntaActual.correcta) {
        score += 10;
        scoreDisplay.innerText = score;
        
        // ELIMINAR PREGUNTA: Al ser correcta, la removemos de la lista para que no se repita
        preguntasDisponibles.splice(indicePreguntaActual, 1);
        
        siguientePregunta();
    } else {
        // Si falla, NO la removemos (así el usuario tiene la oportunidad de volver a verla e intentar acertar después)
        quitarVida();
    }
}

function mostrarGameOver() {
    clearInterval(timerInterval);
    quizScreen.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
}

// --- INTEGRACIÓN PUBLICITARIA (PROPELLERADS) ---
// Función para mostrar el anuncio cuando el usuario se queda sin vidas
function ofrecerVidaExtraPorAnuncio() {
    // Aquí puedes usar un cuadro de diálogo nativo de Telegram o HTML personalizado
    if (confirm("Te has quedado sin vidas. ¿Deseas ver un video corto para ganar 1 vida extra?")) {
        
        // Llamamos a la función de Monetag para activar el Rewarded Interstitial
        show_11235932()
            .then(() => {
                // ESTA SECCIÓN SE EJECUTA SI EL USUARIO VE EL ANUNCIO
                
                // 1. Otorgar la vida extra en el juego
                lives = 1; 
                
                // 2. Guardar la actualización en el localStorage para evitar trampas
                localStorage.setItem('trivia_vidas', lives);
                
                // 3. Notificar al usuario con la interfaz de Telegram o una alerta
                alert('¡Gracias por ver el anuncio! Has ganado 1 vida extra.');
                
                // 4. Continuar el juego (volver a cargar o reanudar la partida)
                siguientePregunta(); 
            })
            .catch((error) => {
                // En caso de que el anuncio falle, no cargue o sea cancelado
                console.error("Error al cargar el anuncio:", error);
                alert("No se pudo otorgar la vida en este momento. Inténtalo más tarde.");
            });
            
    } else {
        // Si el usuario rechaza ver el anuncio, se mantiene el Game Over o la pantalla de espera
        alert("Podrás recuperar vidas automáticamente esperando el tiempo de cuenta regresiva.");
    }
}
// Iniciar aplicación al cargar el documento
window.onload = cargarPreguntas;