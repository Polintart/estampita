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

        float d = abs(position - progress);

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

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.5),
    material
  );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

function createPulseGlow(texture, position, renderOrder) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.5),
    material
  );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

function createRevealWave(position, renderOrder) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      progress: { value: -1 },
      intensity: { value: 0 },
      width: { value: 0.075 }
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

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.5),
    material
  );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

function createCrossHalo(position, renderOrder) {
  const material = new THREE.ShaderMaterial({
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

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.5),
    material
  );

  mesh.position.copy(position);
  mesh.renderOrder = renderOrder;

  return mesh;
}

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

async function startAR() {

  startButton.disabled = true;
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

        filterMinCF: 0.0005,
        filterBeta: 1000,

        warmupTolerance: 5,
        missTolerance: 8,

        uiLoading: "no",
        uiScanning: "no",
        uiError: "no"
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

    /*
     * =====================================================
     * ESTABILIZADOR
     * =====================================================
     *
     * El grupo de MindAR se utiliza solamente como
     * referencia de tracking.
     *
     * Toda la estampita visible vive en stabilizedGroup.
     */

    const stabilizedGroup =
      new THREE.Group();

    scene.add(
      stabilizedGroup
    );

    stabilizedGroup.visible =
      false;

    const textureLoader =
      new THREE.TextureLoader();

    /*
     * =====================================================
     * CAPAS
     * =====================================================
     */

    const layers = [

      {
        file: "fondo-limpio.png",
        order: 0
      },

      {
        file: "texto-jesus.png",
        order: 1
      },

      {
        file: "pincelada-lila.png",
        order: 2
      },

      {
        file: "texto-comunion.png",
        order: 3
      },

      {
        file: "corazon-inferior.png",
        order: 4
      },

      {
        file: "corazon-superior.png",
        order: 5
      },

      {
        file: "cruz.png",
        order: 6
      },

      {
        file: "nena-cuerpo.png",
        order: 10
      },

      {
        file: "nena-flores.png",
        order: 11
      },

      {
        file: "nena-cara.png",
        order: 12
      },

      {
        file: "nena-pelo.png",
        order: 13
      },

      {
        file: "nena-corona.png",
        order: 14
      },

      {
        file: "gatito-superior.png",
        order: 20
      },

      {
        file: "gatito-inferior.png",
        order: 21
      },

      {
        file: "corazones.png",
        order: 30
      },

      {
        file: "estrellas.png",
        order: 31
      },

      {
        file: "destellos.png",
        order: 32
      },

      {
        file: "marco-corazones.png",
        order: 40
      }
    ];

    /*
     * =====================================================
     * CARGA DE CAPAS
     * =====================================================
     */

    for (const layer of layers) {

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
          map: texture,

          transparent: true,

          alphaTest: 0.01,

          depthTest: false,

          depthWrite: false,

          opacity: 1
        });

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

      layerMeshes[layer.file] =
        mesh;

      stabilizedGroup.add(
        mesh
      );
    }

    /*
     * =====================================================
     * BRILLOS DE TEXTO
     * =====================================================
     */

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

    stabilizedGroup.add(
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

    stabilizedGroup.add(
      glowMeshes[
        "texto-comunion.png"
      ]
    );

    /*
     * =====================================================
     * BRILLO DE CRUZ
     * =====================================================
     */

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

    stabilizedGroup.add(
      glowMeshes[
        "cruz.png"
      ]
    );

    /*
     * =====================================================
     * BRILLOS DE CORAZONES
     * =====================================================
     */

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

    stabilizedGroup.add(
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

    stabilizedGroup.add(
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

    stabilizedGroup.add(
      glowMeshes[
        "corazones.png"
      ]
    );

    /*
     * =====================================================
     * DESTELLOS
     * =====================================================
     */

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

    stabilizedGroup.add(
      glowMeshes[
        "destellos.png"
      ]
    );

    /*
     * =====================================================
     * NUEVO EFECTO WOW
     * =====================================================
     */

    const revealWave =
      createRevealWave(
        commonPosition,
        45
      );

    stabilizedGroup.add(
      revealWave
    );

    /*
     * Halo especial de la cruz.
     */

    const crossHalo =
      createCrossHalo(
        commonPosition,
        6.4
      );

    stabilizedGroup.add(
      crossHalo
    );

    /*
     * =====================================================
     * TODO OCULTO AL INICIO
     * =====================================================
     */

    for (
      const file of Object.keys(
        layerMeshes
      )
    ) {

      layerMeshes[
        file
      ].material.opacity = 0;
    }

    for (
      const file of Object.keys(
        glowMeshes
      )
    ) {

      glowMeshes[
        file
      ].material.opacity = 0;
    }

    [
      "fondo-limpio.png",
      "texto-jesus.png",
      "pincelada-lila.png",
      "texto-comunion.png",
      "corazon-inferior.png",
      "corazon-superior.png",
      "cruz.png",
      "nena-cuerpo.png",
      "nena-flores.png",
      "nena-cara.png",
      "corazones.png",
      "estrellas.png",
      "destellos.png",
      "marco-corazones.png"
    ].forEach(
      (file) => {

        if (
          layerMeshes[file]
        ) {

          layerMeshes[
            file
          ].position.copy(
            commonPosition
          );
        }
      }
    );

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

    /*
     * =====================================================
     * VARIABLES DEL ESTABILIZADOR
     * =====================================================
     */

    const rawPosition =
      new THREE.Vector3();

    const rawQuaternion =
      new THREE.Quaternion();

    const rawScale =
      new THREE.Vector3();

    let stabilizerReady =
      false;

    /*
     * IMPORTANTE:
     * Estos valores son los que ya funcionaban bien.
     */

    const POSITION_RESPONSE = 9;

    const ROTATION_RESPONSE = 11;

    const SCALE_RESPONSE = 9;

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

    /*
     * =====================================================
     * TRACKING
     * =====================================================
     */

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
      };

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

        for (
          const file of Object.keys(
            layerMeshes
          )
        ) {

          layerMeshes[
            file
          ].material.opacity = 0;
        }

        for (
          const file of Object.keys(
            glowMeshes
          )
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

    /*
     * =====================================================
     * ARRANCAR MINDAR
     * =====================================================
     */

    await mindarThree.start();

    startScreen.classList.add(
      "hidden"
    );

    stopButton.classList.remove(
      "hidden"
    );

    status.textContent =
      "Apuntá la cámara a la estampita";

    /*
     * =====================================================
     * ANIMATION LOOP
     * =====================================================
     */

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

        /*
         * -------------------------------------------------
         * TRACKING ESTABILIZADO
         * -------------------------------------------------
         */

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
          targetFoundTime !== null
        ) {

          elapsed =
            (
              performance.now() -
              targetFoundTime
            ) / 1000;
        }

        /*
         * -------------------------------------------------
         * APARICIÓN DE LA ESTAMPITA
         * -------------------------------------------------
         */

        if (
          targetVisible
        ) {

          /*
           * Fondo.
           */

          layerMeshes[
            "fondo-limpio.png"
          ].material.opacity =
            easeOutCubic(
              elapsed / 0.35
            );

          /*
           * Nena.
           */

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
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                girlProgress;
            }
          );

          /*
           * Gatitos.
           */

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
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                catProgress;
            }
          );

          /*
           * Pincelada lila.
           */

          layerMeshes[
            "pincelada-lila.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.05
              ) / 0.55
            );

          /*
           * Texto Comunión.
           */

          layerMeshes[
            "texto-comunion.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.18
              ) / 0.85
            );

          /*
           * Texto Jesús.
           */

          layerMeshes[
            "texto-jesus.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.35
              ) / 0.85
            );

          /*
           * Cruz.
           */

          layerMeshes[
            "cruz.png"
          ].material.opacity =
            easeOutCubic(
              (
                elapsed -
                0.20
              ) / 0.65
            );

          /*
           * Corazones superiores/inferiores.
           */

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

          /*
           * Decoración.
           */

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
            (file) => {

              layerMeshes[
                file
              ].material.opacity =
                decorationProgress;
            }
          );
        }

        /*
         * =================================================
         * MOVIMIENTO SUTIL DEL PELO
         * =================================================
         */

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

        /*
         * =================================================
         * MOVIMIENTO SUTIL DE LA CORONA
         * =================================================
         */

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

        /*
         * =================================================
         * GATITO SUPERIOR
         * =================================================
         */

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

        /*
         * =================================================
         * GATITO INFERIOR
         * =================================================
         */

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

        /*
         * =================================================
         * CORAZONES DECORATIVOS
         * =================================================
         */

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

        /*
         * =================================================
         * CORAZÓN SUPERIOR
         * =================================================
         */

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

          heartTop
            .material
            .opacity =
            0.84 +
            beat * 0.16;

          heartTopGlow
            .material
            .opacity =
            beat * 0.42;
        }

        /*
         * =================================================
         * CORAZÓN INFERIOR
         * =================================================
         */

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

          heartBottom
            .material
            .opacity =
            0.84 +
            beat * 0.16;

          heartBottomGlow
            .material
            .opacity =
            beat * 0.42;
        }

        /*
         * =================================================
         * REVELACIÓN WOW
         * =================================================
         *
         * La cruz es el origen de la animación.
         *
         * Primero se enciende.
         * Después nace la onda.
         * Luego todo vuelve a la calma.
         */

        if (
          targetVisible
        ) {

          const cross =
            layerMeshes[
              "cruz.png"
            ];

          const crossGlow =
            glowMeshes[
              "cruz.png"
            ];

          /*
           * ---------------------------------------------
           * ENCENDIDO DE LA CRUZ
           * ---------------------------------------------
           */

          let ignition = 0;

          if (
            elapsed >= 0.35 &&
            elapsed < 1.30
          ) {

            const p =
              (
                elapsed -
                0.35
              ) / 0.95;

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
                  ) / 0.80
                )
              );
          }

          /*
           * Pulso ambiental muy pequeño
           * después del encendido.
           */

          const ambientPulse =
            Math.pow(
              (
                Math.sin(
                  time * 0.75
                ) +
                1
              ) / 2,
              5
            ) *
            0.10;

          /*
           * Cruz normal.
           */

          if (cross) {

            cross.material.opacity =
              Math.max(
                cross.material.opacity,
                0.82 +
                ignition * 0.18 +
                ambientPulse
              );
          }

          /*
           * Luz aditiva de la cruz.
           */

          if (crossGlow) {

            crossGlow.material.opacity =
              Math.min(
                1,
                ignition * 1.15 +
                ambientPulse * 0.5
              );
          }

          /*
           * Halo alrededor de la cruz.
           */

          crossHalo
            .material
            .uniforms
            .intensity
            .value =
            Math.min(
              1,
              ignition * 1.25
            );

          /*
           * ---------------------------------------------
           * ONDA DE REVELACIÓN
           * ---------------------------------------------
           */

          if (
            elapsed >= 0.50 &&
            elapsed <= 2.15
          ) {

            const p =
              (
                elapsed -
                0.50
              ) / 1.65;

            const wave =
              easeInOut(p);

            /*
             * Va de arriba hacia abajo.
             */

            revealWave
              .material
              .uniforms
              .progress
              .value =
              1.02 -
              wave * 1.22;

            /*
             * La onda aparece y desaparece
             * suavemente.
             */

            const edge =
              Math.sin(
                p * Math.PI
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
              .value = 0;
          }
        }

        /*
         * =================================================
         * DESTELLOS
         * =================================================
         */

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
              ) / 2,
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
              ) / 2,
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
              ) / 2,
              12
            );

          const sparkle =
            clamp01(
              wave1 +
              wave2 * 0.65 +
              wave3 * 0.45
            );

          sparkles
            .material
            .opacity =
            0.18 +
            sparkle * 0.82;

          sparkleGlow
            .material
            .opacity =
            0.08 +
            sparkle * 0.90;
        }

        /*
         * =================================================
         * ESTRELLAS
         * =================================================
         */

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
              ) / 2,
              3
            );

          stars
            .material
            .opacity =
            0.68 +
            starWave * 0.32;
        }

        /*
         * =================================================
         * BRILLO DE LOS TEXTOS
         * =================================================
         */

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
            elapsed < startDelay
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

            glow
              .material
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

        /*
         * Primero:
         * MI PRIMERA COMUNIÓN
         */

        updateTextSweep(
          communionGlow,
          1.35,
          6.5,
          1.15
        );

        /*
         * Después:
         * QUE JESÚS SIEMPRE CAMINE A MI LADO
         */

        updateTextSweep(
          jesusGlow,
          2.6,
          6.5,
          1.15
        );

        /*
         * =================================================
         * ASEGURAR FONDO
         * =================================================
         */

        if (
          targetVisible &&
          elapsed > 0.35
        ) {

          layerMeshes[
            "fondo-limpio.png"
          ].material.opacity = 1;
        }

        /*
         * Marco completamente visible
         * después del comienzo.
         */

        if (
          targetVisible &&
          elapsed > 0.9
        ) {

          layerMeshes[
            "marco-corazones.png"
          ].material.opacity = 1;
        }

        /*
         * =================================================
         * RENDER
         * =================================================
         */

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

    if (mindarThree) {

      try {

        mindarThree.stop();

        mindarThree
          .renderer
          .setAnimationLoop(null);

      } catch (e) {}
    }

    mindarThree = null;

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

/*
 * =========================================================
 * DETENER AR
 * =========================================================
 */

function stopAR() {

  if (!mindarThree)
    return;

  mindarThree.stop();

  mindarThree
    .renderer
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

  mindarThree = null;

  layerMeshes = {};

  glowMeshes = {};
}

/*
 * =========================================================
 * BOTONES
 * =========================================================
 */

startButton.addEventListener(
  "click",
  startAR
);

stopButton.addEventListener(
  "click",
  stopAR
);
