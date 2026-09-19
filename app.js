import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");
const flipButton = document.querySelector("#flip-button");

let mindarThree = null;
let layerMeshes = {};
let glowMeshes = {};

const commonPosition =
  new THREE.Vector3(-0.02, 0, 0.02);

const clamp = v =>
  Math.max(0, Math.min(1, v));

function ease(v) {
  v = clamp(v);

  return 1 -
    Math.pow(
      1 - v,
      3
    );
}

function smooth(v) {
  v = clamp(v);

  return v * v * (3 - 2 * v);
}

/* =========================================================
   MATERIALIZACIÓN ORGÁNICA
   ========================================================= */

function revealMaterial(material) {

  material.userData.revealProgress = 1.1;
  material.userData.revealUniforms = null;

  material.onBeforeCompile = shader => {

    shader.uniforms.revealProgress = {
      value: 1.1
    };

    material.userData.revealUniforms =
      shader.uniforms;

    shader.fragmentShader =
      "uniform float revealProgress;\n" +
      shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `
        float organicWave =
          sin(vMapUv.x * 8.0 +
              revealProgress * 5.0) * 0.018;

        organicWave +=
          sin(vMapUv.x * 17.0 -
              revealProgress * 7.0) * 0.012;

        organicWave +=
          sin(vMapUv.x * 31.0 +
              revealProgress * 3.0) * 0.007;

        organicWave +=
          sin(vMapUv.x * 4.5 +
              revealProgress * 11.0) * 0.020;

        float organicY =
          sin(vMapUv.y * 18.0 +
              vMapUv.x * 9.0) * 0.006;

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

        diffuseColor.a *=
          revealAmount;

        #include <alphatest_fragment>
        `
      );
  };

  material.needsUpdate = true;
}

/* =========================================================
   BRILLO DE TEXTO
   ========================================================= */

