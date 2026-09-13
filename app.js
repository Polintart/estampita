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
        value: -0.25
      },

      width: {
        value: 0.16
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

        float distanceFromGlow =
          abs(vUv.x - progress);

        float glow =
          1.0 -
          smoothstep(0.0, width, distanceFromGlow);

        glow *= strength;

        vec3 glowColor =
          tex.rgb * glow * 2.2;

        gl_FragColor =
          vec4(glowColor, tex.a * glow);
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
   BRILLO GENERAL PARA UNA CAPA
========================================================= */

function createPulseGlow(texture, position, renderOrder) {

  const geometry = new THREE.PlaneGeometry(1, 1.5);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
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
   INICIO AR
========================================================= */

async function startAR() {

  startButton.disabled = true;
  startButton.textContent = "Abriendo cámara…";

  try {

    mindarThree = new MindARThree({

      container:
        document.querySelector("#ar-container"),

      imageTargetSrc:
        "./targets/estampita.mind",

      maxTrack: 1,

      /*
       * Más suavizado para reducir el temblor.
       * Mantiene una respuesta razonablemente rápida.
       */
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
      Math.min(window.devicePixelRatio, 2)
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

      /*
       * Este archivo contiene los corazones rosas
       * decorativos.
       *
       * NO contiene:
       * - corazón debajo de la cruz
       * - corazón debajo del texto Jesús
       */

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
       CARGA DE TODAS LAS CAPAS
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

          depthWrite: false
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
       CAPAS DE BRILLO
    ===================================================== */

    /*
     * TEXTO JESÚS
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


    /*
     * TEXTO COMUNIÓN
     */

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

    const allLayers =
      Object.keys(layerMeshes);


    for (const file of allLayers) {

      layerMeshes[file]
        .material.opacity = 0;
    }


    /*
     * El fondo también empieza invisible.
     */

    layerMeshes[
      "fondo-limpio.png"
    ].material.opacity = 0;


    /*
     * Brillos inicialmente apagados.
     */

    for (const file of Object.keys(glowMeshes)) {

      glowMeshes[file]
        .material.opacity = 0;
    }


    let targetFoundTime = null;


    /* =====================================================
       TARGET ENCONTRADO
    ===================================================== */

    anchor.onTargetFound = () => {

      targetFoundTime =
        performance.now();

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

      if (targetFoundTime !== null) {

        elapsed =
          (performance.now() -
            targetFoundTime) /
          1000;
      }


      /* ===================================================
         APARICIÓN INICIAL
      =================================================== */

      if (targetFoundTime !== null) {

        /*
         * FONDO
         */

        const bgProgress =
          easeOutCubic(
            elapsed / 0.45
          );


        layerMeshes[
          "fondo-limpio.png"
        ].material.opacity =
          bgProgress;


        /*
         * PINCELADA
         */

        const brushProgress =
          easeOutCubic(
            (elapsed - 0.08) / 0.65
          );


        layerMeshes[
          "pincelada-lila.png"
        ].material.opacity =
          brushProgress;


        /*
         * COMUNIÓN
         */

        const communionProgress =
          easeOutCubic(
            (elapsed - 0.18) / 1.15
          );


        layerMeshes[
          "texto-comunion.png"
        ].material.opacity =
          communionProgress;


        /*
         * JESÚS
         */

        const jesusProgress =
          easeOutCubic(
            (elapsed - 0.35) / 1.1
          );


        layerMeshes[
          "texto-jesus.png"
        ].material.opacity =
          jesusProgress;


        /*
         * CRUZ
         */

        const crossProgress =
          easeOutCubic(
            (elapsed - 0.22) / 0.75
          );


        layerMeshes[
          "cruz.png"
        ].material.opacity =
          crossProgress;


        /*
         * CORAZONES PRINCIPALES
         */

        const heartProgress =
          easeOutCubic(
            (elapsed - 0.30) / 0.75
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
         * NENA
         */

        const girlProgress =
          easeOutCubic(
            (elapsed - 0.18) / 0.85
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
            (elapsed - 0.45) / 0.8
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
         * DECORACIÓN
         */

        const decorationProgress =
          easeOutCubic(
            (elapsed - 0.38) / 0.9
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
         NENA
         Mantengo el movimiento que ya aprobaste.
      =================================================== */

      const body =
        layerMeshes["nena-cuerpo.png"];

      if (body) {

        body.position.x =
          commonPosition.x +
          Math.sin(time * 0.9) *
          0.0015;

        body.position.y =
          commonPosition.y +
          Math.sin(time * 1.15) *
          0.001;
      }


      /* ===================================================
         FLORES
      =================================================== */

      const flowers =
        layerMeshes["nena-flores.png"];

      if (flowers) {

        flowers.position.x =
          commonPosition.x +
          Math.sin(time * 1.05 + 0.7) *
          0.002;

        flowers.position.y =
          commonPosition.y +
          Math.sin(time * 1.25 + 0.4) *
          0.0015;
      }


      /* ===================================================
         PELO
         EXACTAMENTE COMO ESTABA
      =================================================== */

      const hair =
        layerMeshes["nena-pelo.png"];

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
         EXACTAMENTE COMO ESTABA
      =================================================== */

      const crown =
        layerMeshes["nena-corona.png"];

      if (crown) {

        crown.position.x =
          commonPosition.x +
          Math.sin(time * 1.2 + 0.3) *
          0.003;

        crown.position.y =
          commonPosition.y +
          Math.sin(time * 1.5 + 0.3) *
          0.0015;

        crown.rotation.z =
          Math.sin(time * 1.1) *
          0.008;
      }


      /* ===================================================
         CARA
      =================================================== */

      const face =
        layerMeshes["nena-cara.png"];

      if (face) {

        face.position.x =
          commonPosition.x +
          Math.sin(time * 0.95 + 0.8) *
          0.0008;

        face.position.y =
          commonPosition.y +
          Math.sin(time * 1.1 + 0.5) *
          0.0006;
      }


      /* ===================================================
         GATITO SUPERIOR
         Mantengo el movimiento actual.
      =================================================== */

      const catTop =
        layerMeshes["gatito-superior.png"];

      if (catTop) {

        catTop.position.x =
          commonPosition.x +
          Math.sin(time * 0.75 + 1.5) *
          0.003;

        catTop.position.y =
          commonPosition.y +
          Math.sin(time * 1.0 + 0.5) *
          0.004;
      }


      /* ===================================================
         GATITO INFERIOR
      =================================================== */

      const catBottom =
        layerMeshes["gatito-inferior.png"];

      if (catBottom) {

        catBottom.position.x =
          commonPosition.x +
          Math.sin(time * 0.65 + 3.0) *
          0.0025;

        catBottom.position.y =
          commonPosition.y +
          Math.sin(time * 0.9 + 2.0) *
          0.0035;
      }


      /* ===================================================
         CORAZONES DECORATIVOS
         LATIDO
      =================================================== */

      const decorativeHearts =
        layerMeshes["corazones.png"];

      const decorativeHeartGlow =
        glowMeshes["corazones.png"];

      if (
        decorativeHearts &&
        decorativeHeartGlow
      ) {

        /*
         * Dos pulsos cercanos entre sí:
         * "tum-tum"
         */

        const beat =
          Math.max(
            0,
            Math.sin(
              time * 1.7
            )
          );

        const secondBeat =
          Math.max(
            0,
            Math.sin(
              time * 1.7 - 0.8
            )
          ) * 0.35;


        decorativeHearts
          .material.opacity =
          0.72 +
          beat * 0.22 +
          secondBeat * 0.10;


        decorativeHeartGlow
          .material.opacity =
          beat * 0.45 +
          secondBeat * 0.20;
      }


      /* ===================================================
         CORAZÓN SUPERIOR
         LATIDO MÁS MARCADO
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
        heartTopGlow
      ) {

        const pulse =
          Math.max(
            0,
            Math.sin(
              time * 1.8
            )
          );


        heartTop.material.opacity =
          0.78 +
          pulse * 0.22;


        heartTopGlow.material.opacity =
          pulse * 0.55;
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
        heartBottomGlow
      ) {

        const pulse =
          Math.max(
            0,
            Math.sin(
              time * 1.65 + 1.3
            )
          );


        heartBottom.material.opacity =
          0.78 +
          pulse * 0.22;


        heartBottomGlow.material.opacity =
          pulse * 0.55;
      }


      /* ===================================================
         CRUZ
         BRILLO PERIÓDICO
      =================================================== */

      const crossGlow =
        glowMeshes["cruz.png"];

      if (crossGlow) {

        const crossPulse =
          Math.max(
            0,
            Math.sin(
              time * 0.85
            )
          );


        crossGlow.material.opacity =
          crossPulse * 0.65;
      }


      /* ===================================================
         DESTELLOS
         MUCHO MÁS VISIBLES
      =================================================== */

      const sparkles =
        layerMeshes["destellos.png"];

      const sparkleGlow =
        glowMeshes["destellos.png"];


      if (
        sparkles &&
        sparkleGlow
      ) {

        const wave1 =
          (Math.sin(
            time * 2.2
          ) + 1) / 2;


        const wave2 =
          (Math.sin(
            time * 3.7 + 1.8
          ) + 1) / 2;


        const wave3 =
          (Math.sin(
            time * 5.1 + 3.2
          ) + 1) / 2;


        sparkles.material.opacity =
          0.30 +
          wave1 * 0.35 +
          wave2 * 0.25 +
          wave3 * 0.10;


        sparkleGlow.material.opacity =
          0.12 +
          wave1 * 0.45 +
          wave2 * 0.30 +
          wave3 * 0.20;
      }


      /* ===================================================
         ESTRELLAS
      =================================================== */

      const stars =
        layerMeshes["estrellas.png"];

      if (stars) {

        const starWave =
          (Math.sin(
            time * 1.4 + 0.8
          ) + 1) / 2;


        stars.material.opacity =
          0.62 +
          starWave * 0.38;
      }


      /* ===================================================
         TEXTOS
         BRILLO QUE LOS RECORRE
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
       * Jesús:
       * un recorrido cada ~7 segundos.
       */

      if (jesusGlow) {

        const cycle =
          (
            (time % 7.0) /
            7.0
          );


        jesusGlow.material.uniforms
          .progress.value =
          -0.22 +
          cycle * 1.44;


        jesusGlow.material.uniforms
          .strength.value =
          1.15;


        /*
         * El brillo solo aparece
         * cuando está dentro de la tarjeta.
         */

        const active =
          cycle > 0.08 &&
          cycle < 0.92;


        jesusGlow.material.opacity =
          active ? 0.9 : 0;
      }


      /*
       * Comunión:
       * fase diferente para que no
       * brillen simultáneamente.
       */

      if (communionGlow) {

        const cycle =
          (
            (
              time + 3.2
            ) % 7.0
          ) / 7.0;


        communionGlow.material.uniforms
          .progress.value =
          -0.22 +
          cycle * 1.44;


        communionGlow.material.uniforms
          .strength.value =
          1.15;


        const active =
          cycle > 0.08 &&
          cycle < 0.92;


        communionGlow.material.opacity =
          active ? 0.9 : 0;
      }


      /* ===================================================
         PINCELADA
         SIEMPRE ESTABLE DETRÁS DE COMUNIÓN
      =================================================== */

      const brush =
        layerMeshes[
          "pincelada-lila.png"
        ];

      if (brush && elapsed > 0.8) {

        brush.material.opacity = 1;
      }


      /* ===================================================
         FONDO
         COMPLETAMENTE ESTABLE
      =================================================== */

      const background =
        layerMeshes[
          "fondo-limpio.png"
        ];

      if (
        background &&
        elapsed > 0.5
      ) {

        background.material.opacity = 1;
      }


      /* ===================================================
         MARCO
         COMPLETAMENTE ESTABLE
      =================================================== */

      const frame =
        layerMeshes[
          "marco-corazones.png"
        ];

      if (
        frame &&
        elapsed > 1.0
      ) {

        frame.material.opacity = 1;
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


    startButton.disabled = false;

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


  startButton.disabled = false;

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
