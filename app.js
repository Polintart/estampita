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
   UTILIDADES
========================================================= */

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  value = clamp01(value);
  return 1 - Math.pow(1 - value, 3);
}


/* =========================================================
   BRILLO QUE RECORRE UNA CAPA
========================================================= */

function createSweepGlow(texture, position, renderOrder) {

  const geometry = new THREE.PlaneGeometry(1, 1.5);

  const material = new THREE.ShaderMaterial({

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
        value: 1.0
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

        vec4 tex = texture2D(map, vUv);

        if (tex.a < 0.01) {
          discard;
        }

        /*
         * Diagonal suave.
         * Esto hace que el brillo atraviese
         * las letras en diagonal.
         */
        float position =
          vUv.x * 0.90 +
          vUv.y * 0.20;

        float distanceFromGlow =
          abs(position - progress);

        float glow =
          1.0 -
          smoothstep(
            0.0,
            width,
            distanceFromGlow
          );

        glow *= strength;

        /*
         * El brillo es blanco.
         * Usamos solamente el alpha
         * de la textura original.
         */
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
    geometry,
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

  const geometry =
    new THREE.PlaneGeometry(1, 1.5);

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
      geometry,
      material
    );

  mesh.position.copy(position);

  mesh.renderOrder =
    renderOrder;

  return mesh;
}


/* =========================================================
   LATIDO DOBLE
========================================================= */

function doubleBeat(time, period = 4.2, phase = 0) {

  let t =
    ((time + phase) % period + period) % period;

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
   INICIO AR
========================================================= */

async function startAR() {

  startButton.disabled = true;
  startButton.textContent =
    "Abriendo cámara…";

  try {

    mindarThree =
      new MindARThree({

        container:
          document.querySelector("#ar-container"),

        imageTargetSrc:
          "./targets/estampita.mind",

        maxTrack: 1,

        /*
         * FILTRO MÁS FUERTE
         *
         * La prioridad ahora es que
         * la estampita deje de temblar.
         */
        filterMinCF: 0.0003,
        filterBeta: 700,

        warmupTolerance: 7,
        missTolerance: 10,

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


    const textureLoader =
      new THREE.TextureLoader();


    /* =====================================================
       CAPAS
    ===================================================== */

    const layers = [

      {
        file: "fondo-limpio.png",
        name: "Fondo limpio",
        order: 0
      },

      {
        file: "texto-jesus.png",
        name: "Texto Jesús",
        order: 1
      },

      {
        file: "pincelada-lila.png",
        name: "Pincelada lila",
        order: 2
      },

      {
        file: "texto-comunion.png",
        name: "Texto Comunión",
        order: 3
      },

      {
        file: "corazon-inferior.png",
        name: "Corazón inferior",
        order: 4
      },

      {
        file: "corazon-superior.png",
        name: "Corazón superior",
        order: 5
      },

      {
        file: "cruz.png",
        name: "Cruz",
        order: 6
      },

      {
        file: "nena-cuerpo.png",
        name: "Nena cuerpo",
        order: 10
      },

      {
        file: "nena-flores.png",
        name: "Nena flores",
        order: 11
      },

      {
        file: "nena-cara.png",
        name: "Nena cara",
        order: 12
      },

      {
        file: "nena-pelo.png",
        name: "Nena pelo",
        order: 13
      },

      {
        file: "nena-corona.png",
        name: "Nena corona",
        order: 14
      },

      {
        file: "gatito-superior.png",
        name: "Gatito superior",
        order: 20
      },

      {
        file: "gatito-inferior.png",
        name: "Gatito inferior",
        order: 21
      },

      {
        file: "corazones.png",
        name: "Corazones decorativos",
        order: 30
      },

      {
        file: "estrellas.png",
        name: "Estrellas",
        order: 31
      },

      {
        file: "destellos.png",
        name: "Destellos",
        order: 32
      },

      {
        file: "marco-corazones.png",
        name: "Marco corazones",
        order: 40
      }
    ];


    /* =====================================================
       CARGAR CAPAS
    ===================================================== */

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


      anchor.group.add(mesh);
    }


    /* =====================================================
       BRILLOS
    ===================================================== */

    /*
     * TEXTOS
     */

    glowMeshes["texto-jesus.png"] =
      createSweepGlow(
        layerMeshes[
          "texto-jesus.png"
        ].material.map,

        commonPosition,

        1.5
      );

    anchor.group.add(
      glowMeshes["texto-jesus.png"]
    );


    glowMeshes["texto-comunion.png"] =
      createSweepGlow(
        layerMeshes[
          "texto-comunion.png"
        ].material.map,

        commonPosition,

        3.5
      );

    anchor.group.add(
      glowMeshes["texto-comunion.png"]
    );


    /*
     * CRUZ
     */

    glowMeshes["cruz.png"] =
      createPulseGlow(
        layerMeshes[
          "cruz.png"
        ].material.map,

        commonPosition,

        6.5
      );

    anchor.group.add(
      glowMeshes["cruz.png"]
    );


    /*
     * CORAZÓN SUPERIOR
     */

    glowMeshes["corazon-superior.png"] =
      createPulseGlow(
        layerMeshes[
          "corazon-superior.png"
        ].material.map,

        commonPosition,

        5.5
      );

    anchor.group.add(
      glowMeshes["corazon-superior.png"]
    );


    /*
     * CORAZÓN INFERIOR
     */

    glowMeshes["corazon-inferior.png"] =
      createPulseGlow(
        layerMeshes[
          "corazon-inferior.png"
        ].material.map,

        commonPosition,

        4.5
      );

    anchor.group.add(
      glowMeshes["corazon-inferior.png"]
    );


    /*
     * CORAZONES DECORATIVOS
     */

    glowMeshes["corazones.png"] =
      createPulseGlow(
        layerMeshes[
          "corazones.png"
        ].material.map,

        commonPosition,

        30.5
      );

    anchor.group.add(
      glowMeshes["corazones.png"]
    );


    /*
     * DESTELLOS
     */

    glowMeshes["destellos.png"] =
      createPulseGlow(
        layerMeshes[
          "destellos.png"
        ].material.map,

        commonPosition,

        32.5
      );

    anchor.group.add(
      glowMeshes["destellos.png"]
    );


    /* =====================================================
       ESTADO INICIAL
    ===================================================== */

    for (
      const file of Object.keys(layerMeshes)
    ) {

      layerMeshes[file]
        .material.opacity = 0;
    }


    for (
      const file of Object.keys(glowMeshes)
    ) {

      glowMeshes[file]
        .material.opacity = 0;
    }


    /*
     * Estas capas nunca tendrán movimiento.
     */

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
    ].forEach((file) => {

      if (layerMeshes[file]) {

        layerMeshes[file]
          .position.copy(
            commonPosition
          );
      }
    });


    let targetFoundTime = null;
    let targetVisible = false;


    /* =====================================================
       TARGET ENCONTRADO
    ===================================================== */

    anchor.onTargetFound = () => {

      targetFoundTime =
        performance.now();

      targetVisible = true;

      status.textContent =
        "¡La estampita cobró vida!";

      status.classList.remove(
        "hidden"
      );
    };


    /* =====================================================
       TARGET PERDIDO
    ===================================================== */

    anchor.onTargetLost = () => {

      targetFoundTime = null;

      targetVisible = false;

      /*
       * Resetear para que al volver a
       * encontrar la tarjeta vuelva
       * a aparecer desde cero.
       */

      for (
        const file of Object.keys(layerMeshes)
      ) {

        layerMeshes[file]
          .material.opacity = 0;
      }

      for (
        const file of Object.keys(glowMeshes)
      ) {

        glowMeshes[file]
          .material.opacity = 0;
      }

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


    const clock =
      new THREE.Clock();


    /* =====================================================
       LOOP PRINCIPAL
    ===================================================== */

    renderer.setAnimationLoop(() => {

      const time =
        clock.getElapsedTime();


      let elapsed = 999;


      if (
        targetFoundTime !== null
      ) {

        elapsed =
          (
            performance.now() -
            targetFoundTime
          ) / 1000;
      }


      /* ===================================================
         APARICIÓN INICIAL
      =================================================== */

      if (targetVisible) {

        /*
         * FONDO
         *
         * Aparece rápido y después queda
         * completamente fijo.
         */

        const bgProgress =
          easeOutCubic(
            elapsed / 0.35
          );

        layerMeshes[
          "fondo-limpio.png"
        ].material.opacity =
          bgProgress;


        /*
         * ILUSTRACIÓN
         */

        const girlProgress =
          easeOutCubic(
            (elapsed - 0.12) / 0.70
          );

        [
          "nena-cuerpo.png",
          "nena-flores.png",
          "nena-cara.png",
          "nena-pelo.png",
          "nena-corona.png"
        ].forEach((file) => {

          layerMeshes[file]
            .material.opacity =
            girlProgress;
        });


        /*
         * GATITOS
         */

        const catProgress =
          easeOutCubic(
            (elapsed - 0.30) / 0.70
          );

        [
          "gatito-superior.png",
          "gatito-inferior.png"
        ].forEach((file) => {

          layerMeshes[file]
            .material.opacity =
            catProgress;
        });


        /*
         * PINCELADA
         */

        layerMeshes[
          "pincelada-lila.png"
        ].material.opacity =
          easeOutCubic(
            (elapsed - 0.05) / 0.55
          );


        /*
         * TEXTO COMUNIÓN
         */

        layerMeshes[
          "texto-comunion.png"
        ].material.opacity =
          easeOutCubic(
            (elapsed - 0.18) / 0.85
          );


        /*
         * TEXTO JESÚS
         */

        layerMeshes[
          "texto-jesus.png"
        ].material.opacity =
          easeOutCubic(
            (elapsed - 0.35) / 0.85
          );


        /*
         * CRUZ
         */

        layerMeshes[
          "cruz.png"
        ].material.opacity =
          easeOutCubic(
            (elapsed - 0.20) / 0.65
          );


        /*
         * CORAZONES PRINCIPALES
         */

        const heartProgress =
          easeOutCubic(
            (elapsed - 0.25) / 0.65
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
         * DECORACIÓN
         */

        const decorationProgress =
          easeOutCubic(
            (elapsed - 0.30) / 0.75
          );

        [
          "corazones.png",
          "estrellas.png",
          "destellos.png",
          "marco-corazones.png"
        ].forEach((file) => {

          layerMeshes[file]
            .material.opacity =
            decorationProgress;
        });
      }


      /* ===================================================
         PELO
         EXACTAMENTE COMO LO APROBASTE
      =================================================== */

      const hair =
        layerMeshes[
          "nena-pelo.png"
        ];

      if (hair) {

        hair.position.x =
          commonPosition.x +
          Math.sin(time * 1.2) *
          0.004;

        hair.position.y =
          commonPosition.y +
          Math.sin(time * 1.5) *
          0.002;
      }


      /* ===================================================
         CORONA
         EXACTAMENTE COMO LO APROBASTE
      =================================================== */

      const crown =
        layerMeshes[
          "nena-corona.png"
        ];

      if (crown) {

        crown.position.x =
          commonPosition.x +
          Math.sin(
            time * 1.2 + 0.3
          ) *
          0.003;

        crown.position.y =
          commonPosition.y +
          Math.sin(
            time * 1.5 + 0.3
          ) *
          0.0015;

        crown.rotation.z =
          Math.sin(
            time * 1.1
          ) *
          0.008;
      }


      /* ===================================================
         GATITO SUPERIOR
      =================================================== */

      const catTop =
        layerMeshes[
          "gatito-superior.png"
        ];

      if (catTop) {

        catTop.position.x =
          commonPosition.x +
          Math.sin(
            time * 0.75 + 1.5
          ) *
          0.003;

        catTop.position.y =
          commonPosition.y +
          Math.sin(
            time * 1.0 + 0.5
          ) *
          0.004;
      }


      /* ===================================================
         GATITO INFERIOR
      =================================================== */

      const catBottom =
        layerMeshes[
          "gatito-inferior.png"
        ];

      if (catBottom) {

        catBottom.position.x =
          commonPosition.x +
          Math.sin(
            time * 0.65 + 3.0
          ) *
          0.0025;

        catBottom.position.y =
          commonPosition.y +
          Math.sin(
            time * 0.9 + 2.0
          ) *
          0.0035;
      }


      /* ===================================================
         CORAZONES DECORATIVOS
         LATIDO DOBLE
      =================================================== */

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
          .material.opacity =
          0.82 +
          beat * 0.18;

        decorativeHeartGlow
          .material.opacity =
          beat * 0.48;
      }


      /* ===================================================
         CORAZÓN SUPERIOR
      =================================================== */

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


      /* ===================================================
         CORAZÓN INFERIOR
      =================================================== */

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


      /* ===================================================
         CRUZ
         PULSO DE LUZ
      =================================================== */

      const cross =
        layerMeshes[
          "cruz.png"
        ];

      const crossGlow =
        glowMeshes[
          "cruz.png"
        ];

      if (
        cross &&
        crossGlow &&
        targetVisible
      ) {

        const pulse =
          Math.pow(
            (
              Math.sin(
                time * 0.75
              ) + 1
            ) / 2,
            5
          );

        cross.material.opacity =
          0.82 +
          pulse * 0.18;

        crossGlow.material.opacity =
          pulse * 0.62;
      }


      /* ===================================================
         DESTELLOS
         MÁS PERCEPTIBLES
      =================================================== */

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
              ) + 1
            ) / 2,
            6
          );

        const wave2 =
          Math.pow(
            (
              Math.sin(
                time * 3.1 + 1.7
              ) + 1
            ) / 2,
            9
          );

        const wave3 =
          Math.pow(
            (
              Math.sin(
                time * 4.7 + 3.0
              ) + 1
            ) / 2,
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


      /* ===================================================
         ESTRELLAS
      =================================================== */

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
                time * 1.25 + 0.8
              ) + 1
            ) / 2,
            3
          );

        stars.material.opacity =
          0.68 +
          starWave * 0.32;
      }


      /* ===================================================
         BRILLO DE TEXTO
      =================================================== */

      const jesusGlow =
        glowMeshes[
          "texto-jesus.png"
        ];

      const communionGlow =
        glowMeshes[
          "texto-comunion.png"
        ];


      /*
       * Función para hacer un recorrido
       * ocasional del brillo.
       */

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
            glow.material.opacity = 0;
          }

          return;
        }


        const localTime =
          elapsed - startDelay;

        const cycle =
          localTime %
          cycleLength;


        if (
          cycle >= 0 &&
          cycle < duration
        ) {

          const progress =
            cycle / duration;

          /*
           * El brillo entra desde
           * la izquierda y sale
           * por la derecha.
           */

          glow.material
            .uniforms
            .progress.value =
            -0.15 +
            progress * 1.30;

          /*
           * Pico de intensidad
           * en el centro del recorrido.
           */

          const intensity =
            Math.sin(
              progress * Math.PI
            );

          glow.material
            .uniforms
            .strength.value =
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


      /*
       * Jesús
       */

      updateTextSweep(
        jesusGlow,
        1.35,
        6.5,
        1.15
      );


      /*
       * Comunión
       *
       * Va ligeramente después
       * para que no brillen juntos.
       */

      updateTextSweep(
        communionGlow,
        2.6,
        6.5,
        1.15
      );


      /* ===================================================
         FONDO
         SIEMPRE ESTABLE
      =================================================== */

      if (
        targetVisible &&
        elapsed > 0.35
      ) {

        layerMeshes[
          "fondo-limpio.png"
        ].material.opacity = 1;
      }


      /* ===================================================
         MARCO
         SIEMPRE ESTABLE
      =================================================== */

      if (
        targetVisible &&
        elapsed > 0.9
      ) {

        layerMeshes[
          "marco-corazones.png"
        ].material.opacity = 1;
      }


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


/* =========================================================
   DETENER AR
========================================================= */

function stopAR() {

  if (!mindarThree) {
    return;
  }


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
