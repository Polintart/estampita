import * as THREE from "three";
import { MindARThree } from "mind-ar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const status = document.querySelector("#status");

let mindarThree = null;
let layerMeshes = [];
let frontGroup = null;
let backGroup = null;
let flipContainer = null;
let stabilizedGroup = null;
let flipButton = null;
let flipMagic = null;
let targetVisible = false;

let flipState = "front";
let flipStartTime = 0;
let flipFrom = 0;
let flipTo = 0;

const FLIP_DURATION = 1.55;

const REVEAL_START = 0.45;
const REVEAL_DURATION = 3.50;
const REVEAL_INITIAL = -0.10;

const POSITION_RESPONSE = 9;
const ROTATION_RESPONSE = 11;
const SCALE_RESPONSE = 9;

let revealMaterials = [];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function ease(t) {
  t = clamp(t, 0, 1);

  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothFactor(response, dt) {
  return 1 - Math.exp(-response * dt);
}

function smoothstep01(x) {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
}

function setStatus(text) {
  if (status) {
    status.textContent = text;
  }
}


// ============================================================
// REVELADO ORGÁNICO
// ============================================================

function applyRevealMask(material) {

  material.transparent = true;
  material.depthWrite = false;

  const uniforms = {
    revealProgress: {
      value: REVEAL_INITIAL
    },

    revealGlow: {
      value: 0
    }
  };

  material.onBeforeCompile = (shader) => {

    shader.uniforms.revealProgress =
      uniforms.revealProgress;

    shader.uniforms.revealGlow =
      uniforms.revealGlow;

    shader.fragmentShader =
      shader.fragmentShader.replace(
        "#include <map_pars_fragment>",

        `
        #include <map_pars_fragment>

        uniform float revealProgress;
        uniform float revealGlow;
        `
      );

    shader.fragmentShader =
      shader.fragmentShader.replace(
        "#include <map_fragment>",

        `
        #include <map_fragment>

        float organicWave =
          sin(vMapUv.x * 8.0 + revealProgress * 5.0)
          * 0.018;

        organicWave +=
          sin(vMapUv.x * 17.0 - revealProgress * 7.0)
          * 0.012;

        organicWave +=
          sin(vMapUv.x * 31.0 + revealProgress * 3.0)
          * 0.007;

        organicWave +=
          sin(vMapUv.x * 4.5 + revealProgress * 11.0)
          * 0.020;

        float organicY =
          sin(vMapUv.y * 18.0 + vMapUv.x * 9.0)
          * 0.006;

        float revealEdge =
          revealProgress +
          organicWave +
          organicY;

        float revealAmount =
          smoothstep(
            revealEdge - 0.030,
            revealEdge + 0.030,
            vMapUv.y
          );

        diffuseColor.a *= revealAmount;

        float edgeDistance =
          abs(vMapUv.y - revealEdge);

        float edgeGlow =
          smoothstep(
            0.075,
            0.0,
            edgeDistance
          ) * revealGlow;

        diffuseColor.rgb +=
          vec3(1.0, 0.68, 0.20)
          * edgeGlow;
        `
      );
  };

  material.userData.revealUniforms =
    uniforms;

  revealMaterials.push(material);
}


// ============================================================
// BRILLO DE TEXTOS
// ============================================================

function createSweepGlow(texture) {

  const material =
    new THREE.ShaderMaterial({

      transparent: true,

      depthWrite: false,

      blending:
        THREE.AdditiveBlending,

      uniforms: {

        uTexture: {
          value: texture
        },

        uTime: {
          value: 0
        },

        uOpacity: {
          value: 0
        }
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

        uniform sampler2D uTexture;
        uniform float uTime;
        uniform float uOpacity;

        varying vec2 vUv;

        void main() {

          vec4 tex =
            texture2D(
              uTexture,
              vUv
            );

          float cycle =
            mod(uTime, 5.2);

          float sweep1 =
            smoothstep(
              0.0,
              0.12,
              cycle
            )
            *
            (
              1.0 -
              smoothstep(
                0.12,
                2.05,
                cycle
              )
            );

          float sweep2 =
            smoothstep(
              0.0,
              0.12,
              cycle - 2.65
            )
            *
            (
              1.0 -
              smoothstep(
                0.12,
                2.10,
                cycle - 2.65
              )
            );

          float x1 =
            cycle / 2.05;

          float x2 =
            (cycle - 2.65) / 2.10;

          float band1 =
            exp(
              -pow(
                (vUv.x - x1) / 0.055,
                2.0
              )
            );

          float band2 =
            exp(
              -pow(
                (vUv.x - x2) / 0.055,
                2.0
              )
            );

          float shine =
            max(
              band1 * sweep1,
              band2 * sweep2
            );

          shine *= tex.a;
          shine *= uOpacity;

          vec3 light =
            vec3(
              1.0,
              0.92,
              0.68
            );

          gl_FragColor =
            vec4(
              light,
              shine
            );
        }
      `
    });

  return new THREE.Mesh(
    new THREE.PlaneGeometry(
      1,
      1.5
    ),
    material
  );
}


// ============================================================
// OLA DORADA DEL REVELADO
// ============================================================

function createRevealWave() {

  const material =
    new THREE.ShaderMaterial({

      transparent: true,

      depthWrite: false,

      blending:
        THREE.AdditiveBlending,

      uniforms: {

        uTime: {
          value: 0
        },

        uProgress: {
          value: 0
        },

        uOpacity: {
          value: 0
        }
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

        uniform float uTime;
        uniform float uProgress;
        uniform float uOpacity;

        varying vec2 vUv;

        void main() {

          float waveY =
            1.0 - uProgress;

          float organic =
            sin(
              vUv.x * 11.0 +
              uTime * 1.7
            ) * 0.018;

          organic +=
            sin(
              vUv.x * 23.0 -
              uTime * 2.1
            ) * 0.009;

          float distanceFromWave =
            abs(
              vUv.y -
              waveY -
              organic
            );

          float glow =
            smoothstep(
              0.09,
              0.0,
              distanceFromWave
            );

          glow *=
            smoothstep(
              0.0,
              0.10,
              uProgress
            );

          glow *=
            1.0 -
            smoothstep(
              0.92,
              1.0,
              uProgress
            );

          vec3 warm =
            mix(
              vec3(
                1.0,
                0.62,
                0.16
              ),
              vec3(
                1.0,
                0.92,
                0.55
              ),
              uProgress
            );

          gl_FragColor =
            vec4(
              warm,
              glow * uOpacity
            );
        }
      `
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        1.02,
        1.52
      ),
      material
    );

  mesh.position.z =
    0.018;

  return mesh;
}


// ============================================================
// BOTÓN
// ============================================================

function createFlipButton() {

  flipButton =
    document.createElement("button");

  flipButton.textContent =
    "Ver reverso";

  Object.assign(
    flipButton.style,
    {
      position: "fixed",
      right: "18px",
      top: "50%",
      transform:
        "translateY(-50%)",
      zIndex: "9999",
      display: "none",
      border: "0",
      padding: "12px 14px",
      borderRadius: "18px",
      background:
        "rgba(190,165,216,0.94)",
      color: "#fffaf2",
      fontFamily:
        "'Comic Sans MS', 'Trebuchet MS', sans-serif",
      fontSize: "14px",
      fontWeight: "600",
      boxShadow:
        "0 5px 18px rgba(80,50,90,0.20)",
      cursor: "pointer",
      WebkitTapHighlightColor:
        "transparent"
    }
  );

  flipButton.addEventListener(
    "click",
    () => {

      if (flipState === "front") {

        startFlip(
          0,
          Math.PI
        );

      } else if (
        flipState === "back"
      ) {

        startFlip(
          Math.PI,
          0
        );
      }
    }
  );

  document.body.appendChild(
    flipButton
  );
}


// ============================================================
// MAGIA DEL GIRO
// ============================================================

function createFlipMagic() {

  const group =
    new THREE.Group();

  for (
    let i = 0;
    i < 46;
    i++
  ) {

    const geometry =
      new THREE.SphereGeometry(
        0.006 +
          Math.random() * 0.007,
        6,
        6
      );

    const material =
      new THREE.MeshBasicMaterial({

        color:
          0xffd978,

        transparent: true,

        opacity: 0,

        blending:
          THREE.AdditiveBlending,

        depthWrite: false
      });

    const particle =
      new THREE.Mesh(
        geometry,
        material
      );

    particle.userData = {

      angle:
        Math.random() *
        Math.PI *
        2,

      radius:
        0.03 +
        Math.random() *
        0.34,

      speed:
        0.8 +
        Math.random() *
        1.8,

      height:
        (
          Math.random() -
          0.5
        ) * 0.45
    };

    group.add(
      particle
    );
  }

  const flash =
    new THREE.Mesh(

      new THREE.PlaneGeometry(
        0.55,
        0.82
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xffefb0,

        transparent: true,

        opacity: 0,

        blending:
          THREE.AdditiveBlending,

        depthWrite: false
      })
    );

  flash.position.z =
    0.025;

  group.add(
    flash
  );

  group.visible =
    false;

  return group;
}


// ============================================================
// FLIP
// ============================================================

function startFlip(
  from,
  to
) {

  if (
    flipState === "flipping" ||
    !targetVisible
  ) {
    return;
  }

  flipState =
    "flipping";

  flipStartTime =
    performance.now() /
    1000;

  flipFrom =
    from;

  flipTo =
    to;

  flipContainer.rotation.y =
    from;

  if (flipButton) {
    flipButton.style.display =
      "none";
  }

  if (flipMagic) {

    flipMagic.visible =
      true;

    flipMagic.children.forEach(
      (child) => {

        if (child.material) {
          child.material.opacity =
            0;
        }
      }
    );
  }
}


function updateFlip(time) {

  if (
    flipState !== "flipping"
  ) {
    return;
  }

  const progress =
    clamp(
      (
        time -
        flipStartTime
      ) /
      FLIP_DURATION,
      0,
      1
    );

  const eased =
    ease(progress);

  flipContainer.rotation.y =
    THREE.MathUtils.lerp(
      flipFrom,
      flipTo,
      eased
    );

  const facing =
    Math.cos(
      flipContainer.rotation.y
    );

  frontGroup.visible =
    facing >= 0;

  backGroup.visible =
    facing < 0;

  if (flipMagic) {

    const burst =
      Math.sin(
        progress *
        Math.PI
      );

    flipMagic.children.forEach(
      (child, index) => {

        if (
          index ===
          flipMagic.children.length - 1
        ) {

          child.material.opacity =
            burst *
            burst *
            0.75;

          child.scale.setScalar(
            0.75 +
            burst *
            1.6
          );

          return;
        }

        const data =
          child.userData;

        const angle =
          data.angle +
          time *
          data.speed;

        const radius =
          data.radius *
          (
            0.35 +
            burst *
            1.15
          );

        child.position.x =
          Math.cos(angle) *
          radius;

        child.position.y =
          Math.sin(angle) *
            radius +
          data.height *
            burst;

        child.position.z =
          0.02 +
          Math.sin(
            angle * 1.7
          ) *
          0.03;

        child.material.opacity =
          burst *
          0.85;
      }
    );
  }

  if (progress >= 1) {
    finishFlip();
  }
}


function finishFlip() {

  flipContainer.rotation.y =
    flipTo;

  const showingFront =
    flipTo === 0;

  flipState =
    showingFront
      ? "front"
      : "back";

  frontGroup.visible =
    showingFront;

  backGroup.visible =
    !showingFront;

  if (flipButton) {

    flipButton.textContent =
      showingFront
        ? "Ver reverso"
        : "Volver al frente";

    if (targetVisible) {
      flipButton.style.display =
        "block";
    }
  }

  if (flipMagic) {
    flipMagic.visible =
      false;
  }
}


// ============================================================
// AR
// ============================================================

async function startAR() {

  if (mindarThree) {
    return;
  }

  if (startButton) {
    startButton.disabled =
      true;
  }

  setStatus(
    "Activando cámara…"
  );

  mindarThree =
    new MindARThree({

      container:
        document.body,

      imageTargetSrc:
        "./targets/estampita.mind",

      filterMinCF:
        0.0005,

      filterBeta:
        1000,

      warmupTolerance:
        5,

      missTolerance:
        8
    });

  const {
    renderer,
    scene,
    camera
  } = mindarThree;

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio ||
        1,
      2
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  // ==========================================================
  // ESTRUCTURA
  // ==========================================================

  stabilizedGroup =
    new THREE.Group();

  scene.add(
    stabilizedGroup
  );

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

  backGroup.rotation.y =
    Math.PI;

  backGroup.visible =
    false;


  // ==========================================================
  // TARGET
  // ==========================================================

  const anchor =
    mindarThree.addAnchor(0);


  // ==========================================================
  // TEXTURAS
  // ==========================================================

  const textureLoader =
    new THREE.TextureLoader();

  const layerNames = [

    "fondo-limpio.png",
    "marco-corazones.png",

    "nena-cuerpo.png",
    "nena-cara.png",
    "nena-pelo.png",
    "nena-corona.png",
    "nena-flores.png",

    "texto-comunion.png",
    "texto-jesus.png",

    "cruz.png",
    "destellos.png",
    "estrellas.png",
    "corazones.png",

    "corazon-superior.png",
    "corazon-inferior.png",

    "gatito-superior.png",
    "gatito-inferior.png",

    "pincelada-lila.png"
  ];

  const textures = {};

  for (
    const name of layerNames
  ) {

    textures[name] =
      await new Promise(
        (
          resolve,
          reject
        ) => {

          textureLoader.load(

            `./assets/animation/${name}`,

            (texture) => {

              texture.colorSpace =
                THREE.SRGBColorSpace;

              texture.minFilter =
                THREE.LinearFilter;

              texture.magFilter =
                THREE.LinearFilter;

              texture.generateMipmaps =
                false;

              resolve(texture);
            },

            undefined,

            reject
          );
        }
      );
  }


  // ==========================================================
  // FRENTE
  // ==========================================================

  const geometry =
    new THREE.PlaneGeometry(
      1,
      1.5
    );

  layerMeshes = [];

  layerNames.forEach(
    (name, index) => {

      const material =
        new THREE.MeshBasicMaterial({

          map:
            textures[name],

          transparent:
            true,

          opacity:
            1,

          depthWrite:
            false,

          side:
            THREE.DoubleSide
        });

      // IMPORTANTE:
      // El revelado se aplica a todas las capas,
      // pero su progreso ahora se actualiza correctamente.
      applyRevealMask(
        material
      );

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      mesh.position.z =
        index * 0.0005;

      mesh.userData.layerName =
        name;

      frontGroup.add(
        mesh
      );

      layerMeshes.push(
        mesh
      );
    }
  );


  // ==========================================================
  // REVERSO
  // ==========================================================

  const backMaterial =
    new THREE.MeshBasicMaterial({

      map:
        textures[
          "fondo-limpio.png"
        ],

      transparent:
        true,

      opacity:
        1,

      side:
        THREE.DoubleSide,

      depthWrite:
        false
    });

  const backMesh =
    new THREE.Mesh(
      geometry,
      backMaterial
    );

  backMesh.position.z =
    -0.002;

  backGroup.add(
    backMesh
  );


  // ==========================================================
  // OLA
  // ==========================================================

  const revealWave =
    createRevealWave();

  frontGroup.add(
    revealWave
  );


  // ==========================================================
  // HALO CRUZ
  // ==========================================================

  const crossHalo =
    new THREE.Mesh(

      new THREE.PlaneGeometry(
        0.36,
        0.50
      ),

      new THREE.MeshBasicMaterial({

        transparent:
          true,

        opacity:
          0,

        color:
          0xffe5a1,

        blending:
          THREE.AdditiveBlending,

        depthWrite:
          false
      })
    );

  crossHalo.position.set(
    0,
    0.15,
    0.012
  );

  frontGroup.add(
    crossHalo
  );


  // ==========================================================
  // BRILLOS TEXTOS
  // ==========================================================

  const comunionSweep =
    createSweepGlow(
      textures[
        "texto-comunion.png"
      ]
    );

  comunionSweep.position.z =
    0.020;

  frontGroup.add(
    comunionSweep
  );


  const jesusSweep =
    createSweepGlow(
      textures[
        "texto-jesus.png"
      ]
    );

  jesusSweep.position.z =
    0.021;

  frontGroup.add(
    jesusSweep
  );


  // ==========================================================
  // FLIP
  // ==========================================================

  flipMagic =
    createFlipMagic();

  flipContainer.add(
    flipMagic
  );

  createFlipButton();


  // ==========================================================
  // ESTABILIZADOR
  // ==========================================================

  let stabilizerReady =
    false;

  let foundAt =
    null;

  const rawPosition =
    new THREE.Vector3();

  const rawQuaternion =
    new THREE.Quaternion();

  const rawScale =
    new THREE.Vector3();

  const smoothQuaternion =
    new THREE.Quaternion();


  // ==========================================================
  // TARGET FOUND
  // ==========================================================

  anchor.onTargetFound =
    () => {

      targetVisible =
        true;

      foundAt =
        performance.now() /
        1000;

      flipState =
        "front";

      flipContainer.rotation.set(
        0,
        0,
        0
      );

      frontGroup.visible =
        true;

      backGroup.visible =
        false;

      if (flipButton) {
        flipButton.style.display =
          "none";
      }


      // Reiniciar revelado
      revealMaterials.forEach(
        (material) => {

          const uniforms =
            material.userData
              .revealUniforms;

          uniforms.revealProgress.value =
            REVEAL_INITIAL;

          uniforms.revealGlow.value =
            0;
        }
      );

      setStatus(
        "¡La estampita cobró vida!"
      );
    };


  // ==========================================================
  // TARGET LOST
  // ==========================================================

  anchor.onTargetLost =
    () => {

      targetVisible =
        false;

      stabilizerReady =
        false;

      foundAt =
        null;

      flipState =
        "front";

      flipContainer.rotation.set(
        0,
        0,
        0
      );

      frontGroup.visible =
        true;

      backGroup.visible =
        false;

      if (flipButton) {
        flipButton.style.display =
          "none";
      }

      if (flipMagic) {
        flipMagic.visible =
          false;
      }

      setStatus(
        "Apuntá nuevamente a la estampita"
      );
    };


  // ==========================================================
  // RENDER
  // ==========================================================

  const clock =
    new THREE.Clock();

  const startTime =
    performance.now() /
    1000;


  function animate() {

    requestAnimationFrame(
      animate
    );

    const time =
      performance.now() /
      1000;

    const dt =
      Math.min(
        clock.getDelta(),
        0.05
      );


    // --------------------------------------------------------
    // TRACKING
    // --------------------------------------------------------

    if (targetVisible) {

      anchor.group.updateMatrixWorld(
        true
      );

      anchor.group.matrixWorld.decompose(
        rawPosition,
        rawQuaternion,
        rawScale
      );

      if (!stabilizerReady) {

        stabilizedGroup.position.copy(
          rawPosition
        );

        stabilizedGroup.quaternion.copy(
          rawQuaternion
        );

        stabilizedGroup.scale.copy(
          rawScale
        );

        smoothQuaternion.copy(
          rawQuaternion
        );

        stabilizerReady =
          true;

      } else {

        stabilizedGroup.position.lerp(
          rawPosition,
          smoothFactor(
            POSITION_RESPONSE,
            dt
          )
        );

        smoothQuaternion.slerp(
          rawQuaternion,
          smoothFactor(
            ROTATION_RESPONSE,
            dt
          )
        );

        stabilizedGroup.quaternion.copy(
          smoothQuaternion
        );

        stabilizedGroup.scale.lerp(
          rawScale,
          smoothFactor(
            SCALE_RESPONSE,
            dt
          )
        );
      }
    }


    // --------------------------------------------------------
    // REVELADO
    // --------------------------------------------------------

    let revealProgress =
      1.05;

    if (
      targetVisible &&
      foundAt !== null
    ) {

      const elapsed =
        time -
        foundAt;

      revealProgress =
        clamp(

          (
            elapsed -
            REVEAL_START
          ) /
          REVEAL_DURATION,

          REVEAL_INITIAL,

          1.08
        );
    }


    revealMaterials.forEach(
      (material) => {

        const uniforms =
          material.userData
            .revealUniforms;

        uniforms.revealProgress.value =
          revealProgress;

        if (
          revealProgress >=
            REVEAL_INITIAL &&
          revealProgress <= 1
        ) {

          uniforms.revealGlow.value =
            Math.sin(

              clamp(
                (
                  revealProgress -
                  REVEAL_INITIAL
                ) / 1.08,

                0,
                1
              ) * Math.PI

            ) * 0.72;

        } else {

          uniforms.revealGlow.value =
            0;
        }
      }
    );


    // --------------------------------------------------------
    // ANIMACIONES DEL FRENTE
    // --------------------------------------------------------

    if (
      flipState ===
      "front"
    ) {

      const findLayer =
        (name) =>
          layerMeshes.find(
            (mesh) =>
              mesh.userData
                .layerName ===
              name
          );


      // Pelo

      const hair =
        findLayer(
          "nena-pelo.png"
        );

      if (hair) {

        hair.position.x =
          Math.sin(
            time * 1.2
          ) * 0.004;

        hair.position.y =
          Math.sin(
            time * 1.5
          ) * 0.002;
      }


      // Corona

      const crown =
        findLayer(
          "nena-corona.png"
        );

      if (crown) {

        crown.position.x =
          Math.sin(
            time * 1.2 +
            0.3
          ) * 0.003;

        crown.position.y =
          Math.sin(
            time * 1.5 +
            0.3
          ) * 0.0015;

        crown.rotation.z =
          Math.sin(
            time * 1.1
          ) * 0.008;
      }


      // Gatito superior

      const catTop =
        findLayer(
          "gatito-superior.png"
        );

      if (catTop) {

        catTop.position.x =
          Math.sin(
            time * 0.75 +
            1.5
          ) * 0.003;

        catTop.position.y =
          Math.sin(
            time +
            0.5
          ) * 0.004;
      }


      // Gatito inferior

      const catBottom =
        findLayer(
          "gatito-inferior.png"
        );

      if (catBottom) {

        catBottom.position.x =
          Math.sin(
            time * 0.65 +
            3.0
          ) * 0.0025;

        catBottom.position.y =
          Math.sin(
            time * 0.9 +
            2.0
          ) * 0.0035;
      }


      // ------------------------------------------------------
      // BRILLO TEXTOS
      // ------------------------------------------------------

      const animationTime =
        time -
        startTime;

      comunionSweep
        .material
        .uniforms
        .uTime
        .value =
        animationTime;

      comunionSweep
        .material
        .uniforms
        .uOpacity
        .value =
        targetVisible
          ? 0.92
          : 0;


      jesusSweep
        .material
        .uniforms
        .uTime
        .value =
        animationTime;

      jesusSweep
        .material
        .uniforms
        .uOpacity
        .value =
        targetVisible
          ? 0.82
          : 0;


      // ------------------------------------------------------
      // OLA DORADA
      // ------------------------------------------------------

      revealWave
        .material
        .uniforms
        .uTime
        .value =
        time;

      revealWave
        .material
        .uniforms
        .uProgress
        .value =
        clamp(
          revealProgress,
          0,
          1
        );

      revealWave
        .material
        .uniforms
        .uOpacity
        .value =

        (
          revealProgress >=
            REVEAL_INITIAL &&
          revealProgress <= 1
        )
          ? 0.95
          : 0;


      // ------------------------------------------------------
      // HALO
      // ------------------------------------------------------

      if (
        foundAt !== null
      ) {

        const sinceFound =
          time -
          foundAt;

        crossHalo.material.opacity =
          smoothstep01(
            sinceFound / 1.1
          ) *
          (
            0.12 +
            Math.sin(
              time * 1.5
            ) * 0.035
          );
      }


      // ------------------------------------------------------
      // BOTÓN
      // ------------------------------------------------------

      if (
        flipButton &&
        targetVisible &&
        flipState !==
          "flipping" &&
        foundAt !== null
      ) {

        const sinceFound =
          time -
          foundAt;

        flipButton.style.display =
          sinceFound > 4.2
            ? "block"
            : "none";
      }
    }


    // --------------------------------------------------------
    // FLIP
    // --------------------------------------------------------

    updateFlip(
      time
    );


    renderer.render(
      scene,
      camera
    );
  }


  animate();


  // ==========================================================
  // START
  // ==========================================================

  await mindarThree.start();

  if (startScreen) {
    startScreen.style.display =
      "none";
  }

  setStatus(
    "Apuntá a la estampita"
  );
}


// ============================================================
// INICIAR
// ============================================================

if (startButton) {

  startButton.addEventListener(
    "click",
    () => {

      startAR().catch(
        (error) => {

          console.error(
            error
          );

          setStatus(
            "No se pudo iniciar la cámara."
          );

          if (startButton) {
            startButton.disabled =
              false;
          }
        }
      );
    }
  );
}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {

    if (!mindarThree) {
      return;
    }

    mindarThree.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
);
