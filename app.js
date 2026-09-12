import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;
let hairLayer = null;

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

    const {
      renderer,
      scene,
      camera
    } = mindarThree;

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const anchor = mindarThree.addAnchor(0);

    const textureLoader = new THREE.TextureLoader();

    const hairTexture = await textureLoader.loadAsync(
      "./assets/animation/nena-pelo.png"
    );

    hairTexture.colorSpace = THREE.SRGBColorSpace;

    const hairMaterial = new THREE.MeshBasicMaterial({
      map: hairTexture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: false,
      depthWrite: false
    });

    hairLayer = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      hairMaterial
    );

    hairLayer.position.set(-0.02, 0, 0.02);
    hairLayer.renderOrder = 10;

    anchor.group.add(hairLayer);

    anchor.onTargetFound = () => {
      status.textContent = "¡La estampita cobró vida!";
      status.classList.remove("hidden");
    };

    anchor.onTargetLost = () => {
      status.textContent = "Apuntá la cámara a la estampita";
      status.classList.remove("hidden");
    };

    status.textContent = "Preparando cámara…";
    status.classList.remove("hidden");

    await mindarThree.start();

    startScreen.classList.add("hidden");
    stopButton.classList.remove("hidden");

    status.textContent = "Apuntá la cámara a la estampita";

    renderer.setAnimationLoop(() => {
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

startButton.addEventListener("click", startAR);

stopButton.addEventListener("click", stopAR);
