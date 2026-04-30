const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// UI Elements
const hud = document.getElementById('hud');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreVal = document.getElementById('score-val');
const finalScoreEl = document.getElementById('final-score');
const powerLabelEl = document.getElementById('powerLevel');
const healthContainer = document.getElementById('health-container');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let frameCount = 0;
let currentStage = 1;

// Input
const mouse = { x: width / 2, y: height - 100 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
}, {passive: false});

// Entities
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let items = [];
let bgWaves = [];
let craters = [];
let floatingTexts = [];
let coins = [];

// Math utility
function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

// Background Classes
class BgWave {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.width = Math.random() * 150 + 50;
        this.speed = Math.random() * 3 + 1; // High speed
        this.opacity = Math.random() * 0.1 + 0.05;
    }
    update() {
        this.y += this.speed;
        if (this.y > height) {
            this.y = -20;
            this.x = Math.random() * width;
        }
    }
    draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.width, this.y);
        ctx.strokeStyle = `rgba(100, 200, 255, ${this.opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Crater {
    constructor(y) {
        this.x = Math.random() * width;
        this.y = y || -100;
        this.radius = Math.random() * 80 + 40;
        this.speed = Math.random() * 0.5 + 0.5; // moves slower than clouds (depth)
        this.opacity = Math.random() * 0.2 + 0.1;
    }
    update() {
        this.y += this.speed;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 10, 20, ${this.opacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(20, 40, 70, ${this.opacity})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner shadow
        ctx.beginPath();
        ctx.arc(this.x - 10, this.y - 10, this.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 5, 10, ${this.opacity})`;
        ctx.fill();
    }
}

// Effects Classes
class FloatingText {
    constructor(x, y, text, color, isHuge=false) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.isHuge = isHuge;
        this.life = isHuge ? 3.0 : 1.0;
        this.vy = isHuge ? -0.5 : -1.5;
    }
    update() {
        this.y += this.vy;
        this.life -= (this.isHuge ? 0.01 : 0.02);
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.life));
        ctx.fillStyle = this.color;
        ctx.font = this.isHuge ? '900 64px Orbitron' : 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = this.isHuge ? 20 : 4;
        ctx.shadowColor = this.isHuge ? this.color : '#000';
        ctx.fillText(this.text, this.x, this.y);
        // Stage popup glowing outline 
        if (this.isHuge) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.strokeText(this.text, this.x, this.y);
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, vx, vy, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.03;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class CoinDrop {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 40;
        this.y = y + (Math.random() - 0.5) * 40;
        this.radius = 5 + Math.random()*2;
        this.vy = -(2 + Math.random() * 4); // bounce up
        this.vx = (Math.random() - 0.5) * 6;
        this.gravity = 0.15;
        this.pulse = Math.random() * Math.PI;
    }
    update() {
        this.pulse += 0.2;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        // Magnetized to player
        let dist = distance(this.x, this.y, player.x, player.y);
        if (dist < 300) { // massive pull radius
            let force = 600 / Math.max(dist, 10);
            this.x += (player.x - this.x) / dist * force;
            this.y += (player.y - this.y) / dist * force;
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        let scale = 0.8 + Math.sin(this.pulse) * 0.2;
        ctx.scale(scale, scale);
        
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.radius, -Math.sin((18 + i * 72) * Math.PI / 180) * this.radius);
            ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * this.radius / 2.5, -Math.sin((54 + i * 72) * Math.PI / 180) * this.radius / 2.5);
        }
        ctx.closePath();
        ctx.fillStyle = '#ffaa00';
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}

class Item {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.vy = 2.5;
        this.color = '#ffff00';
        this.pulse = 0;
    }
    update() {
        this.y += this.vy;
        this.pulse += 0.1;
    }
    draw() {
        const glow = 15 + Math.sin(this.pulse) * 5;
        ctx.save();
        ctx.shadowBlur = glow;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        for(let i = 0; i < 6; i++) {
            ctx.lineTo(this.x + this.radius * Math.cos(i * Math.PI / 3 - Math.PI/2), 
                       this.y + this.radius * Math.sin(i * Math.PI / 3 - Math.PI/2));
        }
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.color;
        ctx.stroke();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText('POWER', this.x, this.y);
        ctx.restore();
    }
}

