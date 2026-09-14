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

/* =========================================================
   ESTADO GLOBAL
   ========================================================= */

let targetVisible = false;

let flipState = "front";
let flipStartTime = 0;
let flipFrom = 0;
let flipTo = 0;

const FLIP_DURATION = 1.55;

let flipContainer = null;
let frontGroup = null;
let backGroup = null;

let flipMagicGroup = null;
let flipFlash = null;
let flipButton = null;

/* =========================================================
   UTILIDADES
   ========================================================= */

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

/* =========================================================
   REVELACIÓN
   ========================================================= */

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
      "uniform float revealProgress;\nuniform float revealSoftness;\n" +
      shader.fragmentShader;

    shader.fragmentShader =
      shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `
        float organicWave =
          sin(vMapUv.x * 8.0 + revealProgress * 5.0) * 0.018;

        organicWave +=
          sin(vMapUv.x * 17.0 - revealProgress * 7.0) * 0.012;

        organicWave +=
          sin(vMapUv.x * 31.0 + revealProgress * 3.0) * 0.007;

        organicWave +=
          sin(vMapUv.x * 4.5 + revealProgress * 11.0) * 0.020;

        float organicY =
          sin(vMapUv.y * 18.0 + vMapUv.x * 9.0) * 0.006;

        float revealEdge =
          revealProgress + organicWave + organicY;

        float revealAmount =
          smoothstep(
            revealEdge - revealSoftness,
            revealEdge + revealSoftness,
            vMapUv.y
          );

        diffuseColor.a *= revealAmount;

        #include <alphatest_fragment>
        `
      );
  };

  material.needsUpdate = true;
}

/* =========================================================
   BRILLO DE TEXTO
   ========================================================= */

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

        if (tex.a < 0.01) discard;

        float position =
          vUv.x * 0.90 +
          vUv.y * 0.20;

        float d =
          abs(position - progress);

        float glow =
          1.0 -
          smoothstep(0.0, width, d);

        glow *= strength;

        gl_FragColor =
          vec4(
            vec3(1.0),
            tex.a * glow
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

/* =========================================================
   BRILLO PULSANTE
   ========================================================= */

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

/* =========================================================
   ONDA DE LUZ
   ========================================================= */

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

          float band =
            abs(vUv.y - progress);

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
              width * 3.8,
              band
            );

          float sideFade =
            0.75 +
            0.25 *
            sin(vUv.x * 3.14159265);

          float alpha =
            (
              core * 0.62 +
              halo * 0.20
            ) *
            intensity *
            sideFade;

          gl_FragColor =
            vec4(
              vec3(1.0),
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

/* =========================================================
   HALO DE LA CRUZ
   ========================================================= */

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

          float alpha =
            (
              glow * 0.72 +
              outer * 0.12
            ) *
            intensity;

          gl_FragColor =
            vec4(
              vec3(1.0),
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

/* =========================================================
   DOBLE LATIDO
   ========================================================= */

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

/* =========================================================
   BOTÓN REVERSO
   ========================================================= */

function createFlipButton() {

  const button =
    document.createElement("button");

  button.id =
    "flip-button";

  button.textContent =
    "Ver reverso";

  Object.assign(
    button.style,
    {
      position: "fixed",
      right: "18px",
      top: "50%",
      transform: "translateY(-50%)",

      zIndex: "9999",

      padding: "13px 16px",

      border: "none",
      borderRadius: "18px",

      background:
        "rgba(190,165,216,0.94)",

      color:
        "#fffaf0",

      fontFamily:
        "'Comic Sans MS', 'Trebuchet MS', sans-serif",

      fontSize: "15px",
      fontWeight: "600",

      boxShadow:
        "0 5px 18px rgba(80,55,100,0.22)",

      cursor: "pointer",

      display: "none",

      transition:
        "transform .2s ease, opacity .2s ease"
    }
  );

  button.addEventListener(
    "mouseenter",
    () => {
      if (
        flipState !==
        "flipping"
      ) {
        button.style.transform =
          "translateY(-50%) scale(1.04)";
      }
    }
  );

  button.addEventListener(
    "mouseleave",
    () => {
      button.style.transform =
        "translateY(-50%) scale(1)";
    }
  );

  button.addEventListener(
    "click",
    () => {

      if (
        flipState ===
        "flipping"
      ) return;

      if (
        !targetVisible
      ) return;

      if (
        flipState ===
        "front"
      ) {

        startFlip(
          0,
          Math.PI
        );

      } else {

        startFlip(
          Math.PI,
          0
        );
      }
    }
  );

  document.body.appendChild(
    button
  );

  return button;
}

/* =========================================================
   MAGIA DEL GIRO
   ========================================================= */

function createFlipMagic() {

  flipMagicGroup =
    new THREE.Group();

  const particleCount = 46;

  const geometry =
    new THREE.BufferGeometry();

  const positions =
    new Float32Array(
      particleCount * 3
    );

  const velocities = [];

  for (
    let i = 0;
    i < particleCount;
    i++
  ) {

    const angle =
      Math.random() *
      Math.PI *
      2;

    const radius =
      0.015 +
      Math.random() * 0.05;

    positions[i * 3] =
      Math.cos(angle) *
      radius;

    positions[i * 3 + 1] =
      Math.sin(angle) *
      radius;

    positions[i * 3 + 2] =
      0.01;

    velocities.push({
      x:
        Math.cos(angle) *
        (
          0.015 +
          Math.random() * 0.025
        ),

      y:
        Math.sin(angle) *
        (
          0.015 +
          Math.random() * 0.025
        ),

      z:
        (
          Math.random() -
          0.5
        ) *
        0.015
    });
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      positions,
      3
    )
  );

  const material =
    new THREE.PointsMaterial({
      color: 0xffd978,
      size: 0.018,
      transparent: true,
      opacity: 0,
      depthTest: false,
      blending:
        THREE.AdditiveBlending
    });

  const particles =
    new THREE.Points(
      geometry,
      material
    );

  particles.userData.velocities =
    velocities;

  flipMagicGroup.add(
    particles
  );

  /* FLASH */

  const flashMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xfff4cf,
      transparent: true,
      opacity: 0,
      depthTest: false,
      blending:
        THREE.AdditiveBlending
    });

  const flash =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.22,
        0.22
      ),
      flashMaterial
    );

  flash.position.z =
    0.025;

  flash.renderOrder =
    1000;

  flipMagicGroup.add(
    flash
  );

  flipFlash =
    flash;

  return flipMagicGroup;
}

