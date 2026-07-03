// Inicializar la WebApp de Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Expandir la ventana al tamaño completo del móvil

let bancoPreguntas = [];
let preguntaActual = null;
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
    quizScreen.classList.remove("hidden");
    gameoverScreen.classList.add("hidden");
    
    clearInterval(timerInterval);
    timeLeft = 15;
    questionTimerElement.innerText = timeLeft;

    // Obtener una pregunta al azar
    const randomIndex = Math.floor(Math.random() * bancoPreguntas.length);
    preguntaActual = bancoPreguntas[randomIndex];

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
        siguientePregunta();
    } else {
        quitarVida();
    }
}

function mostrarGameOver() {
    clearInterval(timerInterval);
    quizScreen.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
}

// --- INTEGRACIÓN PUBLICITARIA (PROPELLERADS) ---
btnRewardVideo.onclick = () => {
    // Intenta ejecutar el tag interstitial/video de PropellerAds cargado en el HTML
    if (typeof showAtag === 'function') {
        showAtag(); // Invoca la ventana publicitaria si está disponible globalmente
    } else {
        // Fallback o simulación si el bloqueador de anuncios detiene el script externo
        console.log("Invocando anuncio de PropellerAds...");
    }

    // Simulador de recompensa tras visualización
    // En entornos reales, puedes añadir lógica ligada a eventos si tu tag lo permite.
    setTimeout(() => {
        lives += 1;
        actualizarInterfazVidas();
        siguientePregunta();
        tg.showAlert("¡Has ganado 1 vida extra por ver el video!");
    }, 2000); 
};

// Iniciar aplicación al cargar el documento
window.onload = cargarPreguntas;