// Main Ships
class Player {
    constructor() {
        this.x = width / 2;
        this.y = height - 100;
        this.radius = 20;
        this.maxHealth = 5;
        this.health = this.maxHealth;
        this.power = 1;
        this.color = '#00ffff';
        this.lastShot = 0;
        this.fireRate = 12; // frames
    }

    update() {
        this.x += (mouse.x - this.x) * 0.1;
        this.y += (mouse.y - this.y) * 0.1;
        this.x = Math.max(this.radius + 40, Math.min(width - this.radius - 40, this.x)); // pad for wingmen
        this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));

        if (frameCount - this.lastShot > this.fireRate) {
            this.shoot();
            this.lastShot = frameCount;
        }

        if (Math.random() < 0.5) {
            particles.push(new Particle(this.x - 6, this.y + 20, Math.random() * 2 - 1, Math.random() * 2 + 3, '#00ffff', 2));
            particles.push(new Particle(this.x + 6, this.y + 20, Math.random() * 2 - 1, Math.random() * 2 + 3, '#00ffff', 2));
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 15;
        const shipColor = this.power > 7 ? '#ff00ff' : (this.power > 4 ? '#00ffaa' : this.color);
        ctx.shadowColor = shipColor;
        
        // Ship Body
        ctx.beginPath();
        ctx.moveTo(0, -30); // nose
        ctx.lineTo(8, -10);
        ctx.lineTo(25, 5); // right wing tip
        ctx.lineTo(15, 20); // right wing bottom
        ctx.lineTo(6, 12); 
        ctx.lineTo(6, 22); 
        ctx.lineTo(0, 15); 
        ctx.lineTo(-6, 22); 
        ctx.lineTo(-6, 12); 
        ctx.lineTo(-15, 20); 
        ctx.lineTo(-25, 5); 
        ctx.lineTo(-8, -10);
        ctx.closePath();
        
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.strokeStyle = shipColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // Glowing core
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 10);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fillStyle = shipColor;
        ctx.fill();

        // Energy Shield Hover
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${0.1 + (this.health/this.maxHealth)*0.1})`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + (this.health/this.maxHealth)*0.4})`;
        ctx.stroke();
        
        ctx.fillStyle = '#aaddff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.shadowBlur = 0;
        ctx.fillText(Math.floor((this.health/this.maxHealth)*100) + '%', this.radius + 30, 20);

        // Draw Wingmen
        let floatY = Math.sin(frameCount * 0.1) * 6;
        const drawWingman = (offsetX, offsetY) => {
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.shadowBlur = 10;
            ctx.shadowColor = shipColor;
            
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(8, 5);
            ctx.lineTo(0, 2);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.strokeStyle = shipColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Wingman shield
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI*2);
            ctx.fillStyle = `rgba(0, 255, 255, 0.1)`;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(0, 255, 255, 0.4)`;
            ctx.stroke();
            ctx.restore();
            
            if (Math.random() < 0.3) {
                particles.push(new Particle(this.x + offsetX, this.y + offsetY + 10, 0, 3, shipColor, 1));
            }
        };

        drawWingman(-45, floatY + 15);
        drawWingman(45, floatY + 15);

        ctx.restore();
    }

    shoot() {
        const c = this.color;
        const pColor = this.power > 7 ? '#ff00ff' : (this.power > 4 ? '#00ffaa' : c);
        let floatY = Math.sin(frameCount * 0.1) * 6;

        // Wingmen fire tracking/rapid secondary shots
        projectiles.push(new Projectile(this.x - 45, this.y + floatY, 0, -15, '#00ffff', 1.5, true));
        projectiles.push(new Projectile(this.x + 45, this.y + floatY, 0, -15, '#00ffff', 1.5, true));

        if (this.power <= 4) {
             let baseDmg = this.power === 4 ? 3 : (this.power === 3 ? 2 : 1.5);
             projectiles.push(new Projectile(this.x, this.y - 30, 0, -15, pColor, baseDmg, true));
             if (this.power >= 2) {
                 projectiles.push(new Projectile(this.x - 12, this.y - 20, -1, -14, pColor, 1.5, true));
                 projectiles.push(new Projectile(this.x + 12, this.y - 20, 1, -14, pColor, 1.5, true));
             }
             if (this.power >= 4) {
                 projectiles.push(new Projectile(this.x - 24, this.y - 10, -2, -13, pColor, 1.5, true));
                 projectiles.push(new Projectile(this.x + 24, this.y - 10, 2, -13, pColor, 1.5, true));
             }
        } else if (this.power >= 5 && this.power <= 7) {
            this.fireRate = 8;
            let count = this.power + 2; 
            for (let i = 0; i < count; i++) {
                let angle = -Math.PI/2 + (i - (count-1)/2) * 0.12;
                let speed = 16;
                let proj = new Projectile(this.x, this.y - 30, Math.cos(angle)*speed, Math.sin(angle)*speed, pColor, 2, true);
                if(i === Math.floor(count/2)) proj.radius = 10;
                projectiles.push(proj);
            }
        } else {
            this.fireRate = 5; 
            let count = this.power; 
            for (let i = 0; i < count; i++) {
                let angle = -Math.PI/2 + (i - (count-1)/2) * 0.1;
                let speed = 18;
                let proj = new Projectile(this.x, this.y - 30, Math.cos(angle)*speed, Math.sin(angle)*speed, pColor, 3, true);
                projectiles.push(proj);
            }
            let mainProj = new Projectile(this.x, this.y - 40, 0, -24, '#ffffff', 8, true);
            mainProj.radius = 16; 
            projectiles.push(mainProj);
        }
    }
}

class Projectile {
    constructor(x, y, vx, vy, color, damage, isBeam=false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 3 + damage;
        this.color = color;
        this.damage = damage;
        this.isEnemy = vy > 0;
        this.isBeam = isBeam;
        if(this.isBeam) this.radius = 4 + damage/2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.beginPath();
        if (this.isBeam && !this.isEnemy) {
            let tailLen = 30 + this.radius*2;
            ctx.moveTo(this.x, this.y + tailLen); 
            ctx.lineTo(this.x, this.y - tailLen); 
            ctx.lineWidth = this.radius;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius + 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.color = '#ff3333';
        this.health = 4;
        this.maxHealth = 4;
        this.speed = Math.random() * 1.5 + 0.5;
        this.vx = (Math.random() - 0.5) * 2;
    }
    update() {
        this.y += this.speed;
        this.x += this.vx;
        
        if (this.x < this.radius || this.x > width - this.radius) {
            this.vx *= -1;
        }

        // Fire rate scales slightly with stage
        if (Math.random() < 0.005 + (currentStage*0.001)) {
            projectiles.push(new Projectile(this.x, this.y + 20, 0, 6 + currentStage*0.5, '#ffaa00', 1.5));
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        
        // Swept-wing Stealth Fighter look
        ctx.beginPath();
        ctx.moveTo(0, 15); // Nose pointing down
        ctx.lineTo(5, 0); 
        ctx.lineTo(35, -5); // right wing tip out
        ctx.lineTo(35, -20); // right wing back
        ctx.lineTo(10, -10); 
        ctx.lineTo(0, -25); // center tail engine
        ctx.lineTo(-10, -10); 
        ctx.lineTo(-35, -20); // left wing back
        ctx.lineTo(-35, -5); // left wing tip out
        ctx.lineTo(-5, 0);
        ctx.closePath();

        ctx.fillStyle = '#223';
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Canopy/Eye
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(4, -2);
        ctx.lineTo(-4, -2);
        ctx.closePath();
        ctx.fillStyle = '#ffaa00';
        ctx.fill();

        // Engine glow
        ctx.beginPath();
        ctx.arc(0, -25, 4, 0, Math.PI*2);
        ctx.fillStyle = '#ff00ff';
        ctx.fill();

        // health bar outline
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 10, -Math.PI/2, (-Math.PI/2) + Math.PI*2 * (this.health/this.maxHealth));
        ctx.strokeStyle = `rgba(255, 50, 50, ${this.health/this.maxHealth})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }
}

