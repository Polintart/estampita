import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;

let hairLayer = null;
let crownLayer = null;
let bodyLayer = null;
let flowersLayer = null;
let faceLayer = null;

let kittenTopLayer = null;
let kittenBottomLayer = null;

let crossLayer = null;
let heartTopLayer = null;
let heartBottomLayer = null;

let starsLayer = null;
let sparklesLayer = null;
let heartsLayer = null;

let jesusTextLayer = null;
let communionTextLayer = null;
let purpleBrushLayer = null;
let frameLayer = null;

const animatedLayers = {};

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

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const anchor = mindarThree.addAnchor(0);
    const textureLoader = new THREE.TextureLoader();

    /*
     * Todas las imágenes fueron exportadas desde
     * el mismo lienzo de 1024 × 1536 px.
     *
     * Por eso todas utilizan exactamente el mismo
     * plano de 1 × 1.5.
     */

    const layers = [
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
        name: "Corazones",
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

    /*
     * Posición que ya comprobamos como correcta.
     */
    const commonPosition = new THREE.Vector3(
      -0.02,
      0,
      0.02
    );

    /*
     * Cargamos todas las capas.
     */

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
        depthWrite: false,
        opacity: 1
      });

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1.5),
        material
      );

      mesh.position.copy(commonPosition);
      mesh.renderOrder = layer.order;

      /*
       * Guardamos referencias individuales
       * para poder animar cada parte.
       */

      animatedLayers[layer.file] = mesh;

      if (layer.file === "nena-pelo.png") {
        hairLayer = mesh;
      }

      if (layer.file === "nena-corona.png") {
        crownLayer = mesh;
      }

      if (layer.file === "nena-cuerpo.png") {
        bodyLayer = mesh;
      }

      if (layer.file === "nena-flores.png") {
        flowersLayer = mesh;
      }

      if (layer.file === "nena-cara.png") {
        faceLayer = mesh;
      }

      if (layer.file === "gatito-superior.png") {
        kittenTopLayer = mesh;
      }

      if (layer.file === "gatito-inferior.png") {
        kittenBottomLayer = mesh;
      }

      if (layer.file === "cruz.png") {
        crossLayer = mesh;
      }

      if (layer.file === "corazon-superior.png") {
        heartTopLayer = mesh;
      }

      if (layer.file === "corazon-inferior.png") {
        heartBottomLayer = mesh;
      }

      if (layer.file === "estrellas.png") {
        starsLayer = mesh;
      }

      if (layer.file === "destellos.png") {
        sparklesLayer = mesh;
      }

      if (layer.file === "corazones.png") {
        heartsLayer = mesh;
      }

      if (layer.file === "texto-jesus.png") {
        jesusTextLayer = mesh;
      }

      if (layer.file === "texto-comunion.png") {
        communionTextLayer = mesh;
      }

      if (layer.file === "pincelada-lila.png") {
        purpleBrushLayer = mesh;
      }

      if (layer.file === "marco-corazones.png") {
        frameLayer = mesh;
      }

      anchor.group.add(mesh);
    }

    /*
     * Estado inicial.
     */

    anchor.onTargetFound = () => {
      status.textContent =
        "¡La estampita cobró vida!";

      status.classList.remove("hidden");
    };

    anchor.onTargetLost = () => {
      status.textContent =
        "Apuntá la cámara a la estampita";

      status.classList.remove("hidden");
    };

    status.textContent = "Preparando cámara…";
    status.classList.remove("hidden");

    await mindarThree.start();

    startScreen.classList.add("hidden");
    stopButton.classList.remove("hidden");

    status.textContent =
      "Apuntá la cámara a la estampita";

    /*
     * Reloj de animación.
     */

    const clock = new THREE.Clock();

    /*
     * Momento en que comienza la animación
     * de aparición.
     */

    let activationTime = null;

    /*
     * Cuando MindAR encuentra la estampita,
     * comenzamos la activación.
     */

    anchor.onTargetFound = () => {
      activationTime = clock.getElapsedTime();

      status.textContent =
        "¡La estampita cobró vida!";

      status.classList.remove("hidden");
    };

    /*
     * Animación principal.
     */

    renderer.setAnimationLoop(() => {
      const time = clock.getElapsedTime();

      /*
       * =====================================================
       * 1. NENA
       * =====================================================
       */

      /*
       * PELO
       *
       * Este es exactamente el movimiento
       * que ya probamos y aprobamos.
       */

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
       * Conservamos el movimiento que ya probamos.
       */

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
       * CUERPO
       *
       * Respiración muy leve.
       */

      if (bodyLayer) {
        bodyLayer.position.x =
          commonPosition.x +
          Math.sin(time * 0.9) * 0.0015;

        bodyLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.1) * 0.0015;
      }

      /*
       * FLORES / RAMO
       *
       * Acompañan al cuerpo.
       */

      if (flowersLayer) {
        flowersLayer.position.x =
          commonPosition.x +
          Math.sin(time * 0.9 + 0.25) * 0.002;

        flowersLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.1 + 0.25) * 0.0018;
      }

      /*
       * CARA
       *
       * Movimiento prácticamente imperceptible.
       */

      if (faceLayer) {
        faceLayer.position.x =
          commonPosition.x +
          Math.sin(time * 0.85 + 0.4) * 0.0007;

        faceLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.05 + 0.4) * 0.0007;
      }

      /*
       * =====================================================
       * 2. GATITOS
       * =====================================================
       */

      /*
       * Gatito superior:
       * flotación suave.
       */

      if (kittenTopLayer) {
        kittenTopLayer.position.x =
          commonPosition.x +
          Math.sin(time * 0.75) * 0.003;

        kittenTopLayer.position.y =
          commonPosition.y +
          Math.sin(time * 1.05) * 0.004;
      }

      /*
       * Gatito inferior:
       * mismo concepto pero desfasado.
       */

      if (kittenBottomLayer) {
        kittenBottomLayer.position.x =
          commonPosition.x +
          Math.sin(time * 0.7 + 1.8) * 0.003;

        kittenBottomLayer.position.y =
          commonPosition.y +
          Math.sin(time * 0.95 + 1.8) * 0.004;
      }

      /*
       * =====================================================
       * 3. CRUZ
       * =====================================================
       */

      if (crossLayer) {
        const crossWave =
          (Math.sin(time * 1.8) + 1) / 2;

        crossLayer.material.opacity =
          0.93 + crossWave * 0.07;
      }

      /*
       * =====================================================
       * 4. CORAZONES
       * =====================================================
       */

      if (heartTopLayer) {
        const heartWave =
          (Math.sin(time * 2.0) + 1) / 2;

        heartTopLayer.material.opacity =
          0.88 + heartWave * 0.12;
      }

      if (heartBottomLayer) {
        const heartWave =
          (Math.sin(time * 1.7 + 1) + 1) / 2;

        heartBottomLayer.material.opacity =
          0.88 + heartWave * 0.12;
      }

      /*
       * =====================================================
       * 5. DESTELLOS
       * =====================================================
       */

      if (sparklesLayer) {
        const sparkleWave =
          (Math.sin(time * 2.4) + 1) / 2;

        sparklesLayer.material.opacity =
          0.55 + sparkleWave * 0.45;
      }

      /*
       * =====================================================
       * 6. ESTRELLAS
       * =====================================================
       */

      if (starsLayer) {
        const starWave =
          (Math.sin(time * 1.8 + 0.8) + 1) / 2;

        starsLayer.material.opacity =
          0.78 + starWave * 0.22;
      }

      /*
       * =====================================================
       * 7. CORAZONES DECORATIVOS
       * =====================================================
       */

      if (heartsLayer) {
        const heartsWave =
          (Math.sin(time * 1.25 + 1.5) + 1) / 2;

        heartsLayer.material.opacity =
          0.86 + heartsWave * 0.14;
      }

      /*
       * =====================================================
       * 8. TEXTOS
       * =====================================================
       *
       * No se mueven.
       * Solo tienen una respiración luminosa
       * extremadamente sutil.
       */

      if (jesusTextLayer) {
        const textWave =
          (Math.sin(time * 0.9) + 1) / 2;

        jesusTextLayer.material.opacity =
          0.94 + textWave * 0.06;
      }

      if (communionTextLayer) {
        const textWave =
          (Math.sin(time * 1.0 + 0.5) + 1) / 2;

        communionTextLayer.material.opacity =
          0.94 + textWave * 0.06;
      }

      /*
       * =====================================================
       * 9. PINCELADA LILA
       * =====================================================
       *
       * Sigue detrás de "Comunión".
       * Solo tiene una variación mínima de luminosidad.
       */

      if (purpleBrushLayer) {
        const brushWave =
          (Math.sin(time * 0.8 + 1) + 1) / 2;

        purpleBrushLayer.material.opacity =
          0.93 + brushWave * 0.07;
      }

      /*
       * =====================================================
       * 10. MARCO
       * =====================================================
       *
       * Prácticamente estático.
       * Solo una variación mínima para darle vida.
       */

      if (frameLayer) {
        const frameWave =
          (Math.sin(time * 0.65) + 1) / 2;

        frameLayer.material.opacity =
          0.96 + frameWave * 0.04;
      }

      /*
       * =====================================================
       * 11. ACTIVACIÓN INICIAL
       * =====================================================
       *
       * Durante el primer segundo después de
       * reconocer la estampita, los elementos
       * luminosos tienen una pequeña entrada.
       */

      if (activationTime !== null) {
        const elapsed =
          time - activationTime;

        const intro =
          Math.min(elapsed / 1.2, 1);

        const easedIntro =
          1 - Math.pow(1 - intro, 3);

        /*
         * El efecto solo modifica ligeramente
         * la opacidad. No mueve ni escala las capas.
         */

        if (crossLayer) {
          crossLayer.material.opacity =
            easedIntro;
        }

        if (heartTopLayer) {
          heartTopLayer.material.opacity =
            0.55 + easedIntro * 0.45;
        }

        if (heartBottomLayer) {
          heartBottomLayer.material.opacity =
            0.55 + easedIntro * 0.45;
        }

        if (sparklesLayer) {
          sparklesLayer.material.opacity =
            easedIntro;
        }

        if (starsLayer) {
          starsLayer.material.opacity =
            0.65 + easedIntro * 0.35;
        }

        if (heartsLayer) {
          heartsLayer.material.opacity =
            0.75 + easedIntro * 0.25;
        }

        if (intro >= 1) {
          activationTime = null;
        }
      }

      /*
       * Render final.
       */

      renderer.render(scene, camera);
    });

  } catch (error) {
    console.error(
      "Error iniciando MindAR:",
      error
    );

    if (mindarThree) {
      try {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
      } catch (e) {}
    }

    mindarThree = null;

    startButton.disabled = false;
    startButton.textContent =
      "Intentar nuevamente";

    status.textContent =
      "No se pudo iniciar la cámara.";

    status.classList.remove("hidden");

    alert(
      "ERROR REAL: " +
      JSON.stringify(error)
    );
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
}

startButton.addEventListener(
  "click",
  startAR
);

stopButton.addEventListener(
  "click",
  stopAR
);
