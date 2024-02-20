var container;
var camera, scene, raycaster, renderer;
var mouse = new THREE.Vector2();
var mouseThree = new THREE.Vector2();
var mouseOld = new THREE.Vector2();
var mouseDown = new THREE.Vector2();
var INTERSECTED;

var globe;
var globeRotationSpeed = new THREE.Vector2();
var globeRotationOld = new THREE.Vector2();
var isGrabbed = false;
var isExpanded = false;

var sphereMesh;
var globeRadius = 500;
var sensivity = 0.002;
var degToRad = Math.PI / 180;
var int_arr = [];
var points_arr = [];

var countries_json;
var borders_json;

function loadJSON(theUrl, callback) {
  var xobj = new XMLHttpRequest();
  xobj.overrideMimeType("application/json");
  xobj.open("GET", theUrl, true);
  xobj.onreadystatechange = function () {
    if (xobj.readyState == 4 && xobj.status == "200")
      callback(xobj.responseText);
  };
  xobj.send(null);
}

loadJSON("json/latest.json", function (response) {
  countries_json = JSON.parse(response);
  loadJSON("json/continents_tiny.geo.json", function (response) {
    borders_json = JSON.parse(response);
    init();
    animate();
  });
});

function setCursorPointer() {
  document.body.style.cursor = "pointer";
}

function setCursorGrabbing() {
  document.body.style.cursor = "-webkit-grabbing";
  document.body.style.cursor = "-moz-grabbing";
}

function setCursorGrab() {
  if (!isGrabbed) {
    document.body.style.cursor = "-webkit-grab";
    document.body.style.cursor = "-moz-grab";
  }
}

Object.sortByKeys = function (myObj) {
  var keys = Object.keys(myObj);
  keys.sort();
  var sortedObject = Object();
  for (i in keys) {
    key = keys[i];
    sortedObject[key] = myObj[key];
  }
  return sortedObject;
};

function init() {
  container = document.getElementById("container");
  setCursorGrab();
  camera = new THREE.PerspectiveCamera(
    27,
    window.innerWidth / window.innerHeight,
    1,
    4000
  );
  camera.position.z = 3000;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf1f1f1, 3000, 3500);

  globe = new THREE.Object3D();
  pointsGeometry = new THREE.Geometry();
  for (var i in borders_json.features) {
    for (var j in borders_json.features[i].geometry.coordinates) {
      var vertexRotation = new THREE.Vector2();
      vertexRotation.fromArray(
        borders_json.features[i].geometry.coordinates[j]
      );
      vertexRotation.multiplyScalar(degToRad);

      pointsGeometry.vertices.push(getPosition(vertexRotation));
      points_arr.push(vertexRotation);
    }
  }

  pointsMaterial = new THREE.PointsMaterial({ color: 0x333333, size: 10 });
  particles = new THREE.Points(pointsGeometry, pointsMaterial);

  globe.add(particles);
  globe.position.y = 50;
  var sphereGeometry = new THREE.SphereGeometry(globeRadius - 1, 60, 60);
  var sphereMaterial = new THREE.MeshPhongMaterial({
    color: 0xeeeeee,
    emissive: 0x999999,
    transparent: true,
    opacity: 0.3,
  });
  sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphereMesh.position.y = 50;
  scene.add(sphereMesh);
  int_arr.push(sphereMesh);

  for (var country of countries_json) {
    if (country.level === "country") {
      var cylinderHeight = (country.cases / country.population) * 10000;
      var cylinderGeometry = new THREE.CylinderGeometry(0, 9, cylinderHeight);
      var cylinderMatrix = new THREE.Matrix4();
      cylinderMatrix.makeTranslation(0, cylinderHeight / 2, 0);
      cylinderGeometry.applyMatrix(cylinderMatrix);
      cylinderMatrix.makeRotationX(Math.PI / 2);
      cylinderGeometry.applyMatrix(cylinderMatrix);

      var theColor = new THREE.Color(0xff0000);
      var cylinderMaterial = new THREE.MeshPhongMaterial({
        color: theColor,
        shading: THREE.FlatShading,
      });
      var cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      var vertexRotation = new THREE.Vector2();
      vertexRotation.fromArray(country.coordinates);
      vertexRotation.multiplyScalar(degToRad);

      cylinderMesh.position.copy(getPosition(vertexRotation));
      cylinderMesh.rotateY(vertexRotation.x);
      cylinderMesh.rotateX(-vertexRotation.y);
      cylinderMesh.cityName = decodeURI(country.countryName);
      cylinderMesh.cityValue = country.cases;
      cylinderMesh.vertexRotation = vertexRotation;
      globe.add(cylinderMesh);
      int_arr.push(cylinderMesh);
    }
  }
  scene.add(globe);

  var pointLight = new THREE.PointLight();
  pointLight.position.set(1000, 500, 3000);
  scene.add(pointLight);

  camera.lookAt(scene.position);
  raycaster = new THREE.Raycaster();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(scene.fog.color);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  document.addEventListener("mousedown", onDocumentMouseDown, false);
  document.addEventListener("mouseup", onDocumentMouseUp, false);
  document.addEventListener("mousemove", onDocumentMouseMove, false);
  window.addEventListener("resize", onWindowResize, false);
}