// Initialization
function init() {
    player = new Player();
    projectiles = [];
    enemies = [];
    particles = [];
    items = [];
    bgWaves = [];
    floatingTexts = [];
    craters = [];
    coins = [];
    score = 0;
    frameCount = 0;
    currentStage = 1;
    
    for (let i = 0; i < 50; i++) {
        bgWaves.push(new BgWave());
    }
    for (let i = 0; i < 5; i++) {
        craters.push(new Crater(Math.random() * height));
    }
    
    updateHUD();
    floatingTexts.push(new FloatingText(width/2, height/2, `STAGE 1`, '#00ffff', true));
}

function updateHUD() {
    scoreVal.innerText = String(score).padStart(8, '0');
    powerLabelEl.innerText = player.power;
    
    healthContainer.innerHTML = '';
    for (let i = 0; i < player.maxHealth; i++) {
        const heart = document.createElement('div');
        heart.classList.add('heart');
        if (i >= player.health) {
            heart.classList.add('empty');
        }
        healthContainer.appendChild(heart);
    }
}

function spawnPatternEnemies() {
    let shipCount = 3 + (currentStage - 1) * 2; // +2 ships per stage 
    let pattern = Math.floor(Math.random() * 3); 
    
    let baseY = -50;
    let spacingX = width / (shipCount + 1);
    
    for (let i = 0; i < shipCount; i++) {
        let x, y;
        let speedY = Math.random() * 1.5 + 2 + (currentStage * 0.2); // Faster ships by stage
        let speedX = (Math.random() - 0.5) * 2;
        
        if (pattern === 0) {
            x = spacingX * (i + 1);
            y = baseY;
            speedX = 0; 
        } else if (pattern === 1) {
            // V-Shape
            x = (width / 2) + ((i - Math.floor(shipCount/2)) * 80);
            y = baseY - Math.abs(i - Math.floor(shipCount/2)) * 60;
            speedX = 0; 
        } else {
            x = Math.random() * (width - 100) + 50;
            y = baseY - (Math.random() * 150);
        }
        
        const enemy = new Enemy(x, y);
        enemy.health = 4 + (currentStage * 2); // Core health scaling
        enemy.maxHealth = enemy.health;
        enemy.vx = speedX;
        enemy.speed = speedY;
        
        enemies.push(enemy);
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, Math.random() * 3 + 1));
    }
}