/* =========================================================
   COMENZAR GIRO
   ========================================================= */

function startFlip(
  from,
  to
) {

  if (
    flipState ===
    "flipping"
  ) return;

  if (
    !targetVisible
  ) return;

  flipState =
    "flipping";

  flipFrom =
    from;

  flipTo =
    to;

  flipStartTime =
    performance.now();

  if (flipButton) {
    flipButton.style.display =
      "none";
  }

  if (
    flipMagicGroup
  ) {

    flipMagicGroup.visible =
      true;

    flipMagicGroup.position.set(
      0,
      0,
      0.04
    );

    const particles =
      flipMagicGroup.children[0];

    particles.material.opacity =
      0.95;

    const positions =
      particles.geometry.attributes
        .position.array;

    for (
      let i = 0;
      i < positions.length;
      i += 3
    ) {

      const angle =
        Math.random() *
        Math.PI *
        2;

      const radius =
        0.015 +
        Math.random() *
        0.04;

      positions[i] =
        Math.cos(angle) *
        radius;

      positions[i + 1] =
        Math.sin(angle) *
        radius;

      positions[i + 2] =
        0.02;
    }

    particles.geometry.attributes
      .position.needsUpdate = true;
  }

  if (flipFlash) {

    flipFlash.material.opacity =
      0.0;

    flipFlash.scale.set(
      0.25,
      0.25,
      1
    );
  }
}

/* =========================================================
   ACTUALIZAR GIRO
   ========================================================= */