function sweepGlow(texture, renderOrder) {

  const material =
    new THREE.ShaderMaterial({

      uniforms: {

        map: {
          value: texture
        },

        progress: {
          value: -10
        },

        width: {
          value: 0.10
        },

        strength: {
          value: 1
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
        uniform sampler2D map;
        uniform float progress;
        uniform float width;
        uniform float strength;

        varying vec2 vUv;

        void main() {

          vec4 tex =
            texture2D(
              map,
              vUv
            );

          if (tex.a < 0.01)
            discard;

          float p =
            vUv.x * 0.90 +
            vUv.y * 0.20;

          float glow =
            1.0 -
            smoothstep(
              0.0,
              width,
              abs(p - progress)
            );

          gl_FragColor =
            vec4(
              vec3(1.0),
              tex.a *
              glow *
              strength
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
      new THREE.PlaneGeometry(
        1,
        1.5
      ),
      material
    );

  mesh.position.set(
    0,
    0,
    0
  );

  mesh.renderOrder =
    renderOrder;

  return mesh;
}

/* =========================================================
   BRILLO ADITIVO
   ========================================================= */

function pulseGlow(texture, renderOrder) {

  const material =
    new THREE.MeshBasicMaterial({

      map: texture,

      transparent: true,

      opacity: 0,

      depthTest: false,

      depthWrite: false,

      blending:
        THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        1,
        1.5
      ),
      material
    );

  mesh.position.set(
    0,
    0,
    0
  );

  mesh.renderOrder =
    renderOrder;

  return mesh;
}

/* =========================================================
   HAZ DE LUZ ORGÁNICO
   ========================================================= */

function createRevealWave(renderOrder) {

  const material =
    new THREE.ShaderMaterial({

      uniforms: {

        progress: {
          value: -1
        },

        intensity: {
          value: 0
        },

        width: {
          value: 0.075
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
        uniform float progress;
        uniform float intensity;
        uniform float width;

        varying vec2 vUv;

        void main() {

          float organicWave =
            sin(vUv.x * 8.0 +
                progress * 5.0) * 0.018;

          organicWave +=
            sin(vUv.x * 17.0 -
                progress * 7.0) * 0.012;

          organicWave +=
            sin(vUv.x * 31.0 +
                progress * 3.0) * 0.007;

          organicWave +=
            sin(vUv.x * 4.5 +
                progress * 11.0) * 0.020;

          float organicEdge =
            progress +
            organicWave;

          float distanceFromEdge =
            abs(
              vUv.y -
              organicEdge
            );

          float core =
            1.0 -
            smoothstep(
              0.0,
              width,
              distanceFromEdge
            );

          float halo =
            1.0 -
            smoothstep(
              0.0,
              width * 4.5,
              distanceFromEdge
            );

          float variation =
            0.78 +
            0.22 *
            sin(
              vUv.x * 12.0 +
              progress * 8.0
            );

          vec3 warmLight =
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

              core
            );

          float alpha =
            (
              core * 0.72 +
              halo * 0.24
            ) *
            intensity *
            variation;

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

      blending:
        THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        1,
        1.5
      ),
      material
    );

  mesh.position.set(
    0,
    0,
    0
  );

  mesh.renderOrder =
    renderOrder;

  return mesh;
}

/* =========================================================
   HALO CÁLIDO DE LA CRUZ
   ========================================================= */

function createCrossHalo(renderOrder) {

  const material =
    new THREE.ShaderMaterial({

      uniforms: {

        intensity: {
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
        uniform float intensity;

        varying vec2 vUv;

        void main() {

          vec2 p =
            vUv -
            vec2(
              0.5,
              0.91
            );

          p.x *= 1.18;

          float d =
            length(p);

          float glow =
            exp(
              -d * 18.0
            );

          float outer =
            exp(
              -d * 7.0
            );

          vec3 warm =
            vec3(
              1.0,
              0.72,
              0.28
            );

          float alpha =
            (
              glow * 0.78 +
              outer * 0.16
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

      blending:
        THREE.AdditiveBlending
    });

  const mesh =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        1,
        1.5
      ),
      material
    );

  mesh.position.set(
    0,
    0,
    0
  );

  mesh.renderOrder =
    renderOrder;

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
        (t - 0.32) /
        0.11,
        2
      )
    );

  const beat2 =
    Math.exp(
      -Math.pow(
        (t - 0.58) /
        0.13,
        2
      )
    ) *
    0.62;

  return clamp(
    beat1 +
    beat2
  );
}

/* =========================================================
   INICIAR AR
   ========================================================= */

async function startAR() {

  startButton.disabled =
    true;

  startButton.textContent =
    "Abriendo cámara…";

  if (flipButton) {

    flipButton.classList.add(
      "hidden"
    );

    flipButton.disabled =
      false;

    flipButton.textContent =
      "Voltear";
  }

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

        /* TRACKING APROBADO — NO MODIFICAR */

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
    } = mindarThree;

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
       ESTABILIZADOR
       ===================================================== */

    const stabilizedGroup =
      new THREE.Group();

    scene.add(
      stabilizedGroup
    );

    stabilizedGroup.visible =
      false;

    /* =====================================================
       GRUPO DE GIRO
       ===================================================== */

    const flipGroup =
      new THREE.Group();

    flipGroup.position.copy(
      commonPosition
    );

    stabilizedGroup.add(
      flipGroup
    );

    const textureLoader =
      new THREE.TextureLoader();

    /* =====================================================
       CAPAS
       ===================================================== */

    const layers = [

      ["fondo-limpio.png", 0],

      ["texto-jesus.png", 1],

      ["pincelada-lila.png", 2],

      ["texto-comunion.png", 3],

      ["corazon-inferior.png", 4],

      ["corazon-superior.png", 5],

      ["cruz.png", 6],

      ["nena-cuerpo.png", 10],

      ["nena-flores.png", 11],

      ["nena-cara.png", 12],

      ["nena-pelo.png", 13],

      ["nena-corona.png", 14],

      ["gatito-superior.png", 20],

      ["gatito-inferior.png", 21],

      ["corazones.png", 30],

      ["estrellas.png", 31],

      ["destellos.png", 32],

      ["marco-corazones.png", 40]
    ];

    for (
      const [file, order]
      of layers
    ) {

      const texture =
        await textureLoader.loadAsync(
          `./assets/animation/${file}`
        );

      texture.colorSpace =
        THREE.SRGBColorSpace;

      const material =
        new THREE.MeshBasicMaterial({

          map: texture,

          transparent: true,

          alphaTest: 0.01,

          depthTest: false,

          depthWrite: false,

          opacity: 1,

          side: THREE.FrontSide
        });

      revealMaterial(
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

      mesh.position.set(
        0,
        0,
        0
      );

      mesh.renderOrder =
        order;

      layerMeshes[file] =
        mesh;

      flipGroup.add(
        mesh
      );
    }

    /* =====================================================
       REVERSO
       ===================================================== */

    const backTexture =
      await textureLoader.loadAsync(
        "./assets/animation/reverso.jpeg"
      );

    backTexture.colorSpace =
      THREE.SRGBColorSpace;

    const backMaterial =
      new THREE.MeshBasicMaterial({

        map: backTexture,

        transparent: false,

        side: THREE.DoubleSide,

        depthWrite: false,

        depthTest: false,

      });

    const backMesh =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          1,
          1.5
        ),
        backMaterial
      );

    /*
     * La cara trasera está invertida respecto
     * al frente. Cuando flipGroup gira 180°,
     * vuelve a quedar orientada hacia la cámara.
     */

    backMesh.rotation.y =
      Math.PI;

    backMesh.position.set(
      0,
      0,
      -0.001
    );

    backMesh.renderOrder =
      0;

    flipGroup.add(
      backMesh
    );

    /* =====================================================
       BRILLOS
       ===================================================== */

    function addGlow(
      file,
      order,
      type = "pulse"
    ) {

      glowMeshes[file] =
        type === "sweep"

          ? sweepGlow(
              layerMeshes[file]
                .material
                .map,

              order
            )

          : pulseGlow(
              layerMeshes[file]
                .material
                .map,

              order
            );

      flipGroup.add(
        glowMeshes[file]
      );
    }

    addGlow(
      "texto-jesus.png",
      1.5,
      "sweep"
    );

    addGlow(
      "texto-comunion.png",
      3.5,
      "sweep"
    );

    addGlow(
      "cruz.png",
      6.5
    );

    addGlow(
      "corazon-superior.png",
      5.5
    );

    addGlow(
      "corazon-inferior.png",
      4.5
    );

    addGlow(
      "corazones.png",
      30.5
    );

    addGlow(
      "destellos.png",
      32.5
    );

    /* =====================================================
       HAZ ORGÁNICO
       ===================================================== */

    const revealWave =
      createRevealWave(45);

    flipGroup.add(
      revealWave
    );

    /* =====================================================
       HALO CRUZ
       ===================================================== */

    const crossHalo =
      createCrossHalo(6.4);

    flipGroup.add(
      crossHalo
    );

    /* =====================================================
       OCULTAR TODO AL COMIENZO
       ===================================================== */

    Object.values(
      layerMeshes
    ).forEach(
      mesh => {

        mesh.material.opacity =
          0;
      }
    );

    Object.values(
      glowMeshes
    ).forEach(
      mesh => {

        mesh.material.opacity =
          0;
      }
    );

    backMesh.visible =
      true;

    /* =====================================================
       ESTADO DEL VOLTEO
       ===================================================== */

    let flipAngle = 0;
    let targetFlipAngle = 0;
    let isFlipping = false;
    let isBack = false;

    const flipAvailableAt =
      4.20;

    /* =====================================================
       FUNCIÓN VOLTEAR
       ===================================================== */

    function flipCard() {

      if (
        isFlipping ||
        !targetVisible ||
        !flipButton
      ) {
        return;
      }

      isFlipping =
        true;

      isBack =
        !isBack;

      targetFlipAngle =
        isBack
          ? Math.PI
          : 0;

      flipButton.disabled =
        true;

      flipButton.textContent =
        isBack
          ? "Volver"
          : "Voltear";
    }

    /* =====================================================
       BOTÓN — INTERACCIÓN TÁCTIL ROBUSTA
       ===================================================== */

    if (flipButton) {

      flipButton.style.pointerEvents =
        "auto";

      flipButton.addEventListener(
        "click",
        event => {

          event.preventDefault();
          event.stopPropagation();

          flipCard();
        }
      );
    }

    /* =====================================================
       VARIABLES DE TRACKING
       ===================================================== */

    let stabilizerReady =
      false;

    let foundAt =
      null;

    let targetVisible =
      false;

    const rawPosition =
      new THREE.Vector3();

    const rawQuaternion =
      new THREE.Quaternion();

    const rawScale =
      new THREE.Vector3();

    /* =====================================================
       TARGET ENCONTRADO
       ===================================================== */

    anchor.onTargetFound =
      () => {

        foundAt =
          performance.now();

        targetVisible =
          true;

        stabilizerReady =
          false;

        flipAngle =
          0;

        targetFlipAngle =
          0;

        isBack =
          false;

        isFlipping =
          false;

        flipGroup.rotation.y =
          0;

        stabilizedGroup.rotation.y =
          0;

        if (flipButton) {

          flipButton.classList.add(
            "hidden"
          );

          flipButton.disabled =
            false;

          flipButton.textContent =
            "Voltear";
        }

        revealWave
          .material
          .uniforms
          .progress
          .value =
          1.1;

        revealWave
          .material
          .uniforms
          .intensity
          .value =
          0;

        crossHalo
          .material
          .uniforms
          .intensity
          .value =
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

        foundAt =
          null;

        targetVisible =
          false;

        stabilizerReady =
          false;

        stabilizedGroup.visible =
          false;

        flipAngle =
          0;

        targetFlipAngle =
          0;

        isBack =
          false;

        isFlipping =
          false;

        flipGroup.rotation.y =
          0;

        stabilizedGroup.rotation.y =
          0;

        if (flipButton) {

          flipButton.classList.add(
            "hidden"
          );

          flipButton.disabled =
            false;

          flipButton.textContent =
            "Voltear";
        }

        Object.values(
          layerMeshes
        ).forEach(
          mesh => {

            mesh.material.opacity =
              0;
          }
        );

        Object.values(
          glowMeshes
        ).forEach(
          mesh => {

            mesh.material.opacity =
              0;
          }
        );

        revealWave
          .material
          .uniforms
          .intensity
          .value =
          0;

        crossHalo
          .material
          .uniforms
          .intensity
          .value =
          0;

        status.textContent =
          "Apuntá la cámara a la estampita";

        status.classList.remove(
          "hidden"
        );
      };

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

        let elapsed =
          999;

        if (
          foundAt !== null
        ) {

          elapsed =
            (
              performance.now() -
              foundAt
            ) /
            1000;
        }

        /* =================================================
           ESTABILIZADOR
           ================================================= */

        if (
          targetVisible
        ) {

          stabilizedGroup.visible =
            true;

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

          } else {

            stabilizedGroup.position.lerp(
              rawPosition,
              1 -
              Math.exp(
                -9 *
                delta
              )
            );

            stabilizedGroup.quaternion.slerp(
              rawQuaternion,
              1 -
              Math.exp(
                -11 *
                delta
              )
            );

            stabilizedGroup.scale.lerp(
              rawScale,
              1 -
              Math.exp(
                -9 *
                delta
              )
            );
          }
        }

        /* =================================================
           VOLTEO
           ================================================= */

        if (
          targetVisible
        ) {

          const flipSpeed =
            7.5;

          const difference =
            targetFlipAngle -
            flipAngle;

          flipAngle +=
            difference *
            (
              1 -
              Math.exp(
                -flipSpeed *
                delta
              )
            );

          flipGroup.rotation.y =
            flipAngle;

          if (
            Math.abs(
              targetFlipAngle -
              flipAngle
            ) <
            0.002
          ) {

            flipAngle =
              targetFlipAngle;

            flipGroup.rotation.y =
              flipAngle;

            isFlipping =
              false;

            if (flipButton) {

              flipButton.disabled =
                false;
            }
          }
        }

        /* =================================================
           BOTÓN
           ================================================= */

        if (
          targetVisible &&
          elapsed >=
          flipAvailableAt
        ) {

          if (flipButton) {

            flipButton.classList.remove(
              "hidden"
            );
          }
        }

        /* =================================================
           REVELACIÓN ORGÁNICA
           ================================================= */

        if (
          targetVisible
        ) {

          const revealStart =
            0.45;

          const revealDuration =
            3.50;

          let revealProgress;

          if (
            elapsed <
            revealStart
          ) {

            revealProgress =
              1.10;

          } else {

            const p =
              clamp(
                (
                  elapsed -
                  revealStart
                ) /
                revealDuration
              );

            revealProgress =
              1.08 -
              smooth(p) *
              1.16;
          }

          Object.values(
            layerMeshes
          ).forEach(
            mesh => {

              mesh.material.opacity =
                1;

              if (
                mesh.material
                  .userData
                  .revealUniforms
              ) {

                mesh.material
                  .userData
                  .revealUniforms
                  .revealProgress
                  .value =
                  revealProgress;
              }
            }
          );

          /* =================================================
             CRUZ
             ================================================= */

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
                smooth(p) *
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
                ease(
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
                  time *
                  0.75
                ) +
                1
              ) /
              2,
              5
            ) *
            0.10;

          cross.material.opacity =
            Math.max(
              cross.material.opacity,
              0.82 +
              ignition *
              0.18 +
              ambientPulse
            );

          crossGlow.material.opacity =
            Math.min(
              1,
              ignition *
              1.15 +
              ambientPulse *
              0.5
            );

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

          /* =================================================
             HAZ DE LUZ
             ================================================= */

          if (
            elapsed >=
              0.45 &&
            elapsed <=
              3.95
          ) {

            const p =
              clamp(
                (
                  elapsed -
                  0.45
                ) /
                3.50
              );

            revealWave
              .material
              .uniforms
              .progress
              .value =
              1.02 -
              smooth(p) *
              1.18;

            revealWave
              .material
              .uniforms
              .intensity
              .value =
              0.95 *
              Math.sin(
                p *
                Math.PI
              );

          } else {

            revealWave
              .material
              .uniforms
              .intensity
              .value =
              0;
          }

          /* =================================================
             PELO
             ================================================= */

          const hair =
            layerMeshes[
              "nena-pelo.png"
            ];

          hair.position.x =
            Math.sin(
              time *
              1.2
            ) *
            0.004;

          hair.position.y =
            Math.sin(
              time *
              1.5
            ) *
            0.002;

          /* =================================================
             CORONA
             ================================================= */

          const crown =
            layerMeshes[
              "nena-corona.png"
            ];

          crown.position.x =
            Math.sin(
              time *
              1.2 +
              0.3
            ) *
            0.003;

          crown.position.y =
            Math.sin(
              time *
              1.5 +
              0.3
            ) *
            0.0015;

          crown.rotation.z =
            Math.sin(
              time *
              1.1
            ) *
            0.008;

          /* =================================================
             GATITO SUPERIOR
             ================================================= */

          const catTop =
            layerMeshes[
              "gatito-superior.png"
            ];

          catTop.position.x =
            Math.sin(
              time *
              0.75 +
              1.5
            ) *
            0.003;

          catTop.position.y =
            Math.sin(
              time *
              1.0 +
              0.5
            ) *
            0.004;

          /* =================================================
             GATITO INFERIOR
             ================================================= */

          const catBottom =
            layerMeshes[
              "gatito-inferior.png"
            ];

          catBottom.position.x =
            Math.sin(
              time *
              0.65 +
              3.0
            ) *
            0.0025;

          catBottom.position.y =
            Math.sin(
              time *
              0.9 +
              2.0
            ) *
            0.0035;

          /* =================================================
             CORAZONES
             ================================================= */

          const decorativeHearts =
            layerMeshes[
              "corazones.png"
            ];

          const decorativeHeartGlow =
            glowMeshes[
              "corazones.png"
            ];

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

          /* =================================================
             CORAZÓN SUPERIOR
             ================================================= */

          const topHeart =
            layerMeshes[
              "corazon-superior.png"
            ];

          const topHeartGlow =
            glowMeshes[
              "corazon-superior.png"
            ];

          const topBeat =
            doubleBeat(
              time,
              4.0,
              0
            );

          topHeart.material.opacity =
            0.84 +
            topBeat *
            0.16;

          topHeartGlow.material.opacity =
            topBeat *
            0.42;

          /* =================================================
             CORAZÓN INFERIOR
             ================================================= */

          const bottomHeart =
            layerMeshes[
              "corazon-inferior.png"
            ];

          const bottomHeartGlow =
            glowMeshes[
              "corazon-inferior.png"
            ];

          const bottomBeat =
            doubleBeat(
              time,
              4.0,
              1.8
            );

          bottomHeart.material.opacity =
            0.84 +
            bottomBeat *
            0.16;

          bottomHeartGlow.material.opacity =
            bottomBeat *
            0.42;

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

          const wave1 =
            Math.pow(
              (
                Math.sin(
                  time *
                  1.8
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
                  time *
                  3.1 +
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
                  time *
                  4.7 +
                  3
                ) +
                1
              ) /
              2,
              12
            );

          const sparkle =
            clamp(
              wave1 +
              wave2 *
              0.65 +
              wave3 *
              0.45
            );

          sparkles.material.opacity =
            0.18 +
            sparkle *
            0.82;

          sparkleGlow.material.opacity =
            0.08 +
            sparkle *
            0.90;

          /* =================================================
             ESTRELLAS
             ================================================= */

          const stars =
            layerMeshes[
              "estrellas.png"
            ];

          const starWave =
            Math.pow(
              (
                Math.sin(
                  time *
                  1.25 +
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

          /* =================================================
             TEXTOS
             ================================================= */

          function textSweep(
            glow,
            delay
          ) {

            if (
              elapsed <
              delay
            ) {

              glow.material.opacity =
                0;

              return;
            }

            const cycle =
              (
                elapsed -
                delay
              ) %
              6.5;

            if (
              cycle <
              1.15
            ) {

              const p =
                cycle /
                1.15;

              const intensity =
                Math.sin(
                  p *
                  Math.PI
                );

              glow
                .material
                .uniforms
                .progress
                .value =
                -0.15 +
                p *
                1.30;

              glow
                .material
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

          textSweep(
            glowMeshes[
              "texto-comunion.png"
            ],
            2.05
          );

          textSweep(
            glowMeshes[
              "texto-jesus.png"
            ],
            3.55
          );
        }

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

    try {

      if (
        mindarThree
      ) {

        mindarThree.stop();

        mindarThree.renderer.setAnimationLoop(
          null
        );
      }

    } catch (e) {}

    mindarThree =
      null;

    startButton.disabled =
      false;

    startButton.textContent =
      "Intentar nuevamente";

    if (flipButton) {

      flipButton.classList.add(
        "hidden"
      );
    }

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

/* =========================================================
   DETENER AR
   ========================================================= */

function stopAR() {

  if (!mindarThree)
    return;

  mindarThree.stop();

  mindarThree.renderer.setAnimationLoop(
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

    flipButton.classList.add(
      "hidden"
    );

    flipButton.disabled =
      false;

    flipButton.textContent =
      "Voltear";
  }

  mindarThree =
    null;

  layerMeshes = {};
  glowMeshes = {};
}

/* =========================================================
   BOTONES
   ========================================================= */

startButton.addEventListener(
  "click",
  startAR
);

stopButton.addEventListener(
  "click",
  stopAR
);
