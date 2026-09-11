import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const status = document.querySelector("#status");

let mindarThree = null;
let pulse = null;
let sparkleGroup = null;
const clock = new THREE.Clock();

function makeSparkle(color = 0xf1c9df) {
  const group = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.85
  });

  const vertical = new THREE.Mesh(
    new THREE.PlaneGeometry(0.035, 0.18),
    material
  );

  const horizontal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.035),
    material
  );

  group.add(vertical);
  group.add(horizontal);

  return group;
}

function buildProofEffect() {
  const group = new THREE.Group();

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xe7b8d4,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.092, 48),
    ringMaterial
  );

  ring.position.set(0, 0.38, 0.02);

  pulse = ring;
  group.add(ring);

  sparkleGroup = new THREE.Group();

  const positions = [
    [-0.22, 0.48],
    [0.22, 0.48],
    [-0.28, 0.22],
    [0.28, 0.22]
  ];

  positions.forEach(([x, y], i) => {
    const sparkle = makeSparkle(
      i % 2 ? 0xe9d49b : 0xdcb8e7
    );

    sparkle.position.set(x, y, 0.025);
    sparkle.scale.setScalar(0.7 + i * 0.08);

    sparkleGroup.add(sparkle);
  });

  group.add(sparkleGroup);

  return group;
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

    anchor.group.add(buildProofEffect());

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
      const time = clock.getElapsedTime();

      if (pulse) {
        const wave = (Math.sin(time * 3) + 1) / 2;

        pulse.material.opacity =
          0.18 + wave * 0.55;

        pulse.scale.setScalar(
          0.85 + wave * 0.35
        );
      }

      if (sparkleGroup) {
        sparkleGroup.children.forEach((sparkle, i) => {
          const phase = time * 2 + i * 1.4;
          const alpha = (Math.sin(phase) + 1) / 2;

          sparkle.material.opacity =
            0.15 + alpha * 0.8;

          sparkle.rotation.z =
            Math.sin(phase) * 0.18;
        });
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
