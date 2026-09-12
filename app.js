import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;

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
     * Todas las imágenes fueron exportadas desde el mismo
     * lienzo de 1024 × 1536 px.
     *
     * Por eso usamos un único plano de 1 × 1.5
     * para conservar exactamente la proporción.
     */

    const layers = [
      {
        file: "texto-jesus.png",
        name: "Texto Jesús",
        order: 1
      },
      {
        file: "texto-comunion.png",
        name: "Texto Comunión",
        order: 2
      },
      {
        file: "pincelada-lila.png",
        name: "Pincelada lila",
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
     * Todas las capas se desplazan la misma cantidad.
     *
     * -0.02 es el valor que ya comprobamos con pelo y cara.
     */

    const commonPosition = new THREE.Vector3(
      -0.02,
      0,
      0.02
    );

    for (const layer of layers) {
      const texture = await textureLoader.loadAsync(
        `./assets/animation/${layer.file}`
      );

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

      anchor.group.add(mesh);
    }

    anchor.onTargetFound = () => {
      status.textContent = "¡La estampita cobró vida!";
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

    renderer.setAnimationLoop(() => {
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
      "No se pudo iniciar la cámara. " +
      "Verificá el permiso de cámara de Safari."
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
