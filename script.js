/******************************************************
 * Configuration et variables globales
 ******************************************************/
const COLS = 7;
const ROWS = 6;
const EMPTY = 0, HUMAN = 1, AI = 2;
let boardState = []; // Tableau 2D, rangées de bas en haut
let currentPlayer = HUMAN;
let gameOver = false;
let animations = []; // Animations en cours

const messageDiv = document.getElementById("message");

// Initialisation de Three.js
const scene = new THREE.Scene();
let aspect = window.innerWidth / window.innerHeight;
let viewHeight = 8;
let viewWidth = viewHeight * aspect;
// Caméra orthographique pour un rendu 2D
const camera = new THREE.OrthographicCamera(-viewWidth / 2, viewWidth / 2, viewHeight / 2, -viewHeight / 2, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lumière ambiante
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

/******************************************************
 * Création du plateau visuel
 ******************************************************/
const boardGroup = new THREE.Group();
// Fond bleu du plateau
const boardGeometry = new THREE.PlaneGeometry(COLS + 0.2, ROWS + 0.2);
const boardMaterial = new THREE.MeshBasicMaterial({ color: 0x1565C0 });
const boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
boardMesh.position.set(0, 0, 0);
boardGroup.add(boardMesh);

// Création des "trous" avec des anneaux pour représenter les cases
for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
        let x = col - (COLS - 1) / 2;
        let y = row - (ROWS - 1) / 2;
        let ringGeom = new THREE.RingGeometry(0.42, 0.45, 32);
        let ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        let ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(x, y, 0.1);
        ring.rotation.x = Math.PI / 2;
        boardGroup.add(ring);
    }
}
scene.add(boardGroup);

/******************************************************
 * Matérialisation de la grille : tracé des lignes
 ******************************************************/
const gridGroup = new THREE.Group();
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });

const xMin = -COLS / 2;
const xMax = COLS / 2;
const yMin = -ROWS / 2;
const yMax = ROWS / 2;

// Lignes verticales
for (let i = 0; i <= COLS; i++) {
    let x = xMin + i;
    const points = [];
    points.push(new THREE.Vector3(x, yMin, 0.15));
    points.push(new THREE.Vector3(x, yMax, 0.15));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    gridGroup.add(line);
}
// Lignes horizontales
for (let j = 0; j <= ROWS; j++) {
    let y = yMin + j;
    const points = [];
    points.push(new THREE.Vector3(xMin, y, 0.15));
    points.push(new THREE.Vector3(xMax, y, 0.15));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    gridGroup.add(line);
}
scene.add(gridGroup);

/******************************************************
 * Groupe pour les jetons
 ******************************************************/
const tokensGroup = new THREE.Group();
scene.add(tokensGroup);

/******************************************************
 * Initialisation de l'état du jeu
 ******************************************************/
function initBoardState() {
    boardState = [];
    for (let r = 0; r < ROWS; r++) {
        boardState.push(new Array(COLS).fill(EMPTY));
    }
}
initBoardState();

/******************************************************
 * Conversion des coordonnées écran -> monde
 ******************************************************/
function getMouseWorldPosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const pos = new THREE.Vector3(x, y, 0);
    pos.unproject(camera);
    return pos;
}

/******************************************************
 * Animation de la chute d'un jeton
 ******************************************************/
function animateTokenDrop(anim) {
    let currentTime = performance.now();
    let elapsed = currentTime - anim.startTime;
    let t = Math.min(elapsed / anim.duration, 1);
    // Easing (easeOutQuad)
    t = -Math.pow(t - 1, 2) + 1;
    anim.mesh.position.y = anim.startY + (anim.endY - anim.startY) * t;
    if (t >= 1) {
        playDropSound();
        return true; // Animation terminée
    }
    return false;
}

/******************************************************
 * Gestion du son
 ******************************************************/
function playDropSound() {
    const soundElem = document.getElementById("dropSound");
    if (soundElem) {
        let clone = soundElem.cloneNode();
        clone.play();
    }
}

/******************************************************
 * Ajout d'un jeton sur le plateau (avec animation)
 ******************************************************/
