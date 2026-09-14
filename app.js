import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;

let layerMeshes = {};
let glowMeshes = {};

const commonPosition = new THREE.Vector3(-0.02, 0, 0.02);

// =====================================================
// ESTADO DEL FRENTE / REVERSO
// =====================================================

let isBack = false;
let flipActive = false;
let flipProgress = 0;

let frontGroup = null;
let backGroup = null;
let magicFlip = null;
let flipButton = null;

// =====================================================
// UTILIDADES
// =====================================================

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  value = clamp01(value);
  return 1 - Math.pow(1 - value, 3);
}

function easeInOut(value) {
  value = clamp01(value);
  return value * value * (3 - 2 * value);
}

function easeOutQuart(value) {
  value = clamp01(value);
  return 1 - Math.pow(1 - value, 4);
}

// =====================================================
// MATERIALIZACIÓN ORGÁNICA
// =====================================================

function applyRevealMask(material) {

  material.userData.revealProgress = 1.1;
  material.userData.revealSoftness = 0.035;

  material.onBeforeCompile = (shader) => {

    shader.uniforms.revealProgress = {
      value: material.userData.revealProgress
    };

    shader.uniforms.revealSoftness = {
      value: material.userData.revealSoftness
    };

    material.userData.revealUniforms = shader.uniforms;

    shader.fragmentShader =
      shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `
          float organicWave =
              sin(vUv.x * 8.0 + revealProgress * 5.0) * 0.018;

          organicWave +=
              sin(vUv.x * 17.0 - revealProgress * 7.0) * 0.012;

          organicWave +=
              sin(vUv.x * 31.0 + revealProgress * 3.0) * 0.007;

          organicWave +=
              sin(vUv.x * 4.5 + revealProgress * 11.0) * 0.020;

          float organicY =
              sin(vUv.y * 18.0 + vUv.x * 9.0) * 0.006;

          float revealEdge =
              revealProgress + organicWave + organicY;

          float revealAmount =
              smoothstep(
                revealEdge - revealSoftness,
                revealEdge + revealSoftness,
                vUv.y
              );

          diffuseColor.a *= revealAmount;

          #include <alphatest_fragment>
        `
      );

    shader.fragmentShader =
      "uniform float revealProgress;\\nuniform float revealSoftness;\\n" +
      shader.fragmentShader;
  };

  material.needsUpdate = true;
}

// =====================================================
// BRILLO DE TEXTO
// =====================================================

