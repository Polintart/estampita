import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;
let layerMeshes = {};

const commonPosition = new THREE.Vector3(-0.02, 0, 0.02);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  value = clamp01(value);
  return 1 - Math.pow(1 - value, 3);
}

async function startAR() {
  startButton.disabled = true;
  startButton.textContent = "Abriendo cámara…";

  try {
    mindarThree = new MindARThree({
      container: document.querySelector("#ar-container"),
      imageTargetSrc: "./targets/estampita.mind",
      maxTrack: 1,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no"
    });

    const { renderer, scene, camera } = mindarThree;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const anchor = mindarThree.addAnchor(0);
    const textureLoader = new THREE.TextureLoader();

    const layers = [
      // FONDO DIGITAL: tapa la estampita física
      { file: "fondo-limpio.png", name: "Fondo limpio", order: 0 },

      // TEXTOS
      { file: "texto-jesus.png", name: "Texto Jesús", order: 1 },
      { file: "pincelada-lila.png", name: "Pincelada lila", order: 2 },
      { file: "texto-comunion.png", name: "Texto Comunión", order: 3 },

      // ELEMENTOS PRINCIPALES
      { file: "corazon-inferior.png", name: "Corazón inferior", order: 4 },
      { file: "corazon-superior.png", name: "Corazón superior", order: 5 },
      { file: "cruz.png", name: "Cruz", order: 6 },

      // NENA
      { file: "nena-cuerpo.png", name: "Nena cuerpo", order: 10 },
      { file: "nena-flores.png", name: "Nena flores", order: 11 },
      { file: "nena-cara.png", name: "Nena cara", order: 12 },
      { file: "nena-pelo.png", name: "Nena pelo", order: 13 },
      { file: "nena-corona.png", name: "Nena corona", order: 14 },

      // GATITOS
      { file: "gatito-superior.png", name: "Gatito superior", order: 20 },
      { file: "gatito-inferior.png", name: "Gatito inferior", order: 21 },

      // DECORACIÓN
      { file: "corazones.png", name: "Corazones", order: 30 },
      { file: "estrellas.png", name: "Estrellas", order: 31 },
      { file: "destellos.png", name: "Destellos", order: 32 },
      { file: "marco-corazones.png", name: "Marco corazones", order: 40 }
    ];

    for (const layer of layers) {
      let texture;

      try {
        texture = await textureLoader.loadAsync(
          `./assets/animation/${layer.file}`
        );
      } catch (error) {
        alert("NO SE PUDO CARGAR: " + layer.file);
        throw error;
      }

      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.01,
        depthTest: false,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1.5),
        material
      );

      mesh.position.copy(commonPosition);
      mesh.renderOrder = layer.order;

      layerMeshes[layer.file] = mesh;

      anchor.group.add(mesh);
    }

    /*
     * ESTADO INICIAL
     *
     * El fondo aparece rápidamente.
     * El resto de los elementos hacen una pequeña entrada
     * cuando MindAR reconoce la estampita.
     */

    layerMeshes["fondo-limpio.png"].material.opacity = 0;

    const introLayers = [
      "texto-jesus.png",
      "pincelada-lila.png",
      "texto-comunion.png",
      "corazon-inferior.png",
      "corazon-superior.png",
      "cruz.png",
      "nena-cuerpo.png",
      "nena-flores.png",
      "nena-cara.png",
      "nena-pelo.png",
      "nena-corona.png",
      "gatito-superior.png",
      "gatito-inferior.png",
      "corazones.png",
      "estrellas.png",
      "destellos.png",
      "marco-corazones.png"
    ];

    for (const file of introLayers) {
      if (layerMeshes[file]) {
        layerMeshes[file].material.opacity = 0;
      }
    }

    let targetFoundTime = null;

    anchor.onTargetFound = () => {
      targetFoundTime = performance.now();

      status.textContent = "¡La estampita cobró vida!";
      status.classList.remove("hidden");
    };

    anchor.onTargetLost = () => {
      targetFoundTime = null;

      status.textContent = "Apuntá la cámara a la estampita";
      status.classList.remove("hidden");
    };

    status.textContent = "Preparando cámara…";
    status.classList.remove("hidden");

    await mindarThree.start();

    startScreen.classList.add("hidden");
    stopButton.classList.remove("hidden");

    status.textContent = "Apuntá la cámara a la estampita";

    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
      const time = clock.getElapsedTime();

      /*
       * ------------------------------------------------
       * ANIMACIÓN DE APARICIÓN
       * ------------------------------------------------
       */

      if (targetFoundTime !== null) {
        const elapsed =
          (performance.now() - targetFoundTime) / 1000;

        // Fondo: aparece primero.
        const bgProgress = easeOutCubic(elapsed / 0.45);

        if (layerMeshes["fondo-limpio.png"]) {
          layerMeshes["fondo-limpio.png"].material.opacity =
            bgProgress;
        }

        // Textos y pincelada.
        const textProgress = easeOutCubic(
          (elapsed - 0.12) / 0.85
        );

        if (layerMeshes["pincelada-lila.png"]) {
          layerMeshes["pincelada-lila.png"].material.opacity =
            textProgress;
        }

        if (layerMeshes["texto-comunion.png"]) {
          layerMeshes["texto-comunion.png"].material.opacity =
            textProgress;
        }

        const jesusProgress = easeOutCubic(
          (elapsed - 0.28) / 0.9
        );

        if (layerMeshes["texto-jesus.png"]) {
          layerMeshes["texto-jesus.png"].material.opacity =
            jesusProgress;
        }

        // Cruz.
        const crossProgress = easeOutCubic(
          (elapsed - 0.25) / 0.7
        );

        if (layerMeshes["cruz.png"]) {
          layerMeshes["cruz.png"].material.opacity =
            crossProgress;
        }

        // Corazones.
        const heartProgress = easeOutCubic(
          (elapsed - 0.35) / 0.75
        );

        if (layerMeshes["corazon-superior.png"]) {
          layerMeshes["corazon-superior.png"].material.opacity =
            heartProgress;
        }

        if (layerMeshes["corazon-inferior.png"]) {
          layerMeshes["corazon-inferior.png"].material.opacity =
            heartProgress;
        }

        // Nena.
        const girlProgress = easeOutCubic(
          (elapsed - 0.18) / 0.85
        );

        [
          "nena-cuerpo.png",
          "nena-flores.png",
          "nena-cara.png",
          "nena-pelo.png",
          "nena-corona.png"
        ].forEach((file) => {
          if (layerMeshes[file]) {
            layerMeshes[file].material.opacity =
              girlProgress;
          }
        });

        // Gatitos.
        const catProgress = easeOutCubic(
          (elapsed - 0.45) / 0.8
        );

        [
          "gatito-superior.png",
          "gatito-inferior.png"
        ].forEach((file) => {
          if (layerMeshes[file]) {
            layerMeshes[file].material.opacity =
              catProgress;
          }
        });

        // Decoración.
        const decorationProgress = easeOutCubic(
          (elapsed - 0.35) / 0.9
        );

        [
          "corazones.png",
          "estrellas.png",
          "destellos.png",
          "marco-corazones.png"
        ].forEach((file) => {
          if (layerMeshes[file]) {
            layerMeshes[file].material.opacity =
              decorationProgress;
          }
        });
      }

      /*
       * ------------------------------------------------
       * MOVIMIENTO AMBIENTAL
       * ------------------------------------------------
       */

      /*
       * NENA — cuerpo
       *
       * Movimiento prácticamente imperceptible,
       * como una respiración.
       */

      const body = layerMeshes["nena-cuerpo.png"];

      if (body) {
        body.position.x =
          commonPosition.x +
          Math.sin(time * 0.9) * 0.0015;

        body.position.y =
          commonPosition.y +
          Math.sin(time * 1.15) * 0.001;
      }

      /*
       * FLORES
       */

      const flowers = layerMeshes["nena-flores.png"];

      if (flowers) {
        flowers.position.x =
          commonPosition.x +
          Math.sin(time * 1.05 + 0.7) * 0.002;

        flowers.position.y =
          commonPosition.y +
          Math.sin(time * 1.25 + 0.4) * 0.0015;
      }

      /*
       * PELO
       *
       * ESTE ES EL MOVIMIENTO QUE YA HABÍAMOS
       * VALIDADO Y QUE FUNCIONABA BIEN.
       */

      const hairLayer = layerMeshes["nena-pelo.png"];

      if (hairLayer) {
        hairLayer.position.x =
          commonPosition.x +
          Math.sin(time * 1.2) * 0.004;

        hairLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.5) * 0.002;
      }

      /*
       * CORONA
       *
       * También conserva exactamente el movimiento
       * que ya habíamos aprobado.
       */

      const crownLayer = layerMeshes["nena-corona.png"];

      if (crownLayer) {
        crownLayer.position.x =
          commonPosition.x +
          Math.sin(time * 1.2 + 0.3) * 0.003;

        crownLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.5 + 0.3) * 0.0015;

        crownLayer.rotation.z =
          Math.sin(time * 1.1) * 0.008;
      }

      /*
       * CARA
       *
       * Movimiento mínimo para acompañar al pelo.
       */

      const face = layerMeshes["nena-cara.png"];

      if (face) {
        face.position.x =
          commonPosition.x +
          Math.sin(time * 0.95 + 0.8) * 0.0008;

        face.position.y =
          commonPosition.y +
          Math.sin(time * 1.1 + 0.5) * 0.0006;
      }

      /*
       * ------------------------------------------------
       * GATITO SUPERIOR
       * ------------------------------------------------
       */

      const catTop = layerMeshes["gatito-superior.png"];

      if (catTop) {
        catTop.position.x =
          commonPosition.x +
          Math.sin(time * 0.75 + 1.5) * 0.003;

        catTop.position.y =
          commonPosition.y +
          Math.sin(time * 1.0 + 0.5) * 0.004;
      }

      /*
       * ------------------------------------------------
       * GATITO INFERIOR
       * ------------------------------------------------
       */

      const catBottom = layerMeshes["gatito-inferior.png"];

      if (catBottom) {
        catBottom.position.x =
          commonPosition.x +
          Math.sin(time * 0.65 + 3.0) * 0.0025;

        catBottom.position.y =
          commonPosition.y +
          Math.sin(time * 0.9 + 2.0) * 0.0035;
      }

      /*
       * ------------------------------------------------
       * CORAZÓN SUPERIOR
       *
       * Pulso muy suave pero visible.
       */

      const heartTop = layerMeshes["corazon-superior.png"];

      if (heartTop) {
        const pulse =
          (Math.sin(time * 2.0) + 1) / 2;

        heartTop.material.opacity =
          0.78 + pulse * 0.22;
      }

      /*
       * CORAZÓN INFERIOR
       */

      const heartBottom =
        layerMeshes["corazon-inferior.png"];

      if (heartBottom) {
        const pulse =
          (Math.sin(time * 1.65 + 1.2) + 1) / 2;

        heartBottom.material.opacity =
          0.78 + pulse * 0.22;
      }

      /*
       * ------------------------------------------------
       * CRUZ
       *
       * Pequeño resplandor periódico.
       */

      const cross = layerMeshes["cruz.png"];

      if (cross) {
        const glow =
          (Math.sin(time * 1.35 + 0.5) + 1) / 2;

        cross.material.opacity =
          0.72 + glow * 0.28;
      }

      /*
       * ------------------------------------------------
       * DESTELLOS
       *
       * Este es deliberadamente más visible que antes.
       */

      const sparkles =
        layerMeshes["destellos.png"];

      if (sparkles) {
        const sparkleWave =
          (Math.sin(time * 2.8) + 1) / 2;

        const sparkleWave2 =
          (Math.sin(time * 4.1 + 1.7) + 1) / 2;

        sparkles.material.opacity =
          0.20 +
          sparkleWave * 0.50 +
          sparkleWave2 * 0.30;
      }

      /*
       * ------------------------------------------------
       * ESTRELLAS
       */

      const stars = layerMeshes["estrellas.png"];

      if (stars) {
        const starWave =
          (Math.sin(time * 1.8 + 0.8) + 1) / 2;

        stars.material.opacity =
          0.60 + starWave * 0.40;
      }

      /*
       * ------------------------------------------------
       * CORAZONES DECORATIVOS
       */

      const hearts =
        layerMeshes["corazones.png"];

      if (hearts) {
        const heartWave =
          (Math.sin(time * 1.25 + 2.0) + 1) / 2;

        hearts.material.opacity =
          0.72 + heartWave * 0.28;
      }

      /*
       * ------------------------------------------------
       * TEXTOS
       *
       * No se desplazan para evitar cualquier
       * desalineación. El movimiento es de luminosidad.
       */

      const textJesus =
        layerMeshes["texto-jesus.png"];

      if (textJesus) {
        const wave =
          (Math.sin(time * 0.8 + 1.5) + 1) / 2;

        textJesus.material.opacity =
          0.90 + wave * 0.10;
      }

      const textComunion =
        layerMeshes["texto-comunion.png"];

      if (textComunion) {
        const wave =
          (Math.sin(time * 0.75) + 1) / 2;

        textComunion.material.opacity =
          0.90 + wave * 0.10;
      }

      /*
       * La pincelada queda estable detrás del texto.
       */

      const brush =
        layerMeshes["pincelada-lila.png"];

      if (brush) {
        brush.material.opacity = 1;
      }

      /*
       * El fondo NO se mueve.
       * El marco tampoco.
       */

      const background =
        layerMeshes["fondo-limpio.png"];

      if (background && targetFoundTime !== null) {
        const elapsed =
          (performance.now() - targetFoundTime) / 1000;

        if (elapsed >= 0.5) {
          background.material.opacity = 1;
        }
      }

      renderer.render(scene, camera);
    });

  } catch (error) {
    console.error("Error iniciando MindAR:", error);

    if (mindarThree) {
      try {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
      } catch (e) {}
    }

    mindarThree = null;

    startButton.disabled = false;
    startButton.textContent = "Intentar nuevamente";

    status.textContent = "No se pudo iniciar la cámara.";
    status.classList.remove("hidden");

    alert("ERROR REAL: " + JSON.stringify(error));
  }
}

function stopAR() {
  if (!mindarThree) return;

  mindarThree.stop();
  mindarThree.renderer.setAnimationLoop(null);

  stopButton.classList.add("hidden");
  status.classList.add("hidden");

  startScreen.classList.remove("hidden");

  startButton.disabled = false;
  startButton.textContent = "Comenzar";

  mindarThree = null;
  layerMeshes = {};
}

startButton.addEventListener("click", startAR);
stopButton.addEventListener("click", stopAR);