function dropToken(col, player) {
    // Trouver la première case vide dans la colonne
    let row = -1;
    for (let r = 0; r < ROWS; r++) {
        if (boardState[r][col] === EMPTY) {
            row = r;
            break;
        }
    }
    if (row === -1) return false; // Colonne pleine

    boardState[row][col] = player;
    let targetX = col - (COLS - 1) / 2;
    let targetY = row - (ROWS - 1) / 2;
    // Création du jeton (cercle)
    const tokenGeom = new THREE.CircleGeometry(0.4, 32);
    const tokenColor = (player === HUMAN) ? 0xff0000 : 0xffd700;
    const tokenMat = new THREE.MeshBasicMaterial({ color: tokenColor });
    const tokenMesh = new THREE.Mesh(tokenGeom, tokenMat);
    // Position de départ (en haut)
    tokenMesh.position.set(targetX, viewHeight / 2, 0.2);
    tokensGroup.add(tokenMesh);

    // Lancement de l'animation de chute
    animations.push({
        mesh: tokenMesh,
        startY: viewHeight / 2,
        endY: targetY,
        startTime: performance.now(),
        duration: 600
    });

    // Vérification de la victoire après un léger délai
    setTimeout(() => {
        if (checkWin(player)) {
            gameOver = true;
            messageDiv.innerText = (player === HUMAN ? "Vous avez gagné !" : "L'ordinateur a gagné !");
        } else if (isBoardFull()) {
            gameOver = true;
            messageDiv.innerText = "Match nul !";
        } else {
            currentPlayer = (player === HUMAN) ? AI : HUMAN;
            if (currentPlayer === AI && !gameOver) {
                setTimeout(() => { aiPlay(); }, 500);
            }
        }
    }, 650);
    return true;
}

/******************************************************
 * Gestion du clic utilisateur
 ******************************************************/
renderer.domElement.addEventListener("pointerdown", (event) => {
    if (gameOver || currentPlayer !== HUMAN) return;
    let pos = getMouseWorldPosition(event);
    // Détermine la colonne cliquée (chaque case mesure 1 unité)
    let col = Math.round(pos.x + (COLS - 1) / 2);
    if (col < 0 || col >= COLS) return;
    if (boardState[ROWS - 1][col] !== EMPTY) return;
    dropToken(col, HUMAN);
});

/******************************************************
 * Vérifications victoire et plateau plein
 ******************************************************/
function isBoardFull() {
    for (let col = 0; col < COLS; col++) {
        if (boardState[ROWS - 1][col] === EMPTY) return false;
    }
    return true;
}

function checkWin(player) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (boardState[r][c] !== player) continue;
            // Horizontal
            if (c <= COLS - 4 &&
                boardState[r][c + 1] === player &&
                boardState[r][c + 2] === player &&
                boardState[r][c + 3] === player)
                return true;
            // Vertical
            if (r <= ROWS - 4 &&
                boardState[r + 1][c] === player &&
                boardState[r + 2][c] === player &&
                boardState[r + 3][c] === player)
                return true;
            // Diagonale montante
            if (r <= ROWS - 4 && c <= COLS - 4 &&
                boardState[r + 1][c + 1] === player &&
                boardState[r + 2][c + 2] === player &&
                boardState[r + 3][c + 3] === player)
                return true;
            // Diagonale descendante
            if (r >= 3 && c <= COLS - 4 &&
                boardState[r - 1][c + 1] === player &&
                boardState[r - 2][c + 2] === player &&
                boardState[r - 3][c + 3] === player)
                return true;
        }
    }
    return false;
}

/******************************************************
 * Algorithme IA : Minimax avec élagage alpha-beta
 ******************************************************/