function createSweepGlow(texture, position, renderOrder) {

  const material = new THREE.ShaderMaterial({

    uniforms: {
      map: { value: texture },
      progress: { value: -10 },
      width: { value: 0.10 },
      strength: { value: 1.0 }
    },

    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      uniform sampler2D map;
      uniform float progress;
      uniform float width;
      uniform float strength;

      varying vec2 vUv;

      void main() {

        vec4 tex = texture2D(map, vUv);

        if (tex.a < 0.01)
          discard;

        float position =
          vUv.x * 0.90 +
          vUv.y * 0.20;

        float d =
          abs(position - progress);

        float glow =
          1.0 - smoothstep(0.0, width, d);

        glow *= strength;

        gl_FragColor =
          vec4(vec3(1.0), tex.a * glow);

        #include <colorspace_fragment>
      }
    `,

    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      material
    );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

// =====================================================
// GLOW SUAVE
// =====================================================

function createPulseGlow(texture, position, renderOrder) {

  const material =
    new THREE.MeshBasicMaterial({

      map: texture,

      transparent: true,

      opacity: 0,

      depthTest: false,
      depthWrite: false,

      blending: THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      material
    );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

// =====================================================
// HAZ DE LUZ DE LA MATERIALIZACIÓN
// =====================================================

function createRevealWave(position, renderOrder) {

  const material =
    new THREE.ShaderMaterial({

      uniforms: {

        progress: { value: -1 },

        intensity: { value: 0 },

        width: { value: 0.055 }
      },

      vertexShader: `
        varying vec2 vUv;

        void main() {

          vUv = uv;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `

        uniform float progress;
        uniform float intensity;
        uniform float width;

        varying vec2 vUv;

        void main() {

          float organicWave =
              sin(vUv.x * 8.0 + progress * 5.0) * 0.018;

          organicWave +=
              sin(vUv.x * 17.0 - progress * 7.0) * 0.012;

          organicWave +=
              sin(vUv.x * 31.0 + progress * 3.0) * 0.007;

          organicWave +=
              sin(vUv.x * 4.5 + progress * 11.0) * 0.020;

          float edge =
              progress +
              organicWave;

          float band =
              abs(vUv.y - edge);

          float core =
              1.0 -
              smoothstep(
                0.0,
                width,
                band
              );

          float halo =
              1.0 -
              smoothstep(
                0.0,
                width * 4.5,
                band
              );

          float coreColor =
              smoothstep(
                0.0,
                width * 1.5,
                band
              );

          vec3 warmLight =
            mix(
              vec3(1.0, 0.62, 0.16),
              vec3(1.0, 0.94, 0.62),
              1.0 - coreColor
            );

          float sideFade =
            0.75 +
            0.25 *
            sin(vUv.x * 3.14159265);

          float alpha =
            (
              core * 0.70 +
              halo * 0.22
            ) *
            intensity *
            sideFade;

          gl_FragColor =
            vec4(
              warmLight,
              alpha
            );

          #include <colorspace_fragment>
        }
      `,

      transparent: true,

      depthTest: false,
      depthWrite: false,

      blending: THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      material
    );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

// =====================================================
// HALO DE LA CRUZ
// =====================================================

function createCrossHalo(position, renderOrder) {

  const material =
    new THREE.ShaderMaterial({

      uniforms: {
        intensity: { value: 0 }
      },

      vertexShader: `
        varying vec2 vUv;

        void main() {

          vUv = uv;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `

        uniform float intensity;

        varying vec2 vUv;

        void main() {

          vec2 p =
            vUv -
            vec2(0.5, 0.91);

          p.x *= 1.18;

          float d =
            length(p);

          float glow =
            exp(-d * 18.0);

          float outer =
            exp(-d * 7.0);

          vec3 warm =
            vec3(
              1.0,
              0.78,
              0.32
            );

          float alpha =
            (
              glow * 0.72 +
              outer * 0.12
            ) *
            intensity;

          gl_FragColor =
            vec4(
              warm,
              alpha
            );

          #include <colorspace_fragment>
        }
      `,

      transparent: true,

      depthTest: false,
      depthWrite: false,

      blending: THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      material
    );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

// =====================================================
// DOBLE LATIDO
// =====================================================

function doubleBeat(
  time,
  period = 4.2,
  phase = 0
) {

  let t =
    (
      (time + phase) %
      period +
      period
    ) %
    period;

  const beat1 =
    Math.exp(
      -Math.pow(
        (t - 0.32) / 0.11,
        2
      )
    );

  const beat2 =
    Math.exp(
      -Math.pow(
        (t - 0.58) / 0.13,
        2
      )
    ) * 0.62;

  return clamp01(
    beat1 + beat2
  );
}

// =====================================================
// BOTÓN DE FRENTE / REVERSO
// =====================================================

function createFlipButton() {

  if (flipButton)
    return;

  flipButton =
    document.createElement("button");

  flipButton.id =
    "flip-button";

  flipButton.innerHTML =
    `
      <span class="flip-icon">↻</span>
      <span class="flip-label">
        Ver reverso
      </span>
    `;

  Object.assign(
    flipButton.style,
    {

      position: "fixed",

      left: "50%",

      bottom: "28px",

      transform:
        "translateX(-50%)",

      zIndex: "9999",

      display: "none",

      alignItems: "center",

      gap: "8px",

      padding:
        "10px 17px",

      border:
        "1px solid rgba(255,220,145,0.65)",

      borderRadius:
        "999px",

      background:
        "rgba(72,53,42,0.72)",

      color:
        "#fff7df",

      fontFamily:
        "Georgia, serif",

      fontSize:
        "15px",

      letterSpacing:
        "0.2px",

      boxShadow:
        "0 4px 18px rgba(0,0,0,0.22), 0 0 16px rgba(255,205,100,0.18)",

      backdropFilter:
        "blur(8px)",

      WebkitBackdropFilter:
        "blur(8px)",

      cursor:
        "pointer",

      WebkitTapHighlightColor:
        "transparent"
    }
  );

  const icon =
    flipButton.querySelector(
      ".flip-icon"
    );

  Object.assign(
    icon.style,
    {
      fontSize: "20px",
      lineHeight: "1"
    }
  );

  flipButton.addEventListener(
    "click",
    () => {

      if (
        !targetVisible ||
        flipActive
      )
        return;

      startFlip();
    }
  );

  document.body.appendChild(
    flipButton
  );
}

function updateFlipButton() {

  if (!flipButton)
    return;

  if (
    !targetVisible ||
    flipActive
  ) {

    flipButton.style.display =
      "none";

    return;
  }

  flipButton.style.display =
    "flex";

  const label =
    flipButton.querySelector(
      ".flip-label"
    );

  if (isBack) {

    label.textContent =
      "Volver al frente";

  } else {

    label.textContent =
      "Ver reverso";
  }
}

// =====================================================
// DESTELLOS MÁGICOS DEL GIRO
// =====================================================

function createMagicFlip(scene) {

  const group =
    new THREE.Group();

  group.visible = false;

  scene.add(group);

  const count = 34;

  const particles = [];

  for (
    let i = 0;
    i < count;
    i++
  ) {

    const material =
      new THREE.MeshBasicMaterial({

        color:
          new THREE.Color(
            0xffd77a
          ),

        transparent: true,

        opacity: 0,

        depthTest: false,

        depthWrite: false,

        blending:
          THREE.AdditiveBlending
      });

    const size =
      0.008 +
      Math.random() * 0.016;

    const mesh =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          size,
          size
        ),
        material
      );

    mesh.position.set(
      (Math.random() - 0.5) * 0.72,
      (Math.random() - 0.5) * 1.05,
      0.08
    );

    mesh.userData = {

      baseX:
        mesh.position.x,

      baseY:
        mesh.position.y,

      phase:
        Math.random() *
        Math.PI *
        2,

      radius:
        0.20 +
        Math.random() * 0.55,

      speed:
        1.2 +
        Math.random() * 1.8
    };

    mesh.renderOrder =
      200;

    group.add(mesh);

    particles.push(mesh);
  }

  group.userData.particles =
    particles;

  return group;
}

// =====================================================
// INICIO DEL GIRO
// =====================================================

function startFlip() {

  if (
    flipActive ||
    !targetVisible
  )
    return;

  flipActive = true;

  flipProgress = 0;

  if (magicFlip) {

    magicFlip.visible =
      true;
  }

  if (flipButton) {

    flipButton.style.display =
      "none";
  }
}

// =====================================================
// ANIMAR EL GIRO
// =====================================================

function updateFlipAnimation(delta) {

  if (!flipActive)
    return;

  flipProgress +=
    delta / 1.45;

  const p =
    clamp01(
      flipProgress
    );

  const eased =
    easeInOut(p);

  const direction =
    isBack
      ? -1
      : 1;

  if (frontGroup) {

    frontGroup.rotation.y =
      direction *
      Math.PI *
      eased;
  }

  if (backGroup) {

    backGroup.rotation.y =
      direction *
      Math.PI *
      eased;
  }

  // ---------------------------------------------------
  // DESTELLOS
  // ---------------------------------------------------

  if (magicFlip) {

    const particles =
      magicFlip.userData
        .particles;

    const centerBurst =
      Math.sin(
        p * Math.PI
      );

    magicFlip.visible =
      centerBurst > 0.01;

    particles.forEach(
      (particle, index) => {

        const data =
          particle.userData;

        const angle =
          data.phase +
          p *
          data.speed;

        const spread =
          centerBurst *
          data.radius;

        particle.position.x =
          Math.cos(angle) *
          spread;

        particle.position.y =
          Math.sin(angle) *
          spread *
          1.35;

        const sparkle =
          Math.pow(
            Math.sin(
              p * Math.PI
            ),
            1.2
          );

        particle.material.opacity =
          sparkle *
          (
            0.35 +
            0.65 *
            (
              0.5 +
              0.5 *
              Math.sin(
                index +
                p * 20
              )
            )
          );

        const scale =
          0.6 +
          sparkle *
          1.8;

        particle.scale.set(
          scale,
          scale,
          1
        );

        particle.rotation.z =
          angle;
      }
    );
  }

  // ---------------------------------------------------
  // MOMENTO CENTRAL DEL GIRO
  // ---------------------------------------------------

  if (
    p >= 0.5 &&
    !isBack
  ) {

    frontGroup.visible =
      false;

    backGroup.visible =
      true;
  }

  if (
    p >= 0.5 &&
    isBack
  ) {

    frontGroup.visible =
      true;

    backGroup.visible =
      false;
  }

  // ---------------------------------------------------
  // FIN
  // ---------------------------------------------------

  if (p >= 1) {

    flipActive =
      false;

    isBack =
      !isBack;

    if (isBack) {

      frontGroup.visible =
        false;

      backGroup.visible =
        true;

      frontGroup.rotation.y =
        Math.PI;

      backGroup.rotation.y =
        Math.PI;

    } else {

      frontGroup.visible =
        true;

      backGroup.visible =
        false;

      frontGroup.rotation.y =
        0;

      backGroup.rotation.y =
        0;
    }

    if (magicFlip) {

      magicFlip.visible =
        false;

      magicFlip.userData
        .particles
        .forEach(
          particle => {
            particle.material.opacity =
              0;
          }
        );
    }

    updateFlipButton();
  }
}

// =====================================================
// START AR
// =====================================================

async function startAR() {

  startButton.disabled =
    true;

  startButton.textContent =
    "Abriendo cámara…";

  try {

    mindarThree =
      new MindARThree({

        container:
          document.querySelector(
            "#ar-container"
          ),

        imageTargetSrc:
          "./targets/estampita.mind",

        maxTrack: 1,

        // ------------------------------------------------
        // TRACKING ESTABLE
        // ------------------------------------------------

        filterMinCF:
          0.0005,

        filterBeta:
          1000,

        warmupTolerance:
          5,

        missTolerance:
          8,

        uiLoading:
          "no",

        uiScanning:
          "no",

        uiError:
          "no"
      });

    const {
      renderer,
      scene,
      camera
    } =
      mindarThree;

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2
      )
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    // ===================================================
    // TRACKING PROXY
    // ===================================================

    const anchor =
      mindarThree.addAnchor(0);

    // ===================================================
    // GRUPO ESTABILIZADO
    // ===================================================

    frontGroup =
      new THREE.Group();

    scene.add(
      frontGroup
    );

    frontGroup.visible =
      false;

    // ===================================================
    // GRUPO DEL REVERSO
    // ===================================================

    backGroup =
      new THREE.Group();

    scene.add(
      backGroup
    );

    backGroup.visible =
      false;

    // ===================================================
    // DESTELLOS DEL GIRO
    // ===================================================

    magicFlip =
      createMagicFlip(scene);

    // ===================================================
    // BOTÓN
    // ===================================================

    createFlipButton();

    // ===================================================
    // TEXTURAS
    // ===================================================

    const textureLoader =
      new THREE.TextureLoader();

    // ===================================================
    // CAPAS DEL FRENTE
    // ===================================================

    const layers = [

      {
        file:
          "fondo-limpio.png",
        order: 0
      },

      {
        file:
          "texto-jesus.png",
        order: 1
      },

      {
        file:
          "pincelada-lila.png",
        order: 2
      },

      {
        file:
          "texto-comunion.png",
        order: 3
      },

      {
        file:
          "corazon-inferior.png",
        order: 4
      },

      {
        file:
          "corazon-superior.png",
        order: 5
      },

      {
        file:
          "cruz.png",
        order: 6
      },

      {
        file:
          "nena-cuerpo.png",
        order: 10
      },

      {
        file:
          "nena-flores.png",
        order: 11
      },

      {
        file:
          "nena-cara.png",
        order: 12
      },

      {
        file:
          "nena-pelo.png",
        order: 13
      },

      {
        file:
          "nena-corona.png",
        order: 14
      },

      {
        file:
          "gatito-superior.png",
        order: 20
      },

      {
        file:
          "gatito-inferior.png",
        order: 21
      },

      {
        file:
          "corazones.png",
        order: 30
      },

      {
        file:
          "estrellas.png",
        order: 31
      },

      {
        file:
          "destellos.png",
        order: 32
      },

      {
        file:
          "marco-corazones.png",
        order: 40
      }
    ];

    // ===================================================
    // CARGAR FRENTE
    // ===================================================

    for (
      const layer of layers
    ) {

      let texture;

      try {

        texture =
          await textureLoader
            .loadAsync(
              `./assets/animation/${layer.file}`
            );

      } catch (error) {

        alert(
          "NO SE PUDO CARGAR: " +
          layer.file
        );

        throw error;
      }

      texture.colorSpace =
        THREE.SRGBColorSpace;

      const material =
        new THREE.MeshBasicMaterial({

          map:
            texture,

          transparent:
            true,

          alphaTest:
            0.01,

          depthTest:
            false,

          depthWrite:
            false,

          opacity:
            1,

          side:
            THREE.DoubleSide
        });

      applyRevealMask(
        material
      );

      const mesh =
        new THREE.Mesh(

          new THREE.PlaneGeometry(
            1,
            1.5
          ),

          material
        );

      mesh.position.copy(
        commonPosition
      );

      mesh.renderOrder =
        layer.order;

      layerMeshes[
        layer.file
      ] = mesh;

      frontGroup.add(
        mesh
      );
    }

    // ===================================================
    // GLOWS
    // ===================================================

    glowMeshes[
      "texto-jesus.png"
    ] =
      createSweepGlow(
        layerMeshes[
          "texto-jesus.png"
        ].material.map,

        commonPosition,

        1.5
      );

    frontGroup.add(
      glowMeshes[
        "texto-jesus.png"
      ]
    );

    glowMeshes[
      "texto-comunion.png"
    ] =
      createSweepGlow(
        layerMeshes[
          "texto-comunion.png"
        ].material.map,

        commonPosition,

        3.5
      );

    frontGroup.add(
      glowMeshes[
        "texto-comunion.png"
      ]
    );

    glowMeshes[
      "cruz.png"
    ] =
      createPulseGlow(
        layerMeshes[
          "cruz.png"
        ].material.map,

        commonPosition,

        6.5
      );

    frontGroup.add(
      glowMeshes[
        "cruz.png"
      ]
    );

    glowMeshes[
      "corazon-superior.png"
    ] =
      createPulseGlow(
        layerMeshes[
          "corazon-superior.png"
        ].material.map,

        commonPosition,

        5.5
      );

    frontGroup.add(
      glowMeshes[
        "corazon-superior.png"
      ]
    );

    glowMeshes[
      "corazon-inferior.png"
    ] =
      createPulseGlow(
        layerMeshes[
          "corazon-inferior.png"
        ].material.map,

        commonPosition,

        4.5
      );

    frontGroup.add(
      glowMeshes[
        "corazon-inferior.png"
      ]
    );

    glowMeshes[
      "corazones.png"
    ] =
      createPulseGlow(
        layerMeshes[
          "corazones.png"
        ].material.map,

        commonPosition,

        30.5
      );

    frontGroup.add(
      glowMeshes[
        "corazones.png"
      ]
    );

    glowMeshes[
      "destellos.png"
    ] =
      createPulseGlow(
        layerMeshes[
          "destellos.png"
        ].material.map,

        commonPosition,

        32.5
      );

    frontGroup.add(
      glowMeshes[
        "destellos.png"
      ]
    );

    // ===================================================
    // HAZ DE MATERIALIZACIÓN
    // ===================================================

    const revealWave =
      createRevealWave(
        commonPosition,
        45
      );

    frontGroup.add(
      revealWave
    );

    // ===================================================
    // HALO CRUZ
    // ===================================================

    const crossHalo =
      createCrossHalo(
        commonPosition,
        6.4
      );

    frontGroup.add(
      crossHalo
    );

    // ===================================================
    // REVERSO — POR AHORA SOLO FONDO LIMPIO
    // ===================================================

    const backTexture =
      await textureLoader.loadAsync(
        "./assets/animation/fondo-limpio.png"
      );

    backTexture.colorSpace =
      THREE.SRGBColorSpace;

    const backMaterial =
      new THREE.MeshBasicMaterial({

        map:
          backTexture,

        transparent:
          true,

        depthTest:
          false,

        depthWrite:
          false,

        side:
          THREE.DoubleSide,

        opacity:
          1
      });

    const backMesh =
      new THREE.Mesh(

        new THREE.PlaneGeometry(
          1,
          1.5
        ),

        backMaterial
      );

    backMesh.position.copy(
      commonPosition
    );

    /*
     * Compensamos la orientación para que
     * el reverso no quede visualmente espejado.
     */

    backMesh.scale.x =
      -1;

    backMesh.renderOrder =
      0;

    backGroup.add(
      backMesh
    );

    // ===================================================
    // OPACIDADES INICIALES
    // ===================================================

    for (
      const file of
      Object.keys(layerMeshes)
    ) {

      layerMeshes[
        file
      ].material.opacity = 0;
    }

    for (
      const file of
      Object.keys(glowMeshes)
    ) {

      glowMeshes[
        file
      ].material.opacity = 0;
    }

    revealWave
      .material
      .uniforms
      .progress
      .value = -1;

    revealWave
      .material
      .uniforms
      .intensity
      .value = 0;

    crossHalo
      .material
      .uniforms
      .intensity
      .value = 0;

    // ===================================================
    // ESTABILIZADOR
    // ===================================================

    const rawPosition =
      new THREE.Vector3();

    const rawQuaternion =
      new THREE.Quaternion();

    const rawScale =
      new THREE.Vector3();

    let stabilizerReady =
      false;

    const POSITION_RESPONSE =
      9;

    const ROTATION_RESPONSE =
      11;

    const SCALE_RESPONSE =
      9;

    function updateTrackingStabilizer(
      delta
    ) {

      anchor.group
        .updateMatrixWorld(
          true
        );

      anchor.group
        .matrixWorld
        .decompose(

          rawPosition,

          rawQuaternion,

          rawScale
        );

      if (
        !stabilizerReady
      ) {

        frontGroup.position.copy(
          rawPosition
        );

        frontGroup.quaternion.copy(
          rawQuaternion
        );

        frontGroup.scale.copy(
          rawScale
        );

        backGroup.position.copy(
          rawPosition
        );

        backGroup.quaternion.copy(
          rawQuaternion
        );

        backGroup.scale.copy(
          rawScale
        );

        magicFlip.position.copy(
          rawPosition
        );

        magicFlip.quaternion.copy(
          rawQuaternion
        );

        magicFlip.scale.copy(
          rawScale
        );

        stabilizerReady =
          true;

        return;
      }

      const positionAlpha =
        1 -
        Math.exp(
          -POSITION_RESPONSE *
          delta
        );

      const rotationAlpha =
        1 -
        Math.exp(
          -ROTATION_RESPONSE *
          delta
        );

      const scaleAlpha =
        1 -
        Math.exp(
          -SCALE_RESPONSE *
          delta
        );

      frontGroup.position.lerp(
        rawPosition,
        positionAlpha
      );

      frontGroup.quaternion.slerp(
        rawQuaternion,
        rotationAlpha
      );

      frontGroup.scale.lerp(
        rawScale,
        scaleAlpha
      );

      backGroup.position.lerp(
        rawPosition,
        positionAlpha
      );

      backGroup.quaternion.slerp(
        rawQuaternion,
        rotationAlpha
      );

      backGroup.scale.lerp(
        rawScale,
        scaleAlpha
      );

      magicFlip.position.lerp(
        rawPosition,
        positionAlpha
      );

      magicFlip.quaternion.slerp(
        rawQuaternion,
        rotationAlpha
      );

      magicFlip.scale.lerp(
        rawScale,
        scaleAlpha
      );
    }

    // ===================================================
    // TRACKING
    // ===================================================

    let targetFoundTime =
      null;

    let targetVisible =
      false;

    anchor.onTargetFound =
      () => {

        targetFoundTime =
          performance.now();

        targetVisible =
          true;

        if (
          !flipActive
        ) {

          isBack =
            false;

          frontGroup.visible =
            true;

          backGroup.visible =
            false;

          frontGroup.rotation.y =
            0;

          backGroup.rotation.y =
            0;
        }

        for (
          const file of
          Object.keys(layerMeshes)
        ) {

          layerMeshes[
            file
          ].material.opacity = 1;

          if (
            layerMeshes[
              file
            ].material.userData
              .revealUniforms
          ) {

            layerMeshes[
              file
            ].material.userData
              .revealUniforms
              .revealProgress
              .value = 1.1;
          }
        }

        revealWave
          .material
          .uniforms
          .progress
          .value = -1;

        revealWave
          .material
          .uniforms
          .intensity
          .value = 0;

        crossHalo
          .material
          .uniforms
          .intensity
          .value = 0;

        status.textContent =
          "¡La estampita cobró vida!";

        status.classList.remove(
          "hidden"
        );

        updateFlipButton();
      };

    anchor.onTargetLost =
      () => {

        targetFoundTime =
          null;

        targetVisible =
          false;

        stabilizerReady =
          false;

        flipActive =
          false;

        isBack =
          false;

        frontGroup.visible =
          false;

        backGroup.visible =
          false;

        magicFlip.visible =
          false;

        for (
          const file of
          Object.keys(layerMeshes)
        ) {

          layerMeshes[
            file
          ].material.opacity = 0;
        }

        for (
          const file of
          Object.keys(glowMeshes)
        ) {

          glowMeshes[
            file
          ].material.opacity = 0;
        }

        revealWave
          .material
          .uniforms
          .progress
          .value = -1;

        revealWave
          .material
          .uniforms
          .intensity
          .value = 0;

        crossHalo
          .material
          .uniforms
          .intensity
          .value = 0;

        updateFlipButton();

        status.textContent =
          "Apuntá la cámara a la estampita";

        status.classList.remove(
          "hidden"
        );
      };

    // ===================================================
    // ARRANQUE
    // ===================================================

    status.textContent =
      "Preparando cámara…";

    status.classList.remove(
      "hidden"
    );

    await mindarThree.start();

    startScreen.classList.add(
      "hidden"
    );

    stopButton.classList.remove(
      "hidden"
    );

    status.textContent =
      "Apuntá la cámara a la estampita";

    // ===================================================
    // LOOP
    // ===================================================

    const clock =
      new THREE.Clock();

    renderer.setAnimationLoop(
      () => {

        const delta =
          Math.min(
            clock.getDelta(),
            0.05
          );

        const time =
          clock.elapsedTime;

        // -----------------------------------------------
        // TRACKING
        // -----------------------------------------------

        if (
          targetVisible
        ) {

          frontGroup.visible =
            !isBack ||
            flipActive;

          backGroup.visible =
            isBack &&
            !flipActive;

          updateTrackingStabilizer(
            delta
          );

        } else {

          frontGroup.visible =
            false;

          backGroup.visible =
            false;

          magicFlip.visible =
            false;

          stabilizerReady =
            false;
        }

        // -----------------------------------------------
        // TIEMPO DE APARICIÓN
        // -----------------------------------------------

        let elapsed =
          999;

        if (
          targetFoundTime !== null
        ) {

          elapsed =
            (
              performance.now() -
              targetFoundTime
            ) / 1000;
        }

        // -----------------------------------------------
        // MATERIALIZACIÓN
        // -----------------------------------------------

        if (
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const revealStart =
            0.62;

          const revealDuration =
            3.20;

          let revealProgress =
            1.1;

          if (
            elapsed >=
            revealStart
          ) {

            const revealT =
              clamp01(
                (
                  elapsed -
                  revealStart
                ) /
                revealDuration
              );

            revealProgress =
              1.08 -
              easeInOut(
                revealT
              ) *
              1.16;
          }

          for (
            const file of
            Object.keys(layerMeshes)
          ) {

            const material =
              layerMeshes[
                file
              ].material;

            material.opacity =
              1;

            if (
              material.userData
                .revealUniforms
            ) {

              material.userData
                .revealUniforms
                .revealProgress
                .value =
                revealProgress;
            }
          }

          // -------------------------------------------
          // FONDO
          // -------------------------------------------

          layerMeshes[
            "fondo-limpio.png"
          ].material.opacity =
            easeOutCubic(
              elapsed / 0.35
            );

          // -------------------------------------------
          // NIÑA
          // -------------------------------------------

          const girlProgress =
            easeOutCubic(
              (
                elapsed -
                0.12
              ) / 0.70
            );

          [
            "nena-cuerpo.png",
            "nena-flores.png",
            "nena-cara.png",
            "nena-pelo.png",
            "nena-corona.png"
          ].forEach(
            file => {

              layerMeshes[
                file
              ].material.opacity =
                girlProgress;
            }
          );

          // -------------------------------------------
          // GATITOS
          // -------------------------------------------

          const catProgress =
            easeOutCubic(
              (
                elapsed -
                0.30
              ) / 0.70
            );

          [
            "gatito-superior.png",
            "gatito-inferior.png"
          ].forEach(
            file => {

              layerMeshes[
                file
              ].material.opacity =
                catProgress;
            }
          );

          // -------------------------------------------
          // PINCELADA
          // -------------------------------------------

          layerMeshes[
            "pincelada-lila.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.05
              ) / 0.55
            );

          // -------------------------------------------
          // TEXTOS
          // -------------------------------------------

          layerMeshes[
            "texto-comunion.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.18
              ) / 0.85
            );

          layerMeshes[
            "texto-jesus.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.35
              ) / 0.85
            );

          // -------------------------------------------
          // CRUZ
          // -------------------------------------------

          layerMeshes[
            "cruz.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.20
              ) / 0.65
            );

          // -------------------------------------------
          // CORAZONES
          // -------------------------------------------

          const heartProgress =
            easeOutCubic(
              (
                elapsed -
                0.25
              ) / 0.65
            );

          layerMeshes[
            "corazon-superior.png"
          ].material.opacity =
            heartProgress;

          layerMeshes[
            "corazon-inferior.png"
          ].material.opacity =
            heartProgress;

          // -------------------------------------------
          // DECORACIÓN
          // -------------------------------------------

          const decorationProgress =
            easeOutCubic(
              (
                elapsed -
                0.30
              ) / 0.75
            );

          [
            "corazones.png",
            "estrellas.png",
            "destellos.png",
            "marco-corazones.png"
          ].forEach(
            file => {

              layerMeshes[
                file
              ].material.opacity =
                decorationProgress;
            }
          );
        }

        // =================================================
        // MOVIMIENTO SUTIL
        // =================================================

        const hair =
          layerMeshes[
            "nena-pelo.png"
          ];

        if (hair) {

          hair.position.x =
            commonPosition.x +
            Math.sin(
              time * 1.2
            ) *
            0.004;

          hair.position.y =
            commonPosition.y +
            Math.sin(
              time * 1.5
            ) *
            0.002;
        }

        const crown =
          layerMeshes[
            "nena-corona.png"
          ];

        if (crown) {

          crown.position.x =
            commonPosition.x +
            Math.sin(
              time * 1.2 +
              0.3
            ) *
            0.003;

          crown.position.y =
            commonPosition.y +
            Math.sin(
              time * 1.5 +
              0.3
            ) *
            0.0015;

          crown.rotation.z =
            Math.sin(
              time * 1.1
            ) *
            0.008;
        }

        const catTop =
          layerMeshes[
            "gatito-superior.png"
          ];

        if (catTop) {

          catTop.position.x =
            commonPosition.x +
            Math.sin(
              time * 0.75 +
              1.5
            ) *
            0.003;

          catTop.position.y =
            commonPosition.y +
            Math.sin(
              time * 1.0 +
              0.5
            ) *
            0.004;
        }

        const catBottom =
          layerMeshes[
            "gatito-inferior.png"
          ];

        if (catBottom) {

          catBottom.position.x =
            commonPosition.x +
            Math.sin(
              time * 0.65 +
              3.0
            ) *
            0.0025;

          catBottom.position.y =
            commonPosition.y +
            Math.sin(
              time * 0.9 +
              2.0
            ) *
            0.0035;
        }

        // =================================================
        // CORAZONES
        // =================================================

        const decorativeHearts =
          layerMeshes[
            "corazones.png"
          ];

        const decorativeHeartGlow =
          glowMeshes[
            "corazones.png"
          ];

        if (
          decorativeHearts &&
          decorativeHeartGlow &&
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const beat =
            doubleBeat(
              time,
              4.6,
              0.4
            );

          decorativeHearts
            .material
            .opacity =
            0.82 +
            beat *
            0.18;

          decorativeHeartGlow
            .material
            .opacity =
            beat *
            0.48;
        }

        const heartTop =
          layerMeshes[
            "corazon-superior.png"
          ];

        const heartTopGlow =
          glowMeshes[
            "corazon-superior.png"
          ];

        if (
          heartTop &&
          heartTopGlow &&
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const beat =
            doubleBeat(
              time,
              4.0,
              0
            );

          heartTop.material.opacity =
            0.84 +
            beat *
            0.16;

          heartTopGlow.material.opacity =
            beat *
            0.42;
        }

        const heartBottom =
          layerMeshes[
            "corazon-inferior.png"
          ];

        const heartBottomGlow =
          glowMeshes[
            "corazon-inferior.png"
          ];

        if (
          heartBottom &&
          heartBottomGlow &&
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const beat =
            doubleBeat(
              time,
              4.0,
              1.8
            );

          heartBottom.material.opacity =
            0.84 +
            beat *
            0.16;

          heartBottomGlow.material.opacity =
            beat *
            0.42;
        }

        // =================================================
        // CRUZ + HAZ DE MATERIALIZACIÓN
        // =================================================

        if (
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const cross =
            layerMeshes[
              "cruz.png"
            ];

          const crossGlow =
            glowMeshes[
              "cruz.png"
            ];

          let ignition =
            0;

          if (
            elapsed >=
              0.35 &&
            elapsed <
              1.30
          ) {

            const p =
              (
                elapsed -
                0.35
              ) /
              0.95;

            ignition =
              Math.sin(
                easeInOut(p) *
                Math.PI
              );

          } else if (
            elapsed >=
              1.30 &&
            elapsed <
              2.10
          ) {

            ignition =
              0.42 *
              (
                1 -
                easeOutCubic(
                  (
                    elapsed -
                    1.30
                  ) /
                  0.80
                )
              );
          }

          const ambientPulse =
            Math.pow(
              (
                Math.sin(
                  time * 0.75
                ) +
                1
              ) /
              2,
              5
            ) *
            0.10;

          if (cross) {

            cross.material.opacity =
              Math.max(
                cross.material.opacity,
                0.82 +
                ignition *
                0.18 +
                ambientPulse
              );
          }

          if (crossGlow) {

            crossGlow.material.opacity =
              Math.min(
                1,
                ignition *
                1.15 +
                ambientPulse *
                0.5
              );
          }

          crossHalo
            .material
            .uniforms
            .intensity
            .value =
            Math.min(
              1,
              ignition *
              1.25
            );

          // ---------------------------------------------
          // HAZ ORGÁNICO
          // ---------------------------------------------

          if (
            elapsed >=
              0.50 &&
            elapsed <=
              2.15
          ) {

            const p =
              (
                elapsed -
                0.50
              ) /
              1.65;

            const wave =
              easeInOut(p);

            revealWave
              .material
              .uniforms
              .progress
              .value =
              1.02 -
              wave *
              1.22;

            const edge =
              Math.sin(
                p *
                Math.PI
              );

            revealWave
              .material
              .uniforms
              .intensity
              .value =
              0.78 *
              edge;

          } else {

            revealWave
              .material
              .uniforms
              .intensity
              .value =
              0;
          }
        }

        // =================================================
        // DESTELLOS
        // =================================================

        const sparkles =
          layerMeshes[
            "destellos.png"
          ];

        const sparkleGlow =
          glowMeshes[
            "destellos.png"
          ];

        if (
          sparkles &&
          sparkleGlow &&
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const wave1 =
            Math.pow(
              (
                Math.sin(
                  time * 1.8
                ) +
                1
              ) /
              2,
              6
            );

          const wave2 =
            Math.pow(
              (
                Math.sin(
                  time * 3.1 +
                  1.7
                ) +
                1
              ) /
              2,
              9
            );

          const wave3 =
            Math.pow(
              (
                Math.sin(
                  time * 4.7 +
                  3.0
                ) +
                1
              ) /
              2,
              12
            );

          const sparkle =
            clamp01(
              wave1 +
              wave2 * 0.65 +
              wave3 * 0.45
            );

          sparkles.material.opacity =
            0.18 +
            sparkle *
            0.82;

          sparkleGlow.material.opacity =
            0.08 +
            sparkle *
            0.90;
        }

        // =================================================
        // ESTRELLAS
        // =================================================

        const stars =
          layerMeshes[
            "estrellas.png"
          ];

        if (
          stars &&
          targetVisible &&
          !isBack &&
          !flipActive
        ) {

          const starWave =
            Math.pow(
              (
                Math.sin(
                  time * 1.25 +
                  0.8
                ) +
                1
              ) /
              2,
              3
            );

          stars.material.opacity =
            0.68 +
            starWave *
            0.32;
        }

        // =================================================
        // BRILLO DE TEXTOS
        // =================================================

        const jesusGlow =
          glowMeshes[
            "texto-jesus.png"
          ];

        const communionGlow =
          glowMeshes[
            "texto-comunion.png"
          ];

        function updateTextSweep(
          glow,
          startDelay,
          cycleLength,
          duration
        ) {

          if (
            !glow ||
            !targetVisible ||
            isBack ||
            flipActive ||
            elapsed <
              startDelay
          ) {

            if (glow)
              glow.material.opacity =
                0;

            return;
          }

          const localTime =
            elapsed -
            startDelay;

          const cycle =
            localTime %
            cycleLength;

          if (
            cycle >= 0 &&
            cycle <
              duration
          ) {

            const progress =
              cycle /
              duration;

            glow.material
              .uniforms
              .progress
              .value =
              -0.15 +
              progress *
              1.30;

            const intensity =
              Math.sin(
                progress *
                Math.PI
              );

            glow.material
              .uniforms
              .strength
              .value =
              0.85 +
              intensity *
              0.65;

            glow.material.opacity =
              0.35 +
              intensity *
              0.65;

          } else {

            glow.material.opacity =
              0;
          }
        }

        updateTextSweep(
          communionGlow,
          2.05,
          6.5,
          1.15
        );

        updateTextSweep(
          jesusGlow,
          3.55,
          6.5,
          1.15
        );

        // =================================================
        // GIRO
        // =================================================

        if (
          flipActive
        ) {

          updateFlipAnimation(
            delta
          );
        }

        // =================================================
        // BOTÓN
        // =================================================

        if (
          targetVisible
        ) {

          updateFlipButton();
        }

        // =================================================
        // RENDER
        // =================================================

        renderer.render(
          scene,
          camera
        );
      }
    );

  } catch (error) {

    console.error(
      "Error iniciando MindAR:",
      error
    );

    if (
      mindarThree
    ) {

      try {

        mindarThree.stop();

        mindarThree
          .renderer
          .setAnimationLoop(
            null
          );

      } catch (e) {}
    }

    mindarThree =
      null;

    startButton.disabled =
      false;

    startButton.textContent =
      "Intentar nuevamente";

    status.textContent =
      "No se pudo iniciar la cámara.";

    status.classList.remove(
      "hidden"
    );

    alert(
      "ERROR REAL: " +
      JSON.stringify(
        error
      )
    );
  }
}

// =====================================================
// DETENER AR
// =====================================================

function stopAR() {

  if (
    !mindarThree
  )
    return;

  mindarThree.stop();

  mindarThree
    .renderer
    .setAnimationLoop(
      null
    );

  stopButton.classList.add(
    "hidden"
  );

  status.classList.add(
    "hidden"
  );

  startScreen.classList.remove(
    "hidden"
  );

  startButton.disabled =
    false;

  startButton.textContent =
    "Comenzar";

  if (flipButton) {

    flipButton.style.display =
      "none";
  }

  mindarThree =
    null;

  layerMeshes =
    {};

  glowMeshes =
    {};

  frontGroup =
    null;

  backGroup =
    null;

  magicFlip =
    null;

  flipButton =
    null;

  isBack =
    false;

  flipActive =
    false;
}

// =====================================================
// EVENTOS
// =====================================================

startButton.addEventListener(
  "click",
  startAR
);

stopButton.addEventListener(
  "click",
  stopAR
);