function updateFlip() {

  if (
    flipState !==
    "flipping"
  ) return;

  const elapsed =
    (
      performance.now() -
      flipStartTime
    ) /
    1000;

  const t =
    clamp01(
      elapsed /
      FLIP_DURATION
    );

  const eased =
    0.5 -
    Math.cos(
      t * Math.PI
    ) *
    0.5;

  const angle =
    flipFrom +
    (
      flipTo -
      flipFrom
    ) *
    eased;

  if (flipContainer) {

    flipContainer.rotation.y =
      angle;
  }

  /*
   * Cambiamos de cara exactamente
   * alrededor de los 90°.
   */

  if (frontGroup && backGroup) {

    const facing =
      Math.cos(angle);

    if (facing >= 0) {

      frontGroup.visible =
        true;

      backGroup.visible =
        false;

    } else {

      frontGroup.visible =
        false;

      backGroup.visible =
        true;
    }
  }

  /* MAGIA */

  if (
    flipMagicGroup
  ) {

    const particles =
      flipMagicGroup.children[0];

    const positions =
      particles.geometry.attributes
        .position.array;

    const velocities =
      particles.userData
        .velocities;

    for (
      let i = 0;
      i < positions.length;
      i += 3
    ) {

      positions[i] +=
        velocities[i / 3].x;

      positions[i + 1] +=
        velocities[i / 3].y;

      positions[i + 2] +=
        velocities[i / 3].z;
    }

    particles.geometry.attributes
      .position.needsUpdate = true;

    const sparkleFade =
      1 -
      easeOutCubic(
        Math.max(
          0,
          t - 0.35
        ) / 0.65
      );

    particles.material.opacity =
      0.9 *
      sparkleFade;
  }

  /* FLASH */

  if (flipFlash) {

    let flashIntensity = 0;

    if (t < 0.18) {

      flashIntensity =
        Math.sin(
          (
            t /
            0.18
          ) *
          Math.PI
        );

    } else if (
      t > 0.78 &&
      t < 1
    ) {

      flashIntensity =
        Math.sin(
          (
            (t - 0.78) /
            0.22
          ) *
          Math.PI
        ) *
        0.7;
    }

    flipFlash.material.opacity =
      flashIntensity *
      0.9;

    const flashScale =
      0.25 +
      flashIntensity *
      1.8;

    flipFlash.scale.set(
      flashScale,
      flashScale,
      1
    );
  }

  if (
    t >= 1
  ) {

    finishFlip();
  }
}

/* =========================================================
   FINALIZAR GIRO
   ========================================================= */

function finishFlip() {

  flipContainer.rotation.y =
    flipTo;

  flipState =
    flipTo === 0
      ? "front"
      : "back";

  if (frontGroup && backGroup) {

    if (
      flipState ===
      "front"
    ) {

      frontGroup.visible =
        true;

      backGroup.visible =
        false;

    } else {

      frontGroup.visible =
        false;

      backGroup.visible =
        true;
    }
  }

  if (flipMagicGroup) {

    flipMagicGroup.visible =
      false;
  }

  if (flipFlash) {

    flipFlash.material.opacity =
      0;
  }

  if (flipButton) {

    flipButton.textContent =
      flipState === "front"
        ? "Ver reverso"
        : "Volver al frente";

    if (
      targetVisible
    ) {

      flipButton.style.display =
        "block";
    }
  }
}