function dropLoot(x, y) {
    // 15% Item drop chance to offset star economy
    if (Math.random() < 0.15) {
        items.push(new Item(x, y));
    } else {
        // Drop 3-6 stars
        let count = 3 + Math.floor(Math.random() * 4);
        for(let i=0; i<count; i++) {
            coins.push(new CoinDrop(x, y));
        }
    }
}

// Main Loop
function animate() {
    if (gameState !== 'PLAYING') return;

    // Ocean gradient with blur
    ctx.fillStyle = 'rgba(0, 15, 30, 0.4)'; 
    ctx.fillRect(0, 0, width, height);

    frameCount++;

    // Stage progression logic (Every 30000 points)
    let targetStage = Math.floor(score / 30000) + 1;
    if (targetStage > currentStage) {
        currentStage = targetStage;
        floatingTexts.push(new FloatingText(width/2, height/2, `STAGE ${currentStage}`, '#00ffff', true));
    }

    // Background Elements
    craters.forEach((c, idx) => {
        c.update();
        c.draw();
        if(c.y - c.radius > height) {
            craters.splice(idx, 1);
            craters.push(new Crater());
        }
    });

    bgWaves.forEach(wave => {
        wave.update();
        wave.draw();
    });

    // Player
    player.update();
    player.draw();

    // Spawning Waves (decreases interval heavily by stage)
    let spawnInterval = Math.max(70, 250 - (currentStage * 20));
    if (frameCount % spawnInterval === 0) {
        spawnPatternEnemies();
    }

    // Power Items
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.update();
        item.draw();
        
        if (distance(player.x, player.y, item.x, item.y) < player.radius + 15 + item.radius) { 
            if (player.health < player.maxHealth) player.health++;
            if (player.power < 10) player.power++; 
            score += 1500;
            floatingTexts.push(new FloatingText(item.x, item.y - 30, "POWER UP", "#00ffff"));
            updateHUD();
            items.splice(i, 1);
            createExplosion(item.x, item.y, '#ffff00');
            continue;
        }
        if (item.y > height + 50) items.splice(i, 1);
    }

    // Star Coins
    for (let i = coins.length - 1; i >= 0; i--) {
        let c = coins[i];
        c.update();
        c.draw();
        
        // Massive magnetic pull makes radius effectively larger
        if (distance(player.x, player.y, c.x, c.y) < player.radius + 15 + c.radius) { 
            score += 100 * currentStage; // coins worth more deeper in run
            floatingTexts.push(new FloatingText(c.x, c.y - 10, `+${100 * currentStage}`, "#ffff00"));
            updateHUD();
            coins.splice(i, 1);
            continue;
        }
        if (c.y > height + 50) coins.splice(i, 1);
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.update();
        p.draw();

        if (p.y < -50 || p.y > height + 50 || p.x < -50 || p.x > width + 50) {
            projectiles.splice(i, 1);
            continue;
        }

        let playerHitRadius = player.radius + 10; 
        if (p.isEnemy && distance(p.x, p.y, player.x, player.y) < playerHitRadius + p.radius) {
            player.health--;
            player.power = Math.max(1, player.power - 1); 
            updateHUD();
            floatingTexts.push(new FloatingText(player.x, player.y - 40, "SHIELD HIT", "#ff0000"));
            createExplosion(player.x, player.y, '#ff0000');
            projectiles.splice(i, 1);
            
            if (player.health <= 0) gameOver();
            continue;
        }

        if (!p.isEnemy) {
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (distance(p.x, p.y, e.x, e.y) < e.radius + p.radius) {
                    e.health -= p.damage;
                    createExplosion(p.x, p.y, p.color);
                    floatingTexts.push(new FloatingText(p.x, p.y, `-${p.damage*20}`, "#ffaa00"));
                    projectiles.splice(i, 1);
                    hit = true;
                    
                    if (e.health <= 0) {
                        let scoreGain = 500 * Math.ceil(p.damage);
                        score += scoreGain;
                        updateHUD();
                        createExplosion(e.x, e.y, e.color);
                        dropLoot(e.x, e.y);
                        enemies.splice(j, 1);
                    }
                    break;
                }
            }
            if (hit) continue;
        }
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.update();
        e.draw();

        if (distance(player.x, player.y, e.x, e.y) < player.radius + 10 + e.radius) {
            createExplosion(e.x, e.y, e.color);
            floatingTexts.push(new FloatingText(player.x, player.y - 50, "CRASH!", "#ff0000"));
            player.health--;
            updateHUD();
            enemies.splice(i, 1);
            if (player.health <= 0) gameOver();
            continue;
        }
        if (e.y > height + 50) enemies.splice(i, 1);
    }

    // Processing Arrays
    [particles, floatingTexts].forEach(arr => {
        for (let i = arr.length - 1; i >= 0; i--) {
            arr[i].update();
            arr[i].draw();
            if (arr[i].life <= 0) arr.splice(i, 1);
        }
    });

    requestAnimationFrame(animate);
}

function startGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    init();
    animate();
}

function gameOver() {
    gameState = 'GAMEOVER';
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

init();
craters.forEach(c => { c.draw(); });
bgWaves.forEach(wave => { wave.draw(); });