function getPosition(rotVal) {
  var position = new THREE.Vector3();
  if (isExpanded) {
    position.x = (rotVal.x / Math.PI) * 1200;
    position.y = (rotVal.y / Math.PI) * 1200;
    position.z = 0;
  } else {
    var radius = Math.cos(rotVal.y) * globeRadius;
    position.x = Math.sin(rotVal.x) * radius;
    position.y = Math.sin(rotVal.y) * globeRadius;
    position.z = Math.cos(rotVal.x) * radius;
  }
  return position;
}

function getShortestAngle(theAngle) {
  theAngle %= Math.PI * 2;
  return ((theAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function changeView() {
  for (var i in int_arr) {
    var obj = int_arr[i];
    if (obj.vertexRotation != undefined) {
      var coords = getPosition(obj.vertexRotation);
      var rotX = 0,
        rotY = 0,
        rotZ = 0;
      if (!isExpanded) {
        obj.rotateY(obj.vertexRotation.x);
        obj.rotateX(-obj.vertexRotation.y);
        rotX = obj.rotation.x;
        rotY = obj.rotation.y;
        rotZ = obj.rotation.z;
        obj.rotation.set(0, 0, 0);
      }
      TweenMax.to(obj.position, 0.6, {
        x: coords.x,
        y: coords.y,
        z: coords.z,
        ease: Expo.easeInOut,
      });
      TweenMax.to(obj.rotation, 0.6, {
        x: rotX,
        y: rotY,
        z: rotZ,
        ease: Expo.easeInOut,
      });
    }
  }
  for (var j in points_arr) {
    var vertex = pointsGeometry.vertices[j];
    var coords = getPosition(points_arr[j]);

    var props = { x: coords.x, y: coords.y, z: coords.z, ease: Expo.easeInOut };
    if (j == 0)
      props.onUpdate = function () {
        pointsGeometry.verticesNeedUpdate = true;
      };
    TweenMax.to(vertex, 0.6, props);
  }
  TweenMax.to(sphereMesh.material, 0.6, {
    opacity: isExpanded ? 0 : 0.3,
    ease: Expo.easeInOut,
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseDown(event) {
  mouseDown.copy(mouse);
  globeRotationOld.copy(globe.rotation);
  if (!isExpanded) {
    setCursorGrabbing();
    mouseOld.copy(mouse);
    globeRotationSpeed.multiplyScalar(0);
    isGrabbed = true;
  }
}

function onDocumentMouseUp(event) {
  isGrabbed = false;
  setCursorGrab();
  var distance = mouseDown.distanceTo(mouse);
  if (distance == 0 && INTERSECTED != null) {
    setCursorPointer();
    isExpanded = !isExpanded;
    globe.rotation.y = getShortestAngle(globe.rotation.y);
    TweenMax.to(globe.rotation, 0.6, { x: 0, y: 0, ease: Expo.easeOut });
    changeView();
  }
}

function onDocumentMouseMove(event) {
  event.preventDefault();
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouseThree.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseThree.y = -(event.clientY / window.innerHeight) * 2 + 1;
  if (isGrabbed) {
    globe.rotation.y = globeRotationOld.y + (mouse.x - mouseDown.x) * sensivity;
    globe.rotation.x = globeRotationOld.x + (mouse.y - mouseDown.y) * sensivity;
    globeRotationSpeed.y = (mouse.x - mouseOld.x) * sensivity;
    globeRotationSpeed.x = (mouse.y - mouseOld.y) * sensivity;
    mouseOld.copy(mouse);
  }
}

function valBetween(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function returnToNormal() {
  if (INTERSECTED) {
    INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
    TweenMax.to(INTERSECTED.scale, 0.3, { x: 1, y: 1, z: 1 });
  }
  TweenMax.to(document.getElementById("cityName"), 0.5, { opacity: 0 });
  TweenMax.to(document.getElementById("cityDesc"), 0.5, { opacity: 0 });
  setCursorGrab();
}

function render() {
  if (!isExpanded && !isGrabbed) {
    raycaster.setFromCamera(mouseThree, camera);
    var intersects = raycaster.intersectObjects(int_arr);
    if (intersects.length > 0 && intersects[0].object.cityName) {
      if (INTERSECTED != intersects[0].object) {
        returnToNormal();
        INTERSECTED = intersects[0].object;
        INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
        INTERSECTED.material.emissive.setHex(0xff0000);
        cityValue = INTERSECTED.cityValue;
        document.getElementById("cityName").innerHTML = INTERSECTED.cityName;
        if (cityValue != undefined)
          document.getElementById("cityValue").innerHTML =
            cityValue.toLocaleString();
        TweenMax.to(document.getElementById("cityName"), 0.3, { opacity: 1 });
        TweenMax.to(document.getElementById("cityDesc"), 0.3, { opacity: 1 });
        if (!isGrabbed) setCursorPointer();
        TweenMax.to(INTERSECTED.scale, 0.15, {
          x: 1.5,
          y: 1.5,
          z: 1.5,
        });
      }
    } else {
      returnToNormal();
      INTERSECTED = null;
    }
    if (!isGrabbed) {
      globeRotationSpeed.multiplyScalar(0.97);
      globe.rotation.x += globeRotationSpeed.x;
      globe.rotation.y += globeRotationSpeed.y;
    }
  }

  globe.rotation.x = valBetween(globe.rotation.x, -Math.PI / 2, Math.PI / 2);
  renderer.render(scene, camera);
}