/* =========================================================
   START AR
   ========================================================= */

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

        /*
         * ESTA CONFIGURACIÓN
         * ES LA QUE YA NOS DIO
         * UN TRACKING ESTABLE.
         */

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

    const anchor =
      mindarThree.addAnchor(0);

    /* =====================================================
       GRUPO ESTABILIZADO
       ===================================================== */

    const stabilizedGroup =
      new THREE.Group();

    scene.add(
      stabilizedGroup
    );

    stabilizedGroup.visible =
      false;

    /* =====================================================
       CONTENEDOR DEL GIRO
       ===================================================== */

    flipContainer =
      new THREE.Group();

    stabilizedGroup.add(
      flipContainer
    );

    frontGroup =
      new THREE.Group();

    backGroup =
      new THREE.Group();

    flipContainer.add(
      frontGroup
    );

    flipContainer.add(
      backGroup
    );

    frontGroup.visible =
      true;

    backGroup.visible =
      false;

    /* =====================================================
       TEXTURAS
       ===================================================== */

    const textureLoader =
      new THREE.TextureLoader();

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

    /* =====================================================
       CAPAS DEL FRENTE
       ===================================================== */

    for (
      const layer of layers
    ) {

      let texture;

      try {

        texture =
          await textureLoader.loadAsync(
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
            1
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
      ] =
        mesh;

      frontGroup.add(
        mesh
      );
    }

    /* =====================================================
       BRILLOS
       ===================================================== */

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

    /* =====================================================
       ONDA + HALO
       ===================================================== */

    const revealWave =
      createRevealWave(
        commonPosition,
        45
      );

    frontGroup.add(
      revealWave
    );

    const crossHalo =
      createCrossHalo(
        commonPosition,
        6.4
      );

    frontGroup.add(
      crossHalo
    );

    /* =====================================================
       ESTADO INICIAL
       ===================================================== */

    for (
      const file of
      Object.keys(layerMeshes)
    ) {

      layerMeshes[
        file
      ].material.opacity =
        0;
    }

    for (
      const file of
      Object.keys(glowMeshes)
    ) {

      glowMeshes[
        file
      ].material.opacity =
        0;
    }

    revealWave.material
      .uniforms
      .progress.value =
      -1;

    revealWave.material
      .uniforms
      .intensity.value =
      0;

    crossHalo.material
      .uniforms
      .intensity.value =
      0;

    /* =====================================================
       REVERSO
       ===================================================== */

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

        side:
          THREE.DoubleSide,

        depthTest:
          false,

        depthWrite:
          false,

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

    backMesh.position.z +=
      0.002;

    backMesh.renderOrder =
      0;

    /*
     * Esta rotación hace que,
     * después del giro de 180°,
     * el reverso quede correctamente
     * orientado hacia la cámara.
     */

    backGroup.rotation.y =
      Math.PI;

    backGroup.add(
      backMesh
    );

    /* =====================================================
       MAGIA DEL FLIP
       ===================================================== */

    flipMagicGroup =
      createFlipMagic();

    flipMagicGroup.visible =
      false;

    flipContainer.add(
      flipMagicGroup
    );

    /* =====================================================
       BOTÓN
       ===================================================== */

    if (!flipButton) {

      flipButton =
        createFlipButton();
    }

    /* =====================================================
       TRACKING ESTABILIZADO
       ===================================================== */

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

      anchor.group.updateMatrixWorld(
        true
      );

      anchor.group.matrixWorld.decompose(

        rawPosition,

        rawQuaternion,

        rawScale
      );

      if (
        !stabilizerReady
      ) {

        stabilizedGroup.position.copy(
          rawPosition
        );

        stabilizedGroup.quaternion.copy(
          rawQuaternion
        );

        stabilizedGroup.scale.copy(
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

      stabilizedGroup.position.lerp(
        rawPosition,
        positionAlpha
      );

      stabilizedGroup.quaternion.slerp(
        rawQuaternion,
        rotationAlpha
      );

      stabilizedGroup.scale.lerp(
        rawScale,
        scaleAlpha
      );
    }

    /* =====================================================
       TARGET ENCONTRADO
       ===================================================== */

    let targetFoundTime =
      null;

    anchor.onTargetFound =
      () => {

        targetFoundTime =
          performance.now();

        targetVisible =
          true;

        /*
         * Siempre que volvemos a detectar
         * la estampita empezamos mostrando
         * el frente.
         */

        flipState =
          "front";

        flipContainer.rotation.y =
          0;

        frontGroup.visible =
          true;

        backGroup.visible =
          false;

        if (flipButton) {

          flipButton.textContent =
            "Ver reverso";

          flipButton.style.display =
            "none";
        }

        for (
          const file of
          Object.keys(layerMeshes)
        ) {

          layerMeshes[
            file
          ].material.opacity =
            1;

          if (
            layerMeshes[file]
              .material
              .userData
              .revealUniforms
          ) {

            layerMeshes[file]
              .material
              .userData
              .revealUniforms
              .revealProgress
              .value =
              1.1;
          }
        }

        for (
          const file of
          Object.keys(glowMeshes)
        ) {

          glowMeshes[
            file
          ].material.opacity =
            0;
        }

        revealWave.material
          .uniforms
          .progress.value =
          -1;

        revealWave.material
          .uniforms
          .intensity.value =
          0;

        crossHalo.material
          .uniforms
          .intensity.value =
          0;

        status.textContent =
          "¡La estampita cobró vida!";

        status.classList.remove(
          "hidden"
        );
      };

    /* =====================================================
       TARGET PERDIDO
       ===================================================== */

    anchor.onTargetLost =
      () => {

        targetFoundTime =
          null;

        targetVisible =
          false;

        stabilizerReady =
          false;

        stabilizedGroup.visible =
          false;

        flipState =
          "front";

        flipContainer.rotation.y =
          0;

        frontGroup.visible =
          true;

        backGroup.visible =
          false;

        if (flipButton) {

          flipButton.style.display =
            "none";
        }

        if (flipMagicGroup) {

          flipMagicGroup.visible =
            false;
        }

        for (
          const file of
          Object.keys(layerMeshes)
        ) {

          layerMeshes[
            file
          ].material.opacity =
            0;
        }

        for (
          const file of
          Object.keys(glowMeshes)
        ) {

          glowMeshes[
            file
          ].material.opacity =
            0;
        }

        revealWave.material
          .uniforms
          .progress.value =
          -1;

        revealWave.material
          .uniforms
          .intensity.value =
          0;

        crossHalo.material
          .uniforms
          .intensity.value =
          0;

        status.textContent =
          "Apuntá la cámara a la estampita";

        status.classList.remove(
          "hidden"
        );
      };

    /* =====================================================
       INICIAR CÁMARA
       ===================================================== */

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

    /* =====================================================
       LOOP
       ===================================================== */

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

        /* TRACKING */

        if (
          targetVisible
        ) {

          stabilizedGroup.visible =
            true;

          updateTrackingStabilizer(
            delta
          );

        } else {

          stabilizedGroup.visible =
            false;

          stabilizerReady =
            false;
        }

        let elapsed =
          999;

        if (
          targetFoundTime !==
          null
        ) {

          elapsed =
            (
              performance.now() -
              targetFoundTime
            ) /
            1000;
        }

        /* =================================================
           ANIMACIÓN DEL FRENTE
           ================================================= */

        if (
          targetVisible &&
          flipState !== "back" &&
          flipState !== "flipping"
        ) {

          /* FONDO */

          layerMeshes[
            "fondo-limpio.png"
          ].material.opacity =
            easeOutCubic(
              elapsed / 0.35
            );

          /* NENA */

          const girlProgress =
            easeOutCubic(
              (
                elapsed -
                0.12
              ) /
              0.70
            );

          [
            "nena-cuerpo.png",
            "nena-flores.png",
            "nena-cara.png",
            "nena-pelo.png",
            "nena-corona.png"
          ].forEach(
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                girlProgress;
            }
          );

          /* GATITOS */

          const catProgress =
            easeOutCubic(
              (
                elapsed -
                0.30
              ) /
              0.70
            );

          [
            "gatito-superior.png",
            "gatito-inferior.png"
          ].forEach(
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                catProgress;
            }
          );

          /* PINCELADA */

          layerMeshes[
            "pincelada-lila.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.05
              ) /
              0.55
            );

          /* TEXTO COMUNIÓN */

          layerMeshes[
            "texto-comunion.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.18
              ) /
              0.85
            );

          /* TEXTO JESÚS */

          layerMeshes[
            "texto-jesus.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.35
              ) /
              0.85
            );

          /* CRUZ */

          layerMeshes[
            "cruz.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.20
              ) /
              0.65
            );

          /* CORAZONES */

          const heartProgress =
            easeOutCubic(
              (
                elapsed -
                0.25
              ) /
              0.65
            );

          layerMeshes[
            "corazon-superior.png"
          ].material.opacity =
            heartProgress;

          layerMeshes[
            "corazon-inferior.png"
          ].material.opacity =
            heartProgress;

          /* DECORACIÓN */

          const decorationProgress =
            easeOutCubic(
              (
                elapsed -
                0.30
              ) /
              0.75
            );

          [
            "corazones.png",
            "estrellas.png",
            "destellos.png",
            "marco-corazones.png"
          ].forEach(
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                decorationProgress;
            }
          );
        }

        /* =================================================
           PELO
           ================================================= */

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

        /* =================================================
           CORONA
           ================================================= */

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

        /* =================================================
           GATITO SUPERIOR
           ================================================= */

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

        /* =================================================
           GATITO INFERIOR
           ================================================= */

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

        /* =================================================
           CORAZONES DECORATIVOS
           ================================================= */

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
          targetVisible
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
            beat * 0.18;

          decorativeHeartGlow
            .material
            .opacity =
            beat * 0.48;
        }

        /* =================================================
           CORAZÓN SUPERIOR
           ================================================= */

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
          targetVisible
        ) {

          const beat =
            doubleBeat(
              time,
              4.0,
              0
            );

          heartTop.material.opacity =
            0.84 +
            beat * 0.16;

          heartTopGlow.material.opacity =
            beat * 0.42;
        }

        /* =================================================
           CORAZÓN INFERIOR
           ================================================= */

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
          targetVisible
        ) {

          const beat =
            doubleBeat(
              time,
              4.0,
              1.8
            );

          heartBottom.material.opacity =
            0.84 +
            beat * 0.16;

          heartBottomGlow.material.opacity =
            beat * 0.42;
        }

        /* =================================================
           REVELACIÓN WOW
           ================================================= */

        if (
          targetVisible &&
          flipState !== "back" &&
          flipState !== "flipping"
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
            elapsed >= 0.35 &&
            elapsed < 1.30
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
            elapsed >= 1.30 &&
            elapsed < 2.10
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
                ignition * 0.18 +
                ambientPulse
              );
          }

          if (crossGlow) {

            crossGlow.material.opacity =
              Math.min(
                1,
                ignition * 1.15 +
                ambientPulse * 0.5
              );
          }

          crossHalo.material
            .uniforms
            .intensity.value =
            Math.min(
              1,
              ignition * 1.25
            );

          /* ONDA */

          if (
            elapsed >= 0.50 &&
            elapsed <= 2.15
          ) {

            const p =
              (
                elapsed -
                0.50
              ) /
              1.65;

            const wave =
              easeInOut(p);

            revealWave.material
              .uniforms
              .progress.value =
              1.02 -
              wave * 1.22;

            const edge =
              Math.sin(
                p * Math.PI
              );

            revealWave.material
              .uniforms
              .intensity.value =
              0.78 *
              edge;

          } else {

            revealWave.material
              .uniforms
              .intensity.value =
              0;
          }
        }

        /* =================================================
           DESTELLOS
           ================================================= */

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
          targetVisible
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
            sparkle * 0.82;

          sparkleGlow.material.opacity =
            0.08 +
            sparkle * 0.90;
        }

        /* =================================================
           ESTRELLAS
           ================================================= */

        const stars =
          layerMeshes[
            "estrellas.png"
          ];

        if (
          stars &&
          targetVisible
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
            starWave * 0.32;
        }

        /* =================================================
           BRILLO TEXTOS
           ================================================= */

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
            flipState !== "front" ||
            elapsed <
              startDelay
          ) {

            if (glow) {

              glow.material.opacity =
                0;
            }

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
            cycle < duration
          ) {

            const progress =
              cycle /
              duration;

            glow.material
              .uniforms
              .progress
              .value =
              -0.15 +
              progress * 1.30;

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
              intensity * 0.65;

            glow.material.opacity =
              0.35 +
              intensity * 0.65;

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

        /* =================================================
           BOTÓN
           ================================================= */

        if (
          targetVisible &&
          flipState !== "flipping" &&
          elapsed > 4.2
        ) {

          if (
            flipButton &&
            flipButton.style.display !==
              "block"
          ) {

            flipButton.textContent =
              flipState === "front"
                ? "Ver reverso"
                : "Volver al frente";

            flipButton.style.display =
              "block";
          }
        }

        /* =================================================
           FLIP
           ================================================= */

        updateFlip();

        /* =================================================
           RENDER
           ================================================= */

        renderer.render(
          scene,
          camera
        );
      });

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

        mindarThree.renderer
          .setAnimationLoop(null);

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
      JSON.stringify(error)
    );
  }
}

/* =========================================================
   DETENER AR
   ========================================================= */

function stopAR() {

  if (
    !mindarThree
  ) return;

  mindarThree.stop();

  mindarThree.renderer
    .setAnimationLoop(null);

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

  targetVisible =
    false;

  flipState =
    "front";
}

/* =========================================================
   EVENTOS
   ========================================================= */

startButton.addEventListener(
  "click",
  startAR
);

stopButton.addEventListener(
  "click",
  stopAR
);
