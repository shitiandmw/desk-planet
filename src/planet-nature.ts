import * as THREE from 'three';
import { mesh, rng, standard, vec } from './craft';
import { elevation, landField, NORTH, PLANET_RADIUS } from './planet-surface';
import { makeTree, type Tree } from './trees';
import { BACKGROUND_TREES } from './world-layout';

export function makePlanetNature(parent: THREE.Object3D): Tree[] {
  const random = rng(862), trees: Tree[] = [];
  // Sparse grouped woods on the rest of the globe. The original settlement is unique.
  for (const location of BACKGROUND_TREES) {
    const n = vec(...location.normal);
    const tree = makeTree(location.seed, -1, true);
    tree.root.position.copy(n).multiplyScalar(PLANET_RADIUS + elevation(n));
    tree.root.quaternion.setFromUnitVectors(NORTH, n); tree.root.rotateY(random() * Math.PI * 2);
    tree.root.scale.setScalar(.14 + random() * .1);
    parent.add(tree.root); trees.push(tree);
  }

  const rockMat = standard('#a1a598');
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = rockGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const variation = 1 + .13 * Math.sin(x * 9 + z * 7) * Math.cos(y * 8);
    positions.setXYZ(i, x * variation, y * variation, z * variation);
  }
  rockGeometry.computeVertexNormals();
  const rock = new THREE.InstancedMesh(rockGeometry, rockMat, 150), dummy = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 1600 && count < 150; i++) {
    const index = (i * 557) % 1600;
    const y = 1 - 2 * (index + .5) / 1600, a = index * 2.399963;
    const n = vec(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y));
    const h = elevation(n), field = landField(n);
    if (field < .001 || (field > .06 && h < .3) || n.y > .96) continue;
    if (h < .3 && random() > .28) continue;
    const size = h > .3 ? .23 + random() * .4 : .07 + random() * .13;
    dummy.position.copy(n).multiplyScalar(PLANET_RADIUS + h - size * .18);
    dummy.quaternion.setFromUnitVectors(NORTH, n); dummy.rotateY(random() * 7);
    dummy.scale.set(size * (1 + random() * .4), size * (h > .3 ? 1.8 : .8), size);
    dummy.updateMatrix(); rock.setMatrixAt(count++, dummy.matrix);
  }
  rock.count = count; rock.castShadow = rock.receiveShadow = true; parent.add(rock);

  // A thin atmospheric rim reinforces the round silhouette without obscuring the land.
  const atmosphere = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#a9d4d4') } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform vec3 color; varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),4.); gl_FragColor=vec4(color,rim*.19); }',
    transparent: true, side: THREE.BackSide, depthWrite: false,
  });
  const rim = mesh(new THREE.SphereGeometry(PLANET_RADIUS + .095, 96, 48), atmosphere, parent); rim.castShadow = rim.receiveShadow = false;
  return trees;
}