function getValidLocations(board) {
    let valid = [];
    for (let c = 0; c < COLS; c++) {
        if (board[ROWS - 1][c] === EMPTY) valid.push(c);
    }
    return valid;
}
function copyBoard(board) {
    return board.map(row => row.slice());
}
function getNextOpenRow(board, col) {
    for (let r = 0; r < ROWS; r++) {
        if (board[r][col] === EMPTY) return r;
    }
    return -1;
}
function evaluateWindow(window, player) {
    let score = 0;
    const opp = (player === HUMAN) ? AI : HUMAN;
    let countPlayer = window.filter(cell => cell === player).length;
    let countOpp = window.filter(cell => cell === opp).length;
    let countEmpty = window.filter(cell => cell === EMPTY).length;

    if (countPlayer === 4) {
        score += 100;
    } else if (countPlayer === 3 && countEmpty === 1) {
        score += 10;
    } else if (countPlayer === 2 && countEmpty === 2) {
        score += 5;
    }
    if (countOpp === 3 && countEmpty === 1) {
        score -= 80;
    }
    return score;
}
function scorePosition(board, player) {
    let score = 0;
    // Favoriser le centre
    let centerArray = [];
    for (let r = 0; r < ROWS; r++) {
        centerArray.push(board[r][Math.floor(COLS / 2)]);
    }
    let centerCount = centerArray.filter(cell => cell === player).length;
    score += centerCount * 6;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = board[r].slice(c, c + 4);
            score += evaluateWindow(window, player);
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            let window = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
            score += evaluateWindow(window, player);
        }
    }
    // Diagonale montante
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
            score += evaluateWindow(window, player);
        }
    }
    // Diagonale descendante
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
            score += evaluateWindow(window, player);
        }
    }
    return score;
}
function isTerminalNode(board) {
    return checkWinState(board, HUMAN) || checkWinState(board, AI) || getValidLocations(board).length === 0;
}
function checkWinState(board, player) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== player) continue;
            if (c <= COLS - 4 &&
                board[r][c + 1] === player &&
                board[r][c + 2] === player &&
                board[r][c + 3] === player)
                return true;
            if (r <= ROWS - 4 &&
                board[r + 1][c] === player &&
                board[r + 2][c] === player &&
                board[r + 3][c] === player)
                return true;
            if (r <= ROWS - 4 && c <= COLS - 4 &&
                board[r + 1][c + 1] === player &&
                board[r + 2][c + 2] === player &&
                board[r + 3][c + 3] === player)
                return true;
            if (r >= 3 && c <= COLS - 4 &&
                board[r - 1][c + 1] === player &&
                board[r - 2][c + 2] === player &&
                board[r - 3][c + 3] === player)
                return true;
        }
    }
    return false;
}
function minimax(board, depth, alpha, beta, maximizingPlayer) {
    let validLocations = getValidLocations(board);
    let terminal = isTerminalNode(board);
    if (depth === 0 || terminal) {
        if (terminal) {
            if (checkWinState(board, AI)) {
                return { score: 1000000, col: null };
            } else if (checkWinState(board, HUMAN)) {
                return { score: -1000000, col: null };
            } else {
                return { score: 0, col: null };
            }
        } else {
            return { score: scorePosition(board, AI), col: null };
        }
    }
    if (maximizingPlayer) {
        let value = -Infinity;
        let bestCol = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            let bCopy = copyBoard(board);
            let row = getNextOpenRow(bCopy, col);
            bCopy[row][col] = AI;
            let newScore = minimax(bCopy, depth - 1, alpha, beta, false).score;
            if (newScore > value) {
                value = newScore;
                bestCol = col;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return { score: value, col: bestCol };
    } else {
        let value = Infinity;
        let bestCol = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            let bCopy = copyBoard(board);
            let row = getNextOpenRow(bCopy, col);
            bCopy[row][col] = HUMAN;
            let newScore = minimax(bCopy, depth - 1, alpha, beta, true).score;
            if (newScore < value) {
                value = newScore;
                bestCol = col;
            }
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return { score: value, col: bestCol };
    }
}
function aiPlay() {
    let depth = 4;
    let { col } = minimax(copyBoard(boardState), depth, -Infinity, Infinity, true);
    if (col === null) return;
    dropToken(col, AI);
}

/******************************************************
 * Mise à jour de la jauge d'évaluation
 ******************************************************/
function updateGauge() {
    let evalScore = scorePosition(boardState, AI);
    let clamped = Math.max(-50, Math.min(50, evalScore));
    let percentage = ((clamped + 50) / 100) * 100;
    const gaugeBar = document.getElementById("gaugeBar");
    const gaugeLabel = document.getElementById("gaugeLabel");
    if (gaugeBar && gaugeLabel) {
        gaugeBar.style.width = percentage + "%";
        if (clamped > 5) {
            gaugeBar.style.background = "#4CAF50"; // vert
        } else if (clamped < -5) {
            gaugeBar.style.background = "#F44336"; // rouge
        } else {
            gaugeBar.style.background = "#888";
        }
        //gaugeLabel.innerText = "Position IA : " + evalScore.toFixed(0);
    }
}

/******************************************************
 * Boucle d'animation principale
 ******************************************************/
function animate() {
    requestAnimationFrame(animate);
    animations = animations.filter(anim => !animateTokenDrop(anim));
    renderer.render(scene, camera);
    updateGauge();
}
animate();

/******************************************************
 * Bouton Reset et fonction de réinitialisation
 ******************************************************/
document.getElementById("resetButton").addEventListener("click", resetGame);

function resetGame() {
    // Supprimer tous les jetons
    while (tokensGroup.children.length > 0) {
        let child = tokensGroup.children[0];
        tokensGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    // Réinitialiser l'état du plateau et les variables du jeu
    initBoardState();
    animations = [];
    gameOver = false;
    currentPlayer = HUMAN;
    messageDiv.innerText = "";
}

/******************************************************
 * Redimensionnement de la fenêtre
 ******************************************************/
window.addEventListener("resize", () => {
    aspect = window.innerWidth / window.innerHeight;
    viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});