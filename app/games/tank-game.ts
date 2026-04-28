import * as THREE from 'three';

type GameState = 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameover';
type UpgradeId = 'health' | 'damage' | 'armor' | 'reload' | 'chargePower' | 'chargeRange';
type StoreUpgradeId = 'starterHealth' | 'starterDamage' | 'starterArmor' | 'starterReload' | 'starterChargePower' | 'starterChargeRange';
type EnemyKind = 'tank' | 'drone' | 'boss' | 'infantry';
type ShiftMode = 'strike' | 'wave';

type UpgradeButton = HTMLButtonElement & { dataset: DOMStringMap & { upgrade: UpgradeId } };
type StoreButton = HTMLButtonElement & { dataset: DOMStringMap & { storeUpgrade: StoreUpgradeId } };

function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required DOM element: ${selector}`);
  }
  return element;
}

interface TankVisual {
  root: THREE.Group;
  turretPivot: THREE.Group;
  gunPivot: THREE.Group;
  muzzle: THREE.Object3D;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  root: THREE.Group;
  turretPivot?: THREE.Group;
  gunPivot?: THREE.Group;
  muzzle?: THREE.Object3D;
  radialMuzzles?: THREE.Object3D[];
  sideDoors?: THREE.Object3D[];
  rearDoor?: THREE.Object3D;
  speed: number;
  health: number;
  fireCooldown: number;
  desiredRange: number;
  turnSpeed: number;
  bobOffset: number;
  orbitDirection: number;
  altitude: number;
  flashTime: number;
  spawnCooldown?: number;
  spawnCount?: number;
  infantryCooldown?: number;
  infantryCount?: number;
  contactCooldown?: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  owner: 'player' | 'enemy';
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  color: number;
  radius: number;
  explosionRadius?: number;
  explosionPower?: number;
}

interface Effect {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  update: (progress: number) => void;
  dispose: () => void;
}

interface Obstacle {
  mesh: THREE.Mesh;
  box: THREE.Box3;
}

class AudioManager {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private musicTimer?: number;
  private musicStarted = false;

  init() {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.1;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    if (!this.musicStarted) {
      this.startMusic();
    }
  }

  cannon() {
    this.playTone({ frequency: 96, slideTo: 40, duration: 0.2, type: 'sawtooth', volume: 0.32 });
    this.playTone({ frequency: 184, slideTo: 72, duration: 0.11, type: 'square', volume: 0.14, delay: 0.018 });
  }

  hit() {
    this.playTone({ frequency: 860, slideTo: 520, duration: 0.075, type: 'triangle', volume: 0.13 });
    this.playTone({ frequency: 420, slideTo: 250, duration: 0.05, type: 'square', volume: 0.05, delay: 0.01 });
  }

  impact() {
    this.playTone({ frequency: 130, slideTo: 55, duration: 0.16, type: 'sawtooth', volume: 0.18 });
    this.playTone({ frequency: 240, slideTo: 90, duration: 0.11, type: 'triangle', volume: 0.08, delay: 0.015 });
  }

  kill() {
    this.playTone({ frequency: 160, slideTo: 55, duration: 0.16, type: 'sawtooth', volume: 0.18 });
  }

  damage() {
    this.playTone({ frequency: 84, slideTo: 58, duration: 0.22, type: 'square', volume: 0.24 });
    this.playTone({ frequency: 180, slideTo: 90, duration: 0.08, type: 'triangle', volume: 0.08, delay: 0.015 });
  }

  waveClear() {
    this.playTone({ frequency: 392, slideTo: 392, duration: 0.12, type: 'triangle', volume: 0.1 });
    this.playTone({ frequency: 523.25, slideTo: 523.25, duration: 0.14, type: 'triangle', volume: 0.12, delay: 0.08 });
    this.playTone({ frequency: 659.25, slideTo: 659.25, duration: 0.16, type: 'triangle', volume: 0.14, delay: 0.16 });
  }

  drone() {
    this.playTone({ frequency: 540, slideTo: 260, duration: 0.14, type: 'triangle', volume: 0.16 });
  }

  destroy() {
    if (this.musicTimer !== undefined) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }

    if (this.context && this.context.state !== 'closed') {
      void this.context.close();
    }
  }

  private startMusic() {
    if (this.musicTimer !== undefined) {
      return;
    }

    this.musicStarted = true;
    this.scheduleMusicPhrase(0);

    const tempo = 84;
    const beat = 60 / tempo;
    const phraseLength = beat * 8 * 1000;
    this.musicTimer = window.setInterval(() => {
      this.scheduleMusicPhrase(0.06);
    }, phraseLength);
  }

  private scheduleMusicPhrase(delayOffset: number) {
    const beat = 60 / 84;
    const padNotes = [196, 220, 246.94, 220];
    const melody = [392, 440, 493.88, 440, 392, 329.63, 349.23, 392];

    for (let bar = 0; bar < 4; bar += 1) {
      const baseDelay = delayOffset + bar * beat * 2;
      const padFrequency = padNotes[bar];
      this.playTone({ frequency: padFrequency, slideTo: padFrequency * 0.995, duration: beat * 1.8, type: 'triangle', volume: 0.026, delay: baseDelay });
      this.playTone({ frequency: padFrequency / 2, slideTo: padFrequency / 2, duration: beat * 1.6, type: 'sine', volume: 0.018, delay: baseDelay + beat * 0.05 });
    }

    for (let step = 0; step < melody.length; step += 1) {
      const note = melody[step];
      this.playTone({ frequency: note, slideTo: note * 0.998, duration: beat * 0.42, type: 'triangle', volume: 0.03, delay: delayOffset + step * beat * 0.9 + 0.04 });
    }
  }

  private playTone(options: {
    frequency: number;
    slideTo: number;
    duration: number;
    type: OscillatorType;
    volume: number;
    delay?: number;
  }) {
    if (!this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(start);
    oscillator.stop(end + 0.03);
  }
}

export class TankGame {
  private readonly canvas = queryElement<HTMLCanvasElement>('#game-canvas');
  private readonly healthValue = queryElement<HTMLElement>('#health-value');
  private readonly healthBarFill = queryElement<HTMLElement>('#health-bar-fill');
  private readonly waveValue = queryElement<HTMLElement>('#wave-value');
  private readonly enemyCountValue = queryElement<HTMLElement>('#enemy-count');
  private readonly killsValue = queryElement<HTMLElement>('#kills-value');
  private readonly coinValue = queryElement<HTMLElement>('#coin-value');
  private readonly bankCoinsValue = queryElement<HTMLElement>('#bank-coins-value');
  private readonly shiftValue = queryElement<HTMLElement>('#shift-value');
  private readonly shiftBarFill = queryElement<HTMLElement>('#shift-bar-fill');
  private readonly statusPill = queryElement<HTMLElement>('#status-pill');
  private readonly chargeMeter = queryElement<HTMLElement>('#charge-meter');
  private readonly chargeMeterFill = queryElement<HTMLElement>('#charge-meter-fill');
  private readonly chargeMeterText = queryElement<HTMLElement>('#charge-meter-text');
  private readonly crosshair = queryElement<HTMLElement>('#crosshair');
  private readonly targetDot = queryElement<HTMLElement>('#target-dot');
  private readonly hitMarker = queryElement<HTMLElement>('#hit-marker');
  private readonly menuOverlay = queryElement<HTMLElement>('#menu-overlay');
  private readonly pausedOverlay = queryElement<HTMLElement>('#paused-overlay');
  private readonly upgradeOverlay = queryElement<HTMLElement>('#upgrade-overlay');
  private readonly upgradeTitle = queryElement<HTMLElement>('#upgrade-title');
  private readonly upgradeSubtitle = queryElement<HTMLElement>('#upgrade-subtitle');
  private readonly gameoverOverlay = queryElement<HTMLElement>('#gameover-overlay');
  private readonly finalScoreText = queryElement<HTMLElement>('#final-score-text');
  private readonly startButton = queryElement<HTMLButtonElement>('#start-button');
  private readonly scrollToPlayButton = queryElement<HTMLButtonElement>('#scroll-to-play-button');
  private readonly resumeButton = queryElement<HTMLButtonElement>('#resume-button');
  private readonly restartButton = queryElement<HTMLButtonElement>('#restart-button');
  private readonly upgradeButtons = Array.from(document.querySelectorAll<UpgradeButton>('[data-upgrade]'));
  private readonly storeButtons = Array.from(document.querySelectorAll<StoreButton>('[data-store-upgrade]'));

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 300);
  private readonly clock = new THREE.Clock();
  private readonly blockerRaycaster = new THREE.Raycaster();
  private readonly screenRaycaster = new THREE.Raycaster();
  private readonly audio = new AudioManager();
  private readonly keys = new Set<string>();
  private readonly obstacles: Obstacle[] = [];
  private readonly blockers: THREE.Object3D[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly effects: Effect[] = [];
  private readonly cameraModes = [
    { name: 'close', distance: 6.2, height: 2.8 },
    { name: 'wide', distance: 11.5, height: 4.8 },
  ];

  private readonly worldHalfSize = 74;
  private readonly playerRadius = 1.7;
  private readonly enemyRadius = 1.8;
  private readonly tankHoverHeight = 0.72;
  private readonly baseTankShootInterval = 0.58;
  private readonly playerPosition = new THREE.Vector3(0, 0, 0);
  private readonly playerVelocity = new THREE.Vector3();

  private terrainMesh!: THREE.Mesh;
  private playerTank!: TankVisual;
  private playerYaw = 0;
  private aimYaw = 0;
  private aimPitch = 0.14;
  private cameraModeIndex = 1;
  private isRightMouseLooking = false;
  private isChargingShot = false;
  private chargeStartedAt = 0;
  private chargeAmount = 0;
  private state: GameState = 'menu';
  private destroyed = false;
  private animationFrameId?: number;
  private currentWave = 1;
  private kills = 0;
  private nextEnemyId = 1;
  private lastShotAt = 0;
  private hitMarkerTimer = 0;
  private damagePulseTimer = 0;
  private playerMaxHealth = 100;
  private playerHealth = 100;
  private playerDamage = 1;
  private armorFactor = 1;
  private shootInterval = this.baseTankShootInterval;
  private chargeDamageBonus = 0;
  private chargeRangeBonus = 0;
  private shiftKills = 0;
  private shiftKillsRequired = 5;
  private shiftReady = false;
  private shiftMode: ShiftMode = 'strike';
  private targetingMode = false;
  private targetDotX = window.innerWidth / 2;
  private targetDotY = window.innerHeight / 2;
  private waveJustCleared = false;
  private bankCoins = 0;
  private starterUpgrades: Record<StoreUpgradeId, number> = {
    starterHealth: 0,
    starterDamage: 0,
    starterArmor: 0,
    starterReload: 0,
    starterChargePower: 0,
    starterChargeRange: 0,
  };

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;

    this.scene.background = new THREE.Color(0xa7b987);
    this.scene.fog = new THREE.Fog(0xa7b987, 55, 180);

    this.loadMetaProgress();
    this.buildEnvironment();
    this.buildPlayer();
    this.applyStarterLoadout();
    this.resetPlayerPlacement();
    this.bindEvents();
    this.updateHud();
    this.setState('menu');
    this.animate();
  }

  destroy() {
    this.destroyed = true;

    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    this.clearEnemies();
    this.clearProjectiles();
    this.clearEffects();
    this.disposeGroup(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.audio.destroy();
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.startButton.addEventListener('click', this.handleStart);
    this.scrollToPlayButton.addEventListener('click', this.handleScrollToPlay);
    this.resumeButton.addEventListener('click', this.handleResume);
    this.restartButton.addEventListener('click', this.handleRestart);

    for (const button of this.upgradeButtons) {
      button.addEventListener('click', () => this.handleUpgradeChoice(button.dataset.upgrade));
    }

    for (const button of this.storeButtons) {
      button.addEventListener('click', () => this.handleStorePurchase(button.dataset.storeUpgrade));
    }
  }

  private buildEnvironment() {
    const ambient = new THREE.HemisphereLight(0xece3c1, 0x4a5232, 1.15);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff2c6, 1.55);
    sun.position.set(42, 55, 18);
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0xa6d0ff, 0.45);
    rim.position.set(-18, 22, -30);
    this.scene.add(rim);

    const terrainGeometry = new THREE.PlaneGeometry(180, 180, 120, 120);
    const terrainPositions = terrainGeometry.attributes.position;
    for (let index = 0; index < terrainPositions.count; index += 1) {
      const x = terrainPositions.getX(index);
      const z = terrainPositions.getY(index);
      terrainPositions.setZ(index, this.getTerrainHeight(x, z));
    }
    terrainPositions.needsUpdate = true;
    terrainGeometry.computeVertexNormals();

    this.terrainMesh = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x7f9565,
        roughness: 0.96,
        metalness: 0.04,
      }),
    );
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.terrainMesh);
    this.blockers.push(this.terrainMesh);

    const terrainWire = new THREE.Mesh(
      terrainGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: 0x546247, wireframe: true, transparent: true, opacity: 0.06 }),
    );
    terrainWire.rotation.x = -Math.PI / 2;
    terrainWire.position.y = 0.05;
    this.scene.add(terrainWire);

    const skyBand = new THREE.Mesh(
      new THREE.CylinderGeometry(100, 120, 18, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8da386, side: THREE.BackSide, transparent: true, opacity: 0.18 }),
    );
    skyBand.position.y = 8;
    this.scene.add(skyBand);

    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x6d6f57, roughness: 1, metalness: 0 });
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2;
      const radius = 92 + (index % 3) * 5;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(7 + (index % 4) * 2.2, 12 + (index % 5) * 2.5, 7),
        mountainMaterial,
      );
      mountain.position.set(Math.cos(angle) * radius, 5.5, Math.sin(angle) * radius);
      this.scene.add(mountain);
    }

    this.addRock(new THREE.Vector3(-20, 0, -18), new THREE.Vector3(4.2, 2.7, 4.7));
    this.addRock(new THREE.Vector3(18, 0, -25), new THREE.Vector3(5.4, 3.1, 5.1));
    this.addRock(new THREE.Vector3(-28, 0, 16), new THREE.Vector3(6.2, 3.8, 5.8));
    this.addRock(new THREE.Vector3(26, 0, 20), new THREE.Vector3(4.5, 2.8, 4.3));
    this.addRock(new THREE.Vector3(-8, 0, 30), new THREE.Vector3(7, 3.5, 6.2));
    this.addRock(new THREE.Vector3(6, 0, -6), new THREE.Vector3(3.8, 2.2, 3.6));
    this.addRock(new THREE.Vector3(33, 0, -5), new THREE.Vector3(5.7, 3.5, 4.6));
    this.addRock(new THREE.Vector3(-34, 0, -2), new THREE.Vector3(5.2, 3.2, 4.8));
  }

  private buildPlayer() {
    this.playerTank = this.createTankVisual({ hull: 0x5b6e43, turret: 0x708656, accent: 0xd8e6b0 });
    this.scene.add(this.playerTank.root);
  }

  private createTankVisual(colors: { hull: number; turret: number; accent: number }) {
    const root = new THREE.Group();

    const hullMaterial = new THREE.MeshStandardMaterial({ color: colors.hull, roughness: 0.88, metalness: 0.12 });
    const turretMaterial = new THREE.MeshStandardMaterial({ color: colors.turret, roughness: 0.8, metalness: 0.14 });
    const accentMaterial = new THREE.MeshBasicMaterial({ color: colors.accent });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.85, 4.4), hullMaterial);
    hull.position.y = 0.85;
    root.add(hull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.48, 1.25), turretMaterial);
    glacis.position.set(0, 1.1, -1.55);
    root.add(glacis);

    const trackGeometry = new THREE.BoxGeometry(0.44, 0.52, 4.6);
    const leftTrack = new THREE.Mesh(trackGeometry, new THREE.MeshStandardMaterial({ color: 0x2f3428, roughness: 0.92, metalness: 0.08 }));
    leftTrack.position.set(-1.36, 0.54, 0);
    root.add(leftTrack);

    const rightTrack = leftTrack.clone();
    rightTrack.position.x = 1.36;
    root.add(rightTrack);

    const turretPivot = new THREE.Group();
    turretPivot.position.set(0, 1.25, -0.15);
    root.add(turretPivot);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.1, 0.56, 18), turretMaterial);
    turret.rotation.x = Math.PI / 2;
    turretPivot.add(turret);

    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.34, 1.8), turretMaterial);
    turretTop.position.set(0, 0.12, -0.05);
    turretPivot.add(turretTop);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12), accentMaterial);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.set(0, 0.24, -0.2);
    turretPivot.add(hatch);

    const gunPivot = new THREE.Group();
    gunPivot.position.set(0, 0.06, -1.15);
    turretPivot.add(gunPivot);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.7), turretMaterial);
    barrel.position.set(0, 0, -1.85);
    gunPivot.add(barrel);

    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.28), accentMaterial);
    muzzleBrake.position.set(0, 0, -3.6);
    gunPivot.add(muzzleBrake);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -3.8);
    gunPivot.add(muzzle);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), accentMaterial);
    antenna.position.set(0.58, 0.58, 0.22);
    turretPivot.add(antenna);

    return { root, turretPivot, gunPivot, muzzle };
  }

  private createBossTankVisual() {
    const root = new THREE.Group();
    const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4240, roughness: 0.86, metalness: 0.28 });
    const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5845, roughness: 0.82, metalness: 0.2 });
    const cannonMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2324, roughness: 0.72, metalness: 0.38 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xff6f3c });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(7.8, 2.2, 10.8), hullMaterial);
    hull.position.y = 1.55;
    root.add(hull);

    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.2, 7.2), armorMaterial);
    upperDeck.position.set(0, 3.15, -0.45);
    root.add(upperDeck);

    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 11.6), cannonMaterial);
    leftTrack.position.set(-4.55, 0.95, 0);
    root.add(leftTrack);

    const rightTrack = leftTrack.clone();
    rightTrack.position.x = 4.55;
    root.add(rightTrack);

    const turretPivot = new THREE.Group();
    turretPivot.position.set(0, 4.05, -1.15);
    root.add(turretPivot);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.35, 1.1, 24), armorMaterial);
    turret.rotation.x = Math.PI / 2;
    turretPivot.add(turret);

    const gunPivot = new THREE.Group();
    gunPivot.position.set(0, 0.05, -2.35);
    turretPivot.add(gunPivot);

    const mainBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 5.6), cannonMaterial);
    mainBarrel.position.set(0, 0, -2.75);
    gunPivot.add(mainBarrel);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -5.65);
    gunPivot.add(muzzle);

    const radialMuzzles: THREE.Object3D[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = angle;
      pivot.position.y = 2.65;
      root.add(pivot);

      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 4.1), cannonMaterial);
      barrel.position.set(0, 0, -5.4);
      pivot.add(barrel);

      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.42), glowMaterial);
      brake.position.set(0, 0, -7.45);
      pivot.add(brake);

      const radialMuzzle = new THREE.Object3D();
      radialMuzzle.position.set(0, 0, -7.75);
      pivot.add(radialMuzzle);
      radialMuzzles.push(radialMuzzle);
    }

    const rearDoor = new THREE.Group();
    rearDoor.position.set(0, 1.65, 5.55);
    root.add(rearDoor);
    const rearDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 0.28), armorMaterial);
    rearDoor.add(rearDoorMesh);

    const sideDoors: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const door = new THREE.Group();
      door.position.set(side * 4.05, 1.75, 1.4);
      door.rotation.z = side * 0.08;
      root.add(door);
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.7, 2.2), armorMaterial);
      door.add(doorMesh);
      sideDoors.push(door);
    }

    for (const x of [-2.4, 0, 2.4]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.22), glowMaterial);
      light.position.set(x, 2.5, -5.58);
      root.add(light);
    }

    return { root, turretPivot, gunPivot, muzzle, radialMuzzles, sideDoors, rearDoor };
  }

  private createInfantryVisual() {
    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x594833, roughness: 0.9, metalness: 0.05 });
    const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3428, roughness: 0.84, metalness: 0.08 });
    const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf7a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.3), bodyMaterial);
    body.position.y = 0.72;
    root.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), helmetMaterial);
    head.position.y = 1.32;
    root.add(head);

    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.92), weaponMaterial);
    rifle.position.set(0.26, 0.92, -0.38);
    root.add(rifle);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0.26, 0.92, -0.9);
    root.add(muzzle);
    root.userData.muzzle = muzzle;

    return root;
  }

  private createDroneVisual() {
    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c6670,
      roughness: 0.52,
      metalness: 0.42,
      emissive: 0x28323b,
      emissiveIntensity: 0.7,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({ color: 0xff9d68 });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x73808b, roughness: 0.46, metalness: 0.38 });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 5.8), bodyMaterial);
    root.add(fuselage);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 10), accentMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 3.35);
    root.add(nose);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.42, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x8ce1ff, transparent: true, opacity: 0.75 }),
    );
    cockpit.position.set(0, 0.45, 0.65);
    root.add(cockpit);

    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.18, 1.5), wingMaterial);
    mainWing.position.set(0, 0.05, 0.2);
    root.add(mainWing);

    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 0.9), wingMaterial);
    tailWing.position.set(0, 0.15, -2.15);
    root.add(tailWing);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.8), wingMaterial);
    fin.position.set(0, 0.72, -2.15);
    root.add(fin);

    for (const x of [-2.45, 2.45]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.1, 12), bodyMaterial);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, -0.18, 0.25);
      root.add(engine);

      const engineGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.18, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd36a }),
      );
      engineGlow.rotation.x = Math.PI / 2;
      engineGlow.position.set(x, -0.18, -0.35);
      root.add(engineGlow);
    }

    return root;
  }

  private addRock(position: THREE.Vector3, size: THREE.Vector3) {
    const groundedPosition = new THREE.Vector3(position.x, this.getTerrainHeight(position.x, position.z) + size.y * 0.44, position.z);
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color: 0x676956, roughness: 0.98, metalness: 0.04 }),
    );
    rock.position.copy(groundedPosition);
    rock.rotation.y = Math.random() * Math.PI;
    rock.rotation.x = THREE.MathUtils.randFloatSpread(0.15);
    rock.rotation.z = THREE.MathUtils.randFloatSpread(0.15);
    this.scene.add(rock);

    this.obstacles.push({ mesh: rock, box: new THREE.Box3().setFromObject(rock) });
    this.blockers.push(rock);
  }

  private getTerrainHeight(x: number, z: number) {
    const wide = Math.sin(x * 0.048) * 1.1 + Math.cos(z * 0.045) * 0.9;
    const diagonal = Math.sin((x + z) * 0.03) * 0.65;
    const pocketA = Math.exp(-((x - 22) * (x - 22) + (z + 18) * (z + 18)) / 520) * 2.3;
    const pocketB = Math.exp(-((x + 28) * (x + 28) + (z - 14) * (z - 14)) / 430) * 1.8;
    const centerDip = Math.exp(-(x * x + z * z) / 760) * -1.15;
    return wide + diagonal + pocketA + pocketB + centerDip;
  }

  private getTankHeight(x: number, z: number) {
    return this.getTerrainHeight(x, z) + this.tankHoverHeight;
  }

  private resetPlayerPlacement() {
    this.playerPosition.set(0, this.getTankHeight(0, 0), 0);
    this.playerVelocity.set(0, 0, 0);
    this.playerYaw = 0;
    this.aimYaw = 0;
    this.aimPitch = 0.14;
    this.targetDotX = window.innerWidth / 2;
    this.targetDotY = window.innerHeight / 2;
    this.updatePlayerVisuals();
    this.updateCamera();
    this.updateTargetDotUi();
  }

  private handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.targetDotX = window.innerWidth / 2;
    this.targetDotY = window.innerHeight / 2;
    this.updateTargetDotUi();
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && this.state === 'playing') {
      event.preventDefault();
      this.setState('paused');
      return;
    }

    if (event.code === 'Tab' && this.state === 'playing') {
      event.preventDefault();
      if (!event.repeat) {
        this.toggleShiftMode();
      }
      return;
    }

    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
      if (this.targetingMode) {
        this.cancelTargetingMode(false);
        return;
      }

      if (this.state === 'playing' && this.shiftReady) {
        if (this.shiftMode === 'strike') {
          this.activateTargetingMode();
        } else {
          this.fireShiftWave();
        }
        return;
      }
    }

    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private handleMouseDown = (event: MouseEvent) => {
    if (this.targetingMode) {
      if (event.button === 0) {
        this.fireShiftStrike();
      }
      return;
    }

    if (this.state === 'playing' && document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock();
    }

    if (event.button === 0) {
      if (this.state === 'playing') {
        this.startChargingShot();
      }
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      if (this.state === 'playing') {
        this.isRightMouseLooking = true;
      }
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 2) {
      this.isRightMouseLooking = false;
    }

    if (this.targetingMode) {
      return;
    }

    if (event.button === 0 && this.state === 'playing') {
      this.releaseChargedShot();
    }
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (this.targetingMode && this.state === 'playing') {
      const rect = this.canvas.getBoundingClientRect();
      this.targetDotX = THREE.MathUtils.clamp(event.clientX, rect.left, rect.right);
      this.targetDotY = THREE.MathUtils.clamp(event.clientY, rect.top, rect.bottom);
      this.updateTargetDotUi();
      return;
    }

    const hasAimControl = document.pointerLockElement === this.canvas || this.isRightMouseLooking;
    if (this.state !== 'playing' || !hasAimControl) {
      return;
    }

    const sensitivity = 0.0052;
    this.aimYaw -= event.movementX * sensitivity;
    this.aimPitch = THREE.MathUtils.clamp(this.aimPitch - event.movementY * sensitivity, -0.75, 1.1);
    this.playerYaw = this.aimYaw;
  };

  private handlePointerLockChange = () => {
    if (this.targetingMode) {
      return;
    }

    const locked = document.pointerLockElement === this.canvas;
    if (!locked) {
      this.isRightMouseLooking = false;
      if (this.state === 'playing') {
        this.setState('paused');
      }
    }
  };

  private handleStart = () => {
    this.audio.init();
    this.resetProgress();
    this.startWave(1);
    this.setState('playing');
    void this.canvas.requestPointerLock();
  };

  private handleScrollToPlay = () => {
    this.startButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  private handleResume = () => {
    this.audio.init();
    this.setState('playing');
    void this.canvas.requestPointerLock();
  };

  private handleRestart = () => {
    this.audio.init();
    this.resetProgress();
    this.setState('menu');
  };

  private handleUpgradeChoice(upgrade: UpgradeId) {
    if (this.state !== 'upgrade') {
      return;
    }

    this.applyUpgrade(upgrade);
    this.startWave(this.currentWave + 1);
    this.setState('playing');
  }

  private handleStorePurchase(upgrade: StoreUpgradeId) {
    if (this.state !== 'menu') {
      return;
    }

    const cost = this.getStoreUpgradeCost(upgrade);
    if (this.bankCoins < cost) {
      return;
    }

    this.bankCoins -= cost;
    this.starterUpgrades[upgrade] += 1;
    this.saveMetaProgress();
    this.applyStarterLoadout();
    this.updateStoreUi();
    this.updateHud();
  }

  private loadMetaProgress() {
    try {
      const raw = window.localStorage.getItem('iron-plains-assault-progress');
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        coins?: number;
        starterUpgrades?: Partial<Record<StoreUpgradeId, number>>;
      };

      this.bankCoins = Math.max(0, Math.floor(parsed.coins ?? 0));
      this.starterUpgrades = {
        starterHealth: Math.max(0, Math.floor(parsed.starterUpgrades?.starterHealth ?? 0)),
        starterDamage: Math.max(0, Math.floor(parsed.starterUpgrades?.starterDamage ?? 0)),
        starterArmor: Math.max(0, Math.floor(parsed.starterUpgrades?.starterArmor ?? 0)),
        starterReload: Math.max(0, Math.floor(parsed.starterUpgrades?.starterReload ?? 0)),
        starterChargePower: Math.max(0, Math.floor(parsed.starterUpgrades?.starterChargePower ?? 0)),
        starterChargeRange: Math.max(0, Math.floor(parsed.starterUpgrades?.starterChargeRange ?? 0)),
      };
    } catch {
      this.bankCoins = 0;
      this.starterUpgrades = {
        starterHealth: 0,
        starterDamage: 0,
        starterArmor: 0,
        starterReload: 0,
        starterChargePower: 0,
        starterChargeRange: 0,
      };
    }
  }

  private saveMetaProgress() {
    window.localStorage.setItem(
      'iron-plains-assault-progress',
      JSON.stringify({
        coins: this.bankCoins,
        starterUpgrades: this.starterUpgrades,
      }),
    );
  }

  private getStoreUpgradeCost(upgrade: StoreUpgradeId) {
    const level = this.starterUpgrades[upgrade];
    switch (upgrade) {
      case 'starterHealth':
        return 3 + level * 2;
      case 'starterDamage':
        return 5 + level * 3;
      case 'starterArmor':
        return 4 + level * 3;
      case 'starterReload':
        return 4 + level * 2;
      case 'starterChargePower':
        return 6 + level * 3;
      case 'starterChargeRange':
        return 6 + level * 3;
    }
  }

  private applyStarterLoadout() {
    this.playerMaxHealth = 100 + this.starterUpgrades.starterHealth * 20;
    this.playerHealth = this.playerMaxHealth;
    this.playerDamage = 1 + this.starterUpgrades.starterDamage;
    this.armorFactor = Math.max(0.55, 1 - this.starterUpgrades.starterArmor * 0.1);
    this.shootInterval = Math.max(0.22, this.baseTankShootInterval * Math.pow(0.9, this.starterUpgrades.starterReload));
    this.chargeDamageBonus = this.starterUpgrades.starterChargePower * 0.55;
    this.chargeRangeBonus = this.starterUpgrades.starterChargeRange * 0.4;
  }

  private updateStoreUi() {
    this.bankCoinsValue.textContent = String(this.bankCoins);

    for (const button of this.storeButtons) {
      const upgrade = button.dataset.storeUpgrade;
      const level = this.starterUpgrades[upgrade];
      const cost = this.getStoreUpgradeCost(upgrade);
      const levelElement = button.querySelector<HTMLElement>('.shop-card__level');
      const costElement = button.querySelector<HTMLElement>('.shop-card__cost');
      if (levelElement) {
        levelElement.textContent = `Level ${level}`;
      }
      if (costElement) {
        costElement.textContent = `${cost} coins`;
      }
      button.disabled = this.bankCoins < cost;
    }
  }

  private startChargingShot() {
    if (this.state !== 'playing' || document.pointerLockElement !== this.canvas || this.isChargingShot) {
      return;
    }

    this.isChargingShot = true;
    this.chargeStartedAt = performance.now() / 1000;
    this.chargeAmount = 0;
    this.chargeMeter.classList.add('is-visible');
  }

  private updateCharge(_delta: number) {
    if (!this.isChargingShot) {
      this.chargeMeter.classList.toggle('is-visible', this.state === 'playing' && this.chargeAmount > 0.01);
      this.chargeMeterFill.style.width = `${Math.round(this.chargeAmount * 100)}%`;
      this.chargeMeterText.textContent = `Charge ${Math.round(this.chargeAmount * 100)}%`;
      return;
    }

    const elapsed = performance.now() / 1000 - this.chargeStartedAt;
    this.chargeAmount = THREE.MathUtils.clamp(elapsed / 1.4, 0.12, 1);
    this.chargeMeter.classList.add('is-visible');
    this.chargeMeterFill.style.width = `${Math.round(this.chargeAmount * 100)}%`;
    this.chargeMeterText.textContent = this.chargeAmount >= 0.99 ? 'Power Shot Ready' : `Charge ${Math.round(this.chargeAmount * 100)}%`;
    this.statusPill.textContent = this.chargeAmount >= 0.99 ? 'Power shot fully charged // release to fire' : `Charging ${Math.round(this.chargeAmount * 100)}% // release to fire`;
  }

  private getShiftModeLabel(mode = this.shiftMode) {
    return mode === 'strike' ? 'Strike' : 'Wave';
  }

  private getPlayingStatusText() {
    if (this.shiftReady) {
      return `${this.getShiftModeLabel()} ready // Tab switch // Shift use ability`;
    }

    if (this.currentWave % 10 === 0) {
      return `Wave ${this.currentWave} BOSS // fortress tank: radial cannons, rear ramps, infantry doors`;
    }

    return `Wave ${this.currentWave} // ${this.getShiftModeLabel()} selected // hold LMB to charge`;
  }

  private consumeShiftCharge() {
    this.shiftReady = false;
    this.shiftKills = 0;
  }

  private toggleShiftMode() {
    const nextMode: ShiftMode = this.shiftMode === 'strike' ? 'wave' : 'strike';

    if (this.targetingMode) {
      this.cancelTargetingMode(false);
    }

    this.shiftMode = nextMode;
    if (this.state === 'playing') {
      this.statusPill.textContent = this.shiftReady
        ? `${this.getShiftModeLabel()} ready // Shift use ability`
        : `${this.getShiftModeLabel()} selected // ${this.shiftKills}/${this.shiftKillsRequired} kills charged`;
    }
  }

  private cancelCharge() {
    this.isChargingShot = false;
    this.chargeAmount = 0;
    this.chargeMeter.classList.remove('is-visible');
    this.chargeMeterFill.style.width = '0%';
    this.chargeMeterText.textContent = 'Charge 0%';
    if (this.state === 'playing' && !this.targetingMode) {
      this.statusPill.textContent = this.getPlayingStatusText();
    }
  }

  private activateTargetingMode() {
    if (!this.shiftReady || this.targetingMode || this.state !== 'playing') {
      return;
    }

    this.cancelCharge();
    this.targetingMode = true;
    this.crosshair.classList.remove('is-visible');
    this.targetDot.classList.add('is-visible');
    this.statusPill.textContent = 'Strike active // move red dot and left click';
    this.targetDotX = window.innerWidth / 2;
    this.targetDotY = window.innerHeight / 2;
    this.updateTargetDotUi();

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  private cancelTargetingMode(relock: boolean) {
    this.targetingMode = false;
    this.targetDot.classList.remove('is-visible');
    if (this.state === 'playing') {
      this.crosshair.classList.add('is-visible');
      this.statusPill.textContent = this.getPlayingStatusText();
      if (relock) {
        void this.canvas.requestPointerLock();
      }
    }
  }

  private updateTargetDotUi() {
    this.targetDot.style.left = `${this.targetDotX}px`;
    this.targetDot.style.top = `${this.targetDotY}px`;
  }

  private fireShiftStrike() {
    if (!this.targetingMode || !this.shiftReady) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((this.targetDotX - rect.left) / rect.width) * 2 - 1,
      -(((this.targetDotY - rect.top) / rect.height) * 2 - 1),
    );

    this.screenRaycaster.setFromCamera(ndc, this.camera);
    const intersections = this.screenRaycaster.intersectObjects(this.enemies.map((enemy) => enemy.root), true);
    const enemy = intersections.length > 0 ? this.findEnemyFromObject(intersections[0].object) : undefined;

    if (!enemy) {
      this.statusPill.textContent = 'No target under red dot';
      return;
    }

    const impactPoint = intersections[0]?.point?.clone() ?? enemy.root.position.clone();
    this.killEnemy(enemy, impactPoint, false);
    this.showExplosion(impactPoint, Math.max(4.2, this.getEnemyHitRadius(enemy) + 2.4), 0xff4b4b);
    this.audio.impact();
    this.consumeShiftCharge();
    this.cancelTargetingMode(true);
  }

  private fireShiftWave() {
    if (!this.shiftReady || this.state !== 'playing') {
      return;
    }

    this.cancelCharge();

    const center = this.playerPosition.clone().add(new THREE.Vector3(0, 0.9, 0));
    const waveRadius = 16;
    const victims = this.enemies.filter((enemy) => {
      const targetPoint = enemy.root.position.clone().add(new THREE.Vector3(0, this.getEnemyAimOffset(enemy), 0));
      return targetPoint.distanceTo(center) <= waveRadius + this.getEnemyHitRadius(enemy) * 0.4;
    });

    this.showExplosion(center, waveRadius, 0xff5959);
    this.createBurst(center.clone(), 0xff9d72, 0.9);
    this.audio.impact();
    this.audio.waveClear();

    if (victims.length === 0) {
      this.statusPill.textContent = 'Wave blast spent // no targets in range';
      this.consumeShiftCharge();
      return;
    }

    for (const enemy of [...victims]) {
      const impactPoint = enemy.root.position.clone().add(new THREE.Vector3(0, this.getEnemyAimOffset(enemy), 0));
      this.killEnemy(enemy, impactPoint, false);
      this.createBurst(impactPoint, 0xff6e6e, enemy.kind === 'boss' ? 0.9 : enemy.kind === 'infantry' ? 0.25 : 0.45);
    }

    this.consumeShiftCharge();
    this.statusPill.textContent = `Wave blast fired // destroyed ${victims.length} target${victims.length === 1 ? '' : 's'}`;
  }

  private findEnemyFromObject(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current && current.userData.enemyId === undefined) {
      current = current.parent;
    }

    if (!current) {
      return undefined;
    }

    const enemyId = Number(current.userData.enemyId);
    return this.enemies.find((enemy) => enemy.id === enemyId);
  }

  private resetProgress() {
    this.clearEnemies();
    this.clearProjectiles();
    this.clearEffects();
    this.currentWave = 1;
    this.kills = 0;
    this.nextEnemyId = 1;
    this.lastShotAt = 0;
    this.hitMarkerTimer = 0;
    this.damagePulseTimer = 0;
    this.chargeAmount = 0;
    this.isChargingShot = false;
    this.shiftKills = 0;
    this.shiftReady = false;
    this.shiftMode = 'strike';
    this.targetingMode = false;
    this.applyStarterLoadout();
    this.waveJustCleared = false;
    this.cameraModeIndex = 1;
    this.resetPlayerPlacement();
    this.updateStoreUi();
    this.updateHud();
  }

  private startWave(wave: number) {
    this.clearEnemies();
    this.clearProjectiles();
    this.currentWave = wave;
    this.playerHealth = this.playerMaxHealth;
    this.waveJustCleared = false;

    const isBossWave = wave % 10 === 0;
    const tankCount = isBossWave ? 8 + Math.floor(wave / 2) : 2 + wave * 2;
    const droneCount = wave > 5 ? 1 + Math.floor((wave - 6) / 2) : 0;

    for (let index = 0; index < tankCount; index += 1) {
      this.spawnEnemyTank(index, tankCount);
    }

    for (let index = 0; index < droneCount; index += 1) {
      this.spawnDrone(index, droneCount);
    }

    if (isBossWave) {
      this.spawnBossTank();
      this.statusPill.textContent = `Wave ${wave} boss incoming // destroy the fortress tank`;
    }

    this.updateUpgradeOverlay();
    this.updateHud();
  }

  private spawnEnemyTank(index: number, count: number) {
    const angle = (index / count) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.28);
    const radius = 42 + (index % 3) * 6 + Math.random() * 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    this.spawnEnemyTankAt(new THREE.Vector3(x, this.getTankHeight(x, z), z), angle + Math.PI);
  }

  private spawnEnemyTankAt(position: THREE.Vector3, yaw: number, reinforcement = false) {
    const visual = this.createTankVisual({ hull: reinforcement ? 0x76533b : 0x6f4c34, turret: reinforcement ? 0x9a6b4f : 0x8f6346, accent: 0xf0c487 });
    const x = THREE.MathUtils.clamp(position.x, -this.worldHalfSize, this.worldHalfSize);
    const z = THREE.MathUtils.clamp(position.z, -this.worldHalfSize, this.worldHalfSize);
    visual.root.position.set(x, this.getTankHeight(x, z), z);
    visual.root.rotation.y = yaw;
    this.scene.add(visual.root);

    const id = this.nextEnemyId++;
    visual.root.userData.enemyId = id;

    this.enemies.push({
      id,
      kind: 'tank',
      root: visual.root,
      turretPivot: visual.turretPivot,
      gunPivot: visual.gunPivot,
      muzzle: visual.muzzle,
      speed: (reinforcement ? 6.6 : 5.2) + Math.min(this.currentWave * 0.35, 2.6),
      health: 2 + Math.floor((this.currentWave - 1) / 4),
      fireCooldown: reinforcement ? 0.9 + Math.random() * 0.35 : 1.2 + Math.random() * 0.65,
      desiredRange: reinforcement ? 14 + Math.random() * 4 : 18 + Math.random() * 5,
      turnSpeed: 1.25 + Math.random() * 0.45,
      bobOffset: Math.random() * Math.PI * 2,
      orbitDirection: Math.random() > 0.5 ? 1 : -1,
      altitude: 0,
      flashTime: 0,
    });
  }

  private spawnDrone(index: number, count: number) {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 + Math.random() * 0.6;
    const radius = 28 + index * 4 + Math.random() * 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const root = this.createDroneVisual();
    root.position.set(x, 13 + Math.random() * 4, z);
    root.userData.enemyId = this.nextEnemyId;
    this.scene.add(root);

    root.scale.setScalar(1.45);

    this.enemies.push({
      id: this.nextEnemyId++,
      kind: 'drone',
      root,
      speed: 9.2 + Math.min(this.currentWave * 0.24, 3),
      health: 3 + Math.floor((this.currentWave - 6) / 3),
      fireCooldown: 0.82 + Math.random() * 0.45,
      desiredRange: 28 + Math.random() * 10,
      turnSpeed: 1.9,
      bobOffset: Math.random() * Math.PI * 2,
      orbitDirection: Math.random() > 0.5 ? 1 : -1,
      altitude: 14 + Math.random() * 6,
      flashTime: 0,
    });
  }

  private spawnBossTank() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 54;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const visual = this.createBossTankVisual();
    visual.root.position.set(x, this.getTankHeight(x, z) + 0.22, z);
    visual.root.rotation.y = angle + Math.PI;
    this.scene.add(visual.root);

    const id = this.nextEnemyId++;
    visual.root.userData.enemyId = id;

    this.enemies.push({
      id,
      kind: 'boss',
      root: visual.root,
      turretPivot: visual.turretPivot,
      gunPivot: visual.gunPivot,
      muzzle: visual.muzzle,
      radialMuzzles: visual.radialMuzzles,
      sideDoors: visual.sideDoors,
      rearDoor: visual.rearDoor,
      speed: 2.35 + Math.min(this.currentWave * 0.08, 1.4),
      health: 56 + this.currentWave * 6,
      fireCooldown: 1.5,
      desiredRange: 30,
      turnSpeed: 0.72,
      bobOffset: Math.random() * Math.PI * 2,
      orbitDirection: 1,
      altitude: 0,
      flashTime: 0,
      spawnCooldown: 4.2,
      spawnCount: 0,
      infantryCooldown: 2.2,
      infantryCount: 0,
    });
  }

  private spawnInfantry(position: THREE.Vector3, yaw: number) {
    const root = this.createInfantryVisual();
    const x = THREE.MathUtils.clamp(position.x, -this.worldHalfSize, this.worldHalfSize);
    const z = THREE.MathUtils.clamp(position.z, -this.worldHalfSize, this.worldHalfSize);
    root.position.set(x, this.getTerrainHeight(x, z), z);
    root.rotation.y = yaw;
    this.scene.add(root);

    const id = this.nextEnemyId++;
    root.userData.enemyId = id;

    this.enemies.push({
      id,
      kind: 'infantry',
      root,
      muzzle: root.userData.muzzle as THREE.Object3D,
      speed: 7.2 + Math.min(this.currentWave * 0.1, 2.2),
      health: 1.15 + Math.floor(this.currentWave / 10) * 0.5,
      fireCooldown: 0.7 + Math.random() * 0.65,
      desiredRange: 6,
      turnSpeed: 3.4,
      bobOffset: Math.random() * Math.PI * 2,
      orbitDirection: Math.random() > 0.5 ? 1 : -1,
      altitude: 0,
      flashTime: 0,
      contactCooldown: 0,
    });
  }

  private setState(nextState: GameState) {
    this.state = nextState;
    document.body.dataset.state = nextState;

    this.menuOverlay.classList.toggle('overlay--visible', nextState === 'menu');
    this.scrollToPlayButton.classList.toggle('is-visible', nextState === 'menu');
    this.pausedOverlay.classList.toggle('overlay--visible', nextState === 'paused');
    this.upgradeOverlay.classList.toggle('overlay--visible', nextState === 'upgrade');
    this.gameoverOverlay.classList.toggle('overlay--visible', nextState === 'gameover');
    this.crosshair.classList.toggle('is-visible', nextState === 'playing' && !this.targetingMode);
    this.targetDot.classList.toggle('is-visible', nextState === 'playing' && this.targetingMode);
    this.statusPill.classList.toggle('is-live', nextState === 'playing');

    if (nextState === 'menu') {
      this.updateStoreUi();
      this.statusPill.textContent = 'Spend coins in the hangar, then click start';
    } else if (nextState === 'playing') {
      this.statusPill.textContent = this.getPlayingStatusText();
    } else if (nextState === 'paused') {
      this.cancelCharge();
      this.cancelTargetingMode(false);
      this.statusPill.textContent = 'Paused // click resume to relock view';
    } else if (nextState === 'upgrade') {
      this.cancelCharge();
      this.cancelTargetingMode(false);
      this.statusPill.textContent = 'Wave clear // choose one upgrade';
    } else {
      this.cancelCharge();
      this.cancelTargetingMode(false);
      this.statusPill.textContent = 'Tank destroyed';
    }
  }

  private animate = () => {
    if (this.destroyed) {
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.updatePlayer(delta);
      this.updateCharge(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
      if (this.enemies.length === 0 && !this.waveJustCleared) {
        this.handleWaveCleared();
      }
    } else {
      this.updateProjectiles(delta);
    }

    this.updateEffects(delta);
    this.updateFeedback(delta);
    this.updateCamera();
    this.updatePlayerVisuals();
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private updatePlayer(delta: number) {
    const moveForward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const moveRight = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const moveVertical = (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);

    const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, -Math.cos(this.aimYaw));
    const right = new THREE.Vector3(Math.cos(this.aimYaw), 0, Math.sin(this.aimYaw));
    const targetVelocity = new THREE.Vector3()
      .addScaledVector(forward, moveForward * 14)
      .addScaledVector(right, moveRight * 14);

    if (targetVelocity.lengthSq() > 14 * 14) {
      targetVelocity.normalize().multiplyScalar(14);
    }

    this.playerVelocity.set(targetVelocity.x, moveVertical * 10, targetVelocity.z);
    this.playerYaw = this.aimYaw;

    const nextX = THREE.MathUtils.clamp(this.playerPosition.x + this.playerVelocity.x * delta, -this.worldHalfSize, this.worldHalfSize);
    if (!this.collidesWithObstacle(nextX, this.playerPosition.z, this.playerRadius)) {
      this.playerPosition.x = nextX;
    }

    const nextZ = THREE.MathUtils.clamp(this.playerPosition.z + this.playerVelocity.z * delta, -this.worldHalfSize, this.worldHalfSize);
    if (!this.collidesWithObstacle(this.playerPosition.x, nextZ, this.playerRadius)) {
      this.playerPosition.z = nextZ;
    }

    const minHeight = this.getTankHeight(this.playerPosition.x, this.playerPosition.z);
    this.playerPosition.y = THREE.MathUtils.clamp(this.playerPosition.y + this.playerVelocity.y * delta, minHeight, minHeight + 28);
  }

  private updatePlayerVisuals() {
    this.playerTank.root.position.copy(this.playerPosition);
    this.playerTank.root.rotation.y = this.playerYaw;

    const aimTarget = this.getCrosshairAimTarget(180);
    const turretLocalTarget = this.playerTank.root.worldToLocal(aimTarget.clone());
    this.playerTank.turretPivot.rotation.y = Math.atan2(turretLocalTarget.x, -turretLocalTarget.z);
    this.playerTank.turretPivot.updateMatrixWorld(true);

    const gunLocalTarget = this.playerTank.turretPivot.worldToLocal(aimTarget.clone());
    this.playerTank.gunPivot.rotation.x = Math.atan2(gunLocalTarget.y, -gunLocalTarget.z);

    const chargeGlow = this.isChargingShot ? this.chargeAmount : 0;
    this.playerTank.muzzle.scale.setScalar(1 + chargeGlow * 0.45);
  }

  private updateCamera() {
    const focus = this.playerPosition.clone().add(new THREE.Vector3(0, 1.5, 0));
    const mode = this.cameraModes[this.cameraModeIndex];
    const horizontalDirection = new THREE.Vector3(Math.sin(this.aimYaw), 0, -Math.cos(this.aimYaw));
    const cameraPosition = focus.clone().sub(horizontalDirection.multiplyScalar(mode.distance));
    cameraPosition.y += mode.height + Math.max(0, this.aimPitch) * 2.4;

    this.camera.position.copy(cameraPosition);
    this.camera.lookAt(this.getVirtualAimTarget(160));
  }

  private getAimDirection() {
    const cosPitch = Math.cos(this.aimPitch);
    return new THREE.Vector3(
      Math.sin(this.aimYaw) * cosPitch,
      Math.sin(this.aimPitch),
      -Math.cos(this.aimYaw) * cosPitch,
    ).normalize();
  }

  private getVirtualAimTarget(distance: number) {
    return this.playerPosition.clone().add(new THREE.Vector3(0, 1.5, 0)).add(this.getAimDirection().multiplyScalar(distance));
  }

  private getCrosshairAimTarget(distance: number) {
    this.screenRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersections = this.screenRaycaster.intersectObjects(
      [...this.enemies.map((enemy) => enemy.root), ...this.blockers],
      true,
    );

    if (intersections.length > 0) {
      return intersections[0].point.clone();
    }

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return this.camera.position.clone().add(direction.multiplyScalar(distance));
  }

  private collidesWithObstacle(x: number, z: number, radius: number) {
    for (const obstacle of this.obstacles) {
      const clampedX = THREE.MathUtils.clamp(x, obstacle.box.min.x, obstacle.box.max.x);
      const clampedZ = THREE.MathUtils.clamp(z, obstacle.box.min.z, obstacle.box.max.z);
      const dx = x - clampedX;
      const dz = z - clampedZ;
      if (dx * dx + dz * dz < radius * radius) {
        return true;
      }
    }
    return false;
  }

  private getEnemyCollisionRadius(enemy: Enemy) {
    if (enemy.kind === 'boss') {
      return 5.2;
    }
    if (enemy.kind === 'infantry') {
      return 0.7;
    }
    if (enemy.kind === 'drone') {
      return 2.4;
    }
    return this.enemyRadius;
  }

  private getEnemyHitRadius(enemy: Enemy) {
    if (enemy.kind === 'boss') {
      return 5.8;
    }
    if (enemy.kind === 'infantry') {
      return 0.75;
    }
    if (enemy.kind === 'drone') {
      return 3.2;
    }
    return 1.9;
  }

  private getEnemyAimOffset(enemy: Enemy) {
    if (enemy.kind === 'boss') {
      return 2.4;
    }
    if (enemy.kind === 'infantry') {
      return 0.8;
    }
    if (enemy.kind === 'drone') {
      return 0;
    }
    return 0.9;
  }

  private getEnemyBurstColor(enemy: Enemy) {
    if (enemy.kind === 'boss') {
      return 0xff6e45;
    }
    if (enemy.kind === 'infantry') {
      return 0xffd27d;
    }
    if (enemy.kind === 'drone') {
      return 0x97efff;
    }
    return 0xffbb7e;
  }

  private getEnemyKillColor(enemy: Enemy) {
    if (enemy.kind === 'boss') {
      return 0xff3f2f;
    }
    if (enemy.kind === 'infantry') {
      return 0xffcf7a;
    }
    if (enemy.kind === 'drone') {
      return 0xc7ffff;
    }
    return 0xff8f4a;
  }

  private updateEnemies(delta: number) {
    const playerFlat = new THREE.Vector3(this.playerPosition.x, 0, this.playerPosition.z);

    for (const enemy of [...this.enemies]) {
      enemy.fireCooldown -= delta;
      enemy.flashTime = Math.max(0, enemy.flashTime - delta);

      if (enemy.kind === 'tank') {
        this.updateEnemyTank(enemy, delta, playerFlat);
      } else if (enemy.kind === 'boss') {
        this.updateBossTank(enemy, delta, playerFlat);
      } else if (enemy.kind === 'infantry') {
        this.updateInfantry(enemy, delta, playerFlat);
      } else {
        this.updateDrone(enemy, delta);
      }
    }

    this.separateGroundEnemies();
  }

  private updateEnemyTank(enemy: Enemy, delta: number, playerFlat: THREE.Vector3) {
    const toPlayer = playerFlat.clone().sub(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z));
    const distance = toPlayer.length();
    const targetYaw = Math.atan2(toPlayer.x, -toPlayer.z);
    enemy.root.rotation.y = this.rotateTowards(enemy.root.rotation.y, targetYaw, enemy.turnSpeed * delta);

    if (enemy.turretPivot && enemy.gunPivot) {
      enemy.turretPivot.rotation.y = this.rotateTowards(enemy.turretPivot.rotation.y, this.wrapAngle(targetYaw - enemy.root.rotation.y), 2.3 * delta);
      enemy.gunPivot.rotation.x = THREE.MathUtils.lerp(enemy.gunPivot.rotation.x, 0.08, delta * 4);
    }

    if (distance > enemy.desiredRange) {
      this.moveGroundEnemy(enemy, enemy.speed * (distance > enemy.desiredRange + 8 ? 1 : 0.65), delta, this.enemyRadius);
    }

    enemy.root.position.y = this.getTankHeight(enemy.root.position.x, enemy.root.position.z);

    if (distance < 48 && enemy.fireCooldown <= 0 && enemy.muzzle) {
      const origin = new THREE.Vector3();
      enemy.muzzle.getWorldPosition(origin);
      const target = this.playerPosition.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (this.hasLineOfSight(origin, target)) {
        const velocity = target.sub(origin).normalize().multiplyScalar(24 + this.currentWave * 0.35);
        this.spawnProjectile('enemy', origin, velocity, 12 + Math.floor(this.currentWave / 3) * 2, 0xf3b56b, 0.28, 5.5);
        enemy.fireCooldown = Math.max(0.72, 2.6 - this.currentWave * 0.08);
      }
    }
  }

  private updateBossTank(enemy: Enemy, delta: number, playerFlat: THREE.Vector3) {
    const toPlayer = playerFlat.clone().sub(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z));
    const distance = toPlayer.length();
    const targetYaw = Math.atan2(toPlayer.x, -toPlayer.z);
    enemy.root.rotation.y = this.rotateTowards(enemy.root.rotation.y, targetYaw, enemy.turnSpeed * delta);

    if (enemy.turretPivot && enemy.gunPivot) {
      enemy.turretPivot.rotation.y = this.rotateTowards(enemy.turretPivot.rotation.y, this.wrapAngle(targetYaw - enemy.root.rotation.y), 1.9 * delta);
      enemy.gunPivot.rotation.x = THREE.MathUtils.lerp(enemy.gunPivot.rotation.x, 0.03, delta * 3);
    }

    if (distance > enemy.desiredRange) {
      this.moveGroundEnemy(enemy, enemy.speed, delta, 4.8);
    }

    enemy.root.position.y = this.getTankHeight(enemy.root.position.x, enemy.root.position.z) + 0.22;

    enemy.spawnCooldown = (enemy.spawnCooldown ?? 0) - delta;
    enemy.infantryCooldown = (enemy.infantryCooldown ?? 0) - delta;

    const doorOpen = (enemy.spawnCooldown ?? 0) < 1.15 || (enemy.infantryCooldown ?? 0) < 0.9;
    if (enemy.rearDoor) {
      enemy.rearDoor.rotation.x = THREE.MathUtils.lerp(enemy.rearDoor.rotation.x, doorOpen ? -1.15 : 0, delta * 6);
    }
    if (enemy.sideDoors) {
      for (let index = 0; index < enemy.sideDoors.length; index += 1) {
        const side = index === 0 ? -1 : 1;
        enemy.sideDoors[index].rotation.z = THREE.MathUtils.lerp(enemy.sideDoors[index].rotation.z, doorOpen ? side * 1.15 : side * 0.08, delta * 6);
      }
    }

    if (enemy.fireCooldown <= 0 && enemy.radialMuzzles) {
      for (const radialMuzzle of enemy.radialMuzzles) {
        const origin = new THREE.Vector3();
        radialMuzzle.getWorldPosition(origin);
        const worldQuaternion = new THREE.Quaternion();
        radialMuzzle.getWorldQuaternion(worldQuaternion);
        const direction = new THREE.Vector3(0, 0.02, -1).applyQuaternion(worldQuaternion).normalize();
        this.spawnProjectile('enemy', origin, direction.multiplyScalar(28 + this.currentWave * 0.25), 18 + Math.floor(this.currentWave / 4) * 2, 0xff6e45, 0.34, 5.8);
      }

      if (enemy.muzzle) {
        const origin = new THREE.Vector3();
        enemy.muzzle.getWorldPosition(origin);
        const target = this.playerPosition.clone().add(new THREE.Vector3(0, 1.4, 0));
        const velocity = target.sub(origin).normalize().multiplyScalar(30 + this.currentWave * 0.3);
        this.spawnProjectile('enemy', origin, velocity, 26 + Math.floor(this.currentWave / 5) * 3, 0xffa156, 0.42, 6.2);
      }

      this.createBurst(enemy.root.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 0xff744f, 0.55);
      this.audio.cannon();
      enemy.fireCooldown = 2.45;
    }

    if ((enemy.spawnCount ?? 0) < 4 + Math.floor(this.currentWave / 20) && (enemy.spawnCooldown ?? 0) <= 0) {
      const forward = new THREE.Vector3(Math.sin(enemy.root.rotation.y), 0, -Math.cos(enemy.root.rotation.y));
      const rear = enemy.root.position.clone().addScaledVector(forward, -7.4);
      rear.x += THREE.MathUtils.randFloatSpread(2.4);
      rear.z += THREE.MathUtils.randFloatSpread(2.4);
      this.spawnEnemyTankAt(rear, enemy.root.rotation.y + Math.PI + THREE.MathUtils.randFloatSpread(0.3), true);
      this.createBurst(rear.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffb36d, 0.48);
      enemy.spawnCount = (enemy.spawnCount ?? 0) + 1;
      enemy.spawnCooldown = 5.8;
      this.statusPill.textContent = 'Fortress rear ramp open // reinforcement tank deployed';
    }

    if ((enemy.infantryCount ?? 0) < 8 + Math.floor(this.currentWave / 10) * 2 && (enemy.infantryCooldown ?? 0) <= 0) {
      const side = (enemy.infantryCount ?? 0) % 2 === 0 ? -1 : 1;
      const sideDirection = new THREE.Vector3(Math.cos(enemy.root.rotation.y), 0, Math.sin(enemy.root.rotation.y)).multiplyScalar(side);
      const spawnPoint = enemy.root.position.clone().addScaledVector(sideDirection, 5.6);
      spawnPoint.addScaledVector(new THREE.Vector3(Math.sin(enemy.root.rotation.y), 0, -Math.cos(enemy.root.rotation.y)), THREE.MathUtils.randFloat(-1.5, 2.2));
      this.spawnInfantry(spawnPoint, targetYaw);
      this.createBurst(spawnPoint.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xffcf7a, 0.25);
      enemy.infantryCount = (enemy.infantryCount ?? 0) + 1;
      enemy.infantryCooldown = 2.4;
      this.statusPill.textContent = 'Side doors open // infantry boarding party incoming';
    }
  }

  private updateInfantry(enemy: Enemy, delta: number, playerFlat: THREE.Vector3) {
    const toPlayer = playerFlat.clone().sub(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z));
    const distance = toPlayer.length();
    const targetYaw = Math.atan2(toPlayer.x, -toPlayer.z);
    enemy.root.rotation.y = this.rotateTowards(enemy.root.rotation.y, targetYaw, enemy.turnSpeed * delta);
    enemy.contactCooldown = Math.max(0, (enemy.contactCooldown ?? 0) - delta);

    if (distance > 2.1) {
      this.moveGroundEnemy(enemy, enemy.speed, delta, 0.55);
    } else if ((enemy.contactCooldown ?? 0) <= 0) {
      this.damagePlayer(7 + Math.floor(this.currentWave / 5));
      this.createBurst(this.playerPosition.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xffcf7a, 0.22);
      enemy.contactCooldown = 0.78;
    }

    enemy.root.position.y = this.getTerrainHeight(enemy.root.position.x, enemy.root.position.z);
    enemy.root.position.y += Math.abs(Math.sin(this.clock.elapsedTime * 9 + enemy.bobOffset)) * 0.08;

    if (distance < 28 && enemy.fireCooldown <= 0 && enemy.muzzle) {
      const origin = new THREE.Vector3();
      enemy.muzzle.getWorldPosition(origin);
      const target = this.playerPosition.clone().add(new THREE.Vector3(0, 1.0, 0));
      if (this.hasLineOfSight(origin, target)) {
        const velocity = target.sub(origin).normalize().multiplyScalar(31);
        this.spawnProjectile('enemy', origin, velocity, 5 + Math.floor(this.currentWave / 8), 0xffd27d, 0.12, 2.6);
        enemy.fireCooldown = 1.15 + Math.random() * 0.6;
      }
    }
  }

  private updateDrone(enemy: Enemy, delta: number) {
    const orbitAngle = this.clock.elapsedTime * 0.48 * enemy.orbitDirection + enemy.bobOffset;
    const desiredPosition = this.playerPosition.clone().add(
      new THREE.Vector3(
        Math.cos(orbitAngle) * enemy.desiredRange,
        enemy.altitude + Math.sin(this.clock.elapsedTime * 1.6 + enemy.bobOffset) * 1.2,
        Math.sin(orbitAngle) * enemy.desiredRange,
      ),
    );

    enemy.root.position.lerp(desiredPosition, Math.min(1, delta * 1.35));
    enemy.root.lookAt(this.playerPosition.x, this.playerPosition.y + 1.2, this.playerPosition.z);

    const distance = enemy.root.position.distanceTo(this.playerPosition);
    if (distance < 52 && enemy.fireCooldown <= 0) {
      const origin = enemy.root.position.clone();
      const target = this.playerPosition.clone().add(new THREE.Vector3(0, 0.8, 0));
      const velocity = target.sub(origin).normalize().multiplyScalar(24 + this.currentWave * 0.35);
      this.spawnProjectile('enemy', origin, velocity, 20 + Math.floor((this.currentWave - 5) / 2) * 2, 0xffc970, 0.3, 5.8);
      this.audio.drone();
      enemy.fireCooldown = Math.max(0.45, 1.35 - this.currentWave * 0.035);
    }
  }

  private moveGroundEnemy(enemy: Enemy, speed: number, delta: number, radius: number) {
    const forward = new THREE.Vector3(Math.sin(enemy.root.rotation.y), 0, -Math.cos(enemy.root.rotation.y));
    const nextX = THREE.MathUtils.clamp(enemy.root.position.x + forward.x * speed * delta, -this.worldHalfSize, this.worldHalfSize);
    if (!this.collidesWithObstacle(nextX, enemy.root.position.z, radius)) {
      enemy.root.position.x = nextX;
    }
    const nextZ = THREE.MathUtils.clamp(enemy.root.position.z + forward.z * speed * delta, -this.worldHalfSize, this.worldHalfSize);
    if (!this.collidesWithObstacle(enemy.root.position.x, nextZ, radius)) {
      enemy.root.position.z = nextZ;
    }
  }

  private separateGroundEnemies() {
    for (let index = 0; index < this.enemies.length; index += 1) {
      const current = this.enemies[index];
      if (current.kind === 'drone') {
        continue;
      }
      const currentRadius = this.getEnemyCollisionRadius(current);
      for (let otherIndex = index + 1; otherIndex < this.enemies.length; otherIndex += 1) {
        const other = this.enemies[otherIndex];
        if (other.kind === 'drone') {
          continue;
        }
        const minimumDistance = currentRadius + this.getEnemyCollisionRadius(other);
        const offset = current.root.position.clone().sub(other.root.position);
        offset.y = 0;
        const distance = offset.length();
        if (distance > 0 && distance < minimumDistance) {
          offset.normalize().multiplyScalar((minimumDistance - distance) * 0.5);
          current.root.position.add(offset);
          other.root.position.sub(offset);
        }
      }
    }
  }

  private hasLineOfSight(origin: THREE.Vector3, target: THREE.Vector3) {
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    if (distance <= 0.001) {
      return true;
    }

    this.blockerRaycaster.set(origin, direction.normalize());
    this.blockerRaycaster.far = distance - 0.5;
    return this.blockerRaycaster.intersectObjects(this.blockers, true).length === 0;
  }

  private releaseChargedShot() {
    if (!this.isChargingShot) {
      return;
    }

    const now = performance.now() / 1000;
    const charge = Math.max(0.12, this.chargeAmount || THREE.MathUtils.clamp(now - this.chargeStartedAt, 0.12, 1.4) / 1.4);
    this.cancelCharge();

    if (now - this.lastShotAt < this.shootInterval) {
      return;
    }

    if (this.state !== 'playing' || document.pointerLockElement !== this.canvas) {
      return;
    }

    this.lastShotAt = now;
    this.audio.cannon();

    this.updateCamera();
    this.updatePlayerVisuals();

    const muzzle = new THREE.Vector3();
    this.playerTank.muzzle.getWorldPosition(muzzle);
    const aimTarget = this.getCrosshairAimTarget(180);
    const shellRadius = 0.2 + charge * 0.16;
    const shellSpeed = 44 + charge * 22;
    const damage = this.playerDamage + charge * (3.2 + this.chargeDamageBonus * 1.8);
    const explosionRadius = 1.8 + charge * (2 + this.chargeRangeBonus);
    const explosionPower = 1 + charge * (1.8 + this.chargeDamageBonus);
    const velocity = aimTarget.sub(muzzle).normalize().multiplyScalar(shellSpeed);

    this.spawnProjectile('player', muzzle, velocity, damage, 0xffeb57, shellRadius, 4.4 + charge * 1.4, explosionRadius, explosionPower);
    this.createBurst(muzzle.clone(), 0xffdf74, 0.16 + charge * 0.14);
  }

  private damageEnemy(enemy: Enemy, amount: number, point: THREE.Vector3) {
    enemy.health -= amount;
    enemy.flashTime = 0.12;
    this.audio.hit();
    this.showHitMarker();
    this.createBurst(point, this.getEnemyBurstColor(enemy), enemy.kind === 'boss' ? 0.42 : enemy.kind === 'infantry' ? 0.16 : 0.26);

    if (enemy.health <= 0) {
      this.killEnemy(enemy, point);
    }
  }

  private killEnemy(enemy: Enemy, point: THREE.Vector3, awardShiftCharge = true) {
    this.kills += 1;
    this.bankCoins += enemy.kind === 'boss' ? 12 : 1;
    if (awardShiftCharge && !this.shiftReady) {
      this.shiftKills = Math.min(this.shiftKillsRequired, this.shiftKills + 1);
      if (this.shiftKills >= this.shiftKillsRequired) {
        this.shiftReady = true;
        if (this.state === 'playing' && !this.targetingMode) {
          this.statusPill.textContent = `${this.getShiftModeLabel()} ready // Tab switch // Shift use ability`;
        }
      }
    }
    this.saveMetaProgress();
    const index = this.enemies.findIndex((entry) => entry.id === enemy.id);
    if (index >= 0) {
      this.enemies.splice(index, 1);
    }
    this.scene.remove(enemy.root);
    this.disposeGroup(enemy.root);
    this.audio.kill();
    this.createBurst(point, this.getEnemyKillColor(enemy), enemy.kind === 'boss' ? 1.1 : enemy.kind === 'drone' ? 0.42 : enemy.kind === 'infantry' ? 0.24 : 0.34);
    if (enemy.kind === 'boss') {
      this.showExplosion(point, 9.5, 0xff6e45);
      this.statusPill.textContent = 'Fortress tank destroyed // finish off remaining forces';
    }
  }

  private spawnProjectile(
    owner: 'player' | 'enemy',
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    damage: number,
    color: number,
    radius: number,
    life: number,
    explosionRadius?: number,
    explosionPower?: number,
  ) {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshBasicMaterial({ color }),
    );
    shell.position.copy(origin);
    this.scene.add(shell);

    this.projectiles.push({
      mesh: shell,
      owner,
      velocity,
      damage,
      life,
      color,
      radius,
      explosionRadius,
      explosionPower,
    });
  }

  private updateProjectiles(delta: number) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= delta;
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);

      if (projectile.owner === 'enemy') {
        const distanceToPlayer = projectile.mesh.position.distanceTo(this.playerPosition.clone().add(new THREE.Vector3(0, 0.8, 0)));
        if (this.state === 'playing' && distanceToPlayer < this.playerRadius + projectile.radius) {
          this.damagePlayer(projectile.damage);
          this.createBurst(projectile.mesh.position.clone(), projectile.color, 0.35);
          this.destroyProjectile(index);
          continue;
        }
      } else {
        let hitEnemy = false;
        for (const enemy of this.enemies) {
          const hitRadius = this.getEnemyHitRadius(enemy);
          const targetPoint = enemy.root.position.clone().add(new THREE.Vector3(0, this.getEnemyAimOffset(enemy), 0));
          if (projectile.mesh.position.distanceTo(targetPoint) < hitRadius + projectile.radius) {
            this.explodePlayerProjectile(projectile, projectile.mesh.position.clone());
            this.destroyProjectile(index);
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) {
          continue;
        }
      }

      if (projectile.mesh.position.y <= this.getTerrainHeight(projectile.mesh.position.x, projectile.mesh.position.z) + 0.2) {
        if (projectile.owner === 'player') {
          this.explodePlayerProjectile(projectile, projectile.mesh.position.clone());
        } else {
          this.createBurst(projectile.mesh.position.clone(), projectile.color, 0.28);
        }
        this.destroyProjectile(index);
        continue;
      }

      let blocked = false;
      for (const obstacle of this.obstacles) {
        if (obstacle.box.containsPoint(projectile.mesh.position)) {
          blocked = true;
          break;
        }
      }
      if (blocked || projectile.life <= 0) {
        if (projectile.owner === 'player') {
          this.explodePlayerProjectile(projectile, projectile.mesh.position.clone());
        } else {
          this.createBurst(projectile.mesh.position.clone(), projectile.color, 0.28);
        }
        this.destroyProjectile(index);
      }
    }
  }

  private explodePlayerProjectile(projectile: Projectile, position: THREE.Vector3) {
    const explosionRadius = projectile.explosionRadius ?? 1.8;
    const explosionPower = projectile.explosionPower ?? 1;
    this.audio.impact();

    for (const enemy of [...this.enemies]) {
      const targetPoint = enemy.root.position.clone().add(new THREE.Vector3(0, this.getEnemyAimOffset(enemy), 0));
      const distance = targetPoint.distanceTo(position);
      if (distance > explosionRadius + this.getEnemyHitRadius(enemy) * 0.65) {
        continue;
      }

      const falloff = 1 - THREE.MathUtils.clamp(distance / (explosionRadius + 1.2), 0, 1);
      const splashDamage = Math.max(0.45, projectile.damage * explosionPower * (0.5 + falloff * 0.75));
      this.damageEnemy(enemy, splashDamage, targetPoint.clone().lerp(position, 0.35));
    }

    this.showExplosion(position, explosionRadius, projectile.color);
  }

  private destroyProjectile(index: number) {
    const projectile = this.projectiles[index];
    this.scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    const material = projectile.mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        entry.dispose();
      }
    } else {
      material.dispose();
    }
    this.projectiles.splice(index, 1);
  }

  private damagePlayer(amount: number) {
    if (this.state !== 'playing') {
      return;
    }

    const adjustedDamage = Math.max(1, Math.round(amount * this.armorFactor));
    this.playerHealth = Math.max(0, this.playerHealth - adjustedDamage);
    this.damagePulseTimer = 0.32;
    this.audio.damage();

    if (this.playerHealth <= 0) {
      this.finalScoreText.textContent = `You reached wave ${this.currentWave}, destroyed ${this.kills} targets, and now have ${this.bankCoins} coins.`;
      this.setState('gameover');
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    }
  }

  private handleWaveCleared() {
    this.waveJustCleared = true;
    this.playerHealth = this.playerMaxHealth;
    this.clearProjectiles();
    this.audio.waveClear();
    this.updateUpgradeOverlay();
    this.setState('upgrade');
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  private applyUpgrade(upgrade: UpgradeId) {
    if (upgrade === 'health') {
      this.playerMaxHealth += 25;
      this.playerHealth = this.playerMaxHealth;
      return;
    }

    if (upgrade === 'damage') {
      this.playerDamage += 1;
      this.playerHealth = this.playerMaxHealth;
      return;
    }

    if (upgrade === 'armor') {
      this.armorFactor = Math.max(0.55, this.armorFactor * 0.86);
      this.playerHealth = this.playerMaxHealth;
      return;
    }

    if (upgrade === 'reload') {
      this.shootInterval = Math.max(0.24, this.shootInterval * 0.88);
      this.playerHealth = this.playerMaxHealth;
      return;
    }

    if (upgrade === 'chargePower') {
      this.chargeDamageBonus += 0.8;
      this.playerHealth = this.playerMaxHealth;
      return;
    }

    this.chargeRangeBonus += 0.45;
    this.playerHealth = this.playerMaxHealth;
  }

  private updateUpgradeOverlay() {
    this.upgradeTitle.textContent = `Wave ${this.currentWave} Cleared`;
    this.upgradeSubtitle.textContent = `Armor restored to full. Choose one upgrade before wave ${this.currentWave + 1}. Heavy attack planes appear after wave 5, and every 10th wave deploys a fortress tank with radial cannons, rear tank ramps, and infantry doors.`;
  }

  private showHitMarker() {
    this.hitMarkerTimer = 0.12;
    this.hitMarker.classList.add('is-active');
  }

  private createBurst(position: THREE.Vector3, color: number, size: number) {
    const geometry = new THREE.SphereGeometry(size, 14, 14);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
    const burst = new THREE.Mesh(geometry, material);
    burst.position.copy(position);
    this.scene.add(burst);

    this.effects.push({
      mesh: burst,
      life: 0.18,
      maxLife: 0.18,
      update: (progress) => {
        burst.scale.setScalar(1 + progress * 3.1);
        material.opacity = 0.92 * (1 - progress);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  private showExplosion(position: THREE.Vector3, radius: number, color: number) {
    const ringGeometry = new THREE.RingGeometry(radius * 0.35, radius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const sphereGeometry = new THREE.SphereGeometry(radius * 0.42, 20, 20);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffd48c, transparent: true, opacity: 0.34 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    this.scene.add(sphere);

    this.effects.push(
      {
        mesh: ring,
        life: 0.24,
        maxLife: 0.24,
        update: (progress) => {
          ring.scale.setScalar(1 + progress * 1.8);
          ringMaterial.opacity = 0.72 * (1 - progress);
        },
        dispose: () => {
          ringGeometry.dispose();
          ringMaterial.dispose();
        },
      },
      {
        mesh: sphere,
        life: 0.2,
        maxLife: 0.2,
        update: (progress) => {
          sphere.scale.setScalar(1 + progress * 2.4);
          sphereMaterial.opacity = 0.34 * (1 - progress);
        },
        dispose: () => {
          sphereGeometry.dispose();
          sphereMaterial.dispose();
        },
      },
    );
  }

  private updateEffects(delta: number) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.life -= delta;
      effect.update(1 - Math.max(effect.life, 0) / effect.maxLife);
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.dispose();
        this.effects.splice(index, 1);
      }
    }
  }

  private updateFeedback(delta: number) {
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - delta);
    this.damagePulseTimer = Math.max(0, this.damagePulseTimer - delta);

    if (this.hitMarkerTimer <= 0) {
      this.hitMarker.classList.remove('is-active');
    }

    if (this.damagePulseTimer > 0) {
      const glow = 0.18 + this.damagePulseTimer * 0.5;
      this.statusPill.style.boxShadow = `0 14px 34px rgba(0, 0, 0, 0.22), 0 0 28px rgba(227, 95, 70, ${glow})`;
    } else if (this.state === 'playing') {
      this.statusPill.style.boxShadow = '0 14px 34px rgba(0, 0, 0, 0.22), 0 0 22px rgba(209, 228, 132, 0.12)';
    } else {
      this.statusPill.style.boxShadow = '0 14px 34px rgba(0, 0, 0, 0.22)';
    }
  }

  private updateHud() {
    this.healthValue.textContent = String(this.playerHealth);
    this.healthBarFill.style.width = `${(this.playerHealth / this.playerMaxHealth) * 100}%`;
    this.waveValue.textContent = String(this.currentWave);
    this.enemyCountValue.textContent = String(this.enemies.length);
    this.killsValue.textContent = String(this.kills);
    this.coinValue.textContent = String(this.bankCoins);
    this.shiftValue.textContent = this.shiftReady
      ? `${this.getShiftModeLabel()} • Ready`
      : `${this.getShiftModeLabel()} • ${this.shiftKills} / ${this.shiftKillsRequired}`;
    this.shiftBarFill.style.width = `${(this.shiftReady ? 1 : this.shiftKills / this.shiftKillsRequired) * 100}%`;
  }

  private clearEnemies() {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.root);
      this.disposeGroup(enemy.root);
    }
    this.enemies.length = 0;
  }

  private clearProjectiles() {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      this.destroyProjectile(index);
    }
  }

  private clearEffects() {
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      effect.dispose();
    }
    this.effects.length = 0;
  }

  private rotateTowards(current: number, target: number, maxDelta: number) {
    const delta = this.wrapAngle(target - current);
    if (Math.abs(delta) <= maxDelta) {
      return target;
    }
    return current + Math.sign(delta) * maxDelta;
  }

  private wrapAngle(angle: number) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  private disposeGroup(group: THREE.Object3D) {
    group.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose();
        }
      } else if (material) {
        material.dispose();
      }
    });
  }
}

