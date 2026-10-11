const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
const window = { HoopWireCore: require('../js/coverage/core.js') };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/render/replay.js'), 'utf8'), { window });
const R = window.HoopWireReplay;
const scene = (variant, side = 'right') => ({
  kind: 'action',
  pose: variant.startsWith('dunk') ? 'dunking' : 'shooting',
  action: { variant, side },
  player: { id: 7, fn: 'Wendell', ln: 'Byrd' },
  team: { id: 1, name: 'Ospreys' },
  opponent: { id: 2, name: 'Kestrels' },
});

test('only action pictures of a player get a replay', () => {
  assert.equal(R.available(scene('three-point')), true);
  assert.equal(R.available(scene('injury')), false);
  assert.equal(R.available({ ...scene('dunk'), kind: 'interview' }), false);
  assert.equal(R.available({ ...scene('dunk'), player: null }), false);
  assert.equal(R.plan({ ...scene('injury-close'), pose: 'injured-leg' }, { id: 'a' }), null);
});

test('clips are short, deterministic and follow the picture', () => {
  const dunk = R.plan(scene('dunk-tight', 'left'), { id: 'story-1' });
  assert.equal(dunk.kind, 'dunk');
  assert.equal(dunk.side, 'left');
  const three = R.plan(scene('three-point'), { id: 'story-2' });
  assert.equal(three.kind, 'jumper');
  assert.equal(three.pts, 3);
  assert.deepEqual(R.plan(scene('three-point'), { id: 'story-2' }), three);
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f'])
    for (const variant of ['pass', 'drive', 'close-up', 'shot-close-up']) {
      const clip = R.plan(scene(variant), { id });
      assert.ok(clip.duration >= 3 && clip.duration <= 5, `${variant} ${clip.duration}`);
    }
});

test('a jumper goes up from its spot and drops through the rim', () => {
  for (const name of Object.keys(R.SPOTS)) {
    const clip = { kind: 'jumper', side: 'right', spot: R.SPOTS[name].shot, pts: R.SPOTS[name].pts, duration: 4.4 };
    const start = R.frameAt(clip, 0),
      shot = R.frameAt(clip, 1.75),
      end = R.frameAt(clip, clip.duration);
    assert.equal(start.shooter.pose, 'dribbling');
    assert.equal(shot.shooter.pose, 'shooting');
    assert.deepEqual([shot.shooter.x, shot.shooter.foot], [...R.SPOTS[name].shot]);
    assert.ok(shot.shooter.lift > 0);
    assert.ok(start.made < clip.duration - 1, name);
    const atRim = R.frameAt(clip, start.made);
    assert.ok(Math.abs(atRim.ball.x - R.RIM[0]) < 0.5 && Math.abs(atRim.ball.y - R.RIM[1]) < 0.5, name);
    assert.equal(atRim.ball.behind, true);
    assert.equal(end.shooter.pose, 'celebrate');
    assert.ok(end.ball.y > R.RIM[1] + 40, 'the ball ends on the floor');
  }
});

test('a dunk hangs on the rim, then lands', () => {
  const clip = { kind: 'dunk', side: 'right', start: [640, 340], pts: 2, duration: 4 };
  // Rising toward the basket with the ball cocked back, facing it.
  const rise = R.frameAt(clip, 1.5);
  assert.equal(rise.shooter.pose, 'dunking');
  assert.equal(rise.shooter.facing, 'right');
  // Then the game's hanging frame, its hand (pixel 8, 11 of the left-facing cell) on the front of the rim.
  const slam = R.frameAt(clip, 1.7),
    hand = [slam.shooter.x + 7, slam.shooter.foot - slam.shooter.lift - 22];
  assert.equal(slam.shooter.pose, 'dunk-released');
  assert.equal(slam.shooter.frame, 0);
  assert.equal(slam.shooter.facing, 'right');
  assert.ok(Math.abs(hand[0] - (R.RIM[0] - 6)) <= 3 && Math.abs(hand[1] - R.RIM[1]) <= 3, `hand at ${hand}`);
  assert.ok(slam.shake > 0);
  // Letting go (frames 1 and 2), the landing with arms up (frame 3), then the celebration.
  assert.deepEqual(
    [2.18, 2.26, 2.45].map(t => R.frameAt(clip, t).shooter.frame),
    [1, 2, 3]
  );
  const end = R.frameAt(clip, 4);
  assert.equal(end.shooter.lift, 0);
  assert.equal(end.shooter.pose, 'celebrate');
});

test('the camera keeps a 16:9 frame on the court', () => {
  const clip = R.plan(scene('three-point'), { id: 'cam' });
  for (let t = 0; t <= clip.duration; t += 0.25) {
    const { camera } = R.frameAt(clip, t);
    assert.ok(Math.abs(camera.h - (camera.w * 9) / 16) < 1e-9);
    assert.ok(camera.w >= 200 && camera.w <= 400);
    assert.ok(camera.x > 0 && camera.x < 1024 && camera.y > 0 && camera.y < 512);
  }
});

test('the save’s last game supplies real made shots for its own story only', () => {
  const ev = (play, pid, type, pts, posX, posY) => ({ play, shotData: { pid, type, pts, posX, posY } });
  const league = {
    currentGame: {
      gId: 16,
      inProgress: false,
      playByPlay: [ev(2, 7, 8, 3, -4.6, 2.8), ev(3, 7, 7, 2, 6, 1), ev(2, 7, 9, 1, 0, 0), ev(2, 8, 0, 2, 8.6, 0)],
    },
  };
  const shots = R.madeShots(league, { gid: 16 }, 7);
  assert.equal(shots.length, 1);
  assert.deepEqual({ ...shots[0] }, { x: 512 - 4.6 * 32, y: 256 - 2.8 * 32, type: 8, pts: 3 });
  assert.equal(R.madeShots(league, { gid: 15 }, 7).length, 0);
  const clip = R.plan(scene('pass'), { id: 'real' }, shots);
  assert.equal(clip.real, true);
  assert.equal(clip.side, 'left');
  assert.equal(clip.pts, 3);
  assert.ok(Math.abs(clip.spot[0] - (1024 - shots[0].x)) < 1e-9);
  const rim = R.plan(scene('pass'), { id: 'real' }, [{ x: 790, y: 258, type: 0, pts: 2 }]);
  assert.equal(rim.kind, 'dunk');
});

test('the net swishes and the rim bends with the game’s own timing', () => {
  // Hoop Land's net_swish: frames 0, 1, 2, 3, 2, 1, 0 over 0.35 seconds.
  assert.deepEqual(
    [-0.01, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 1].map(R.netFrame),
    [0, 0, 1, 2, 3, 3, 2, 1, 0, 0]
  );
  const jumper = { kind: 'jumper', side: 'right', spot: R.SPOTS.elbow.shot, pts: 2, duration: 4.4 },
    made = R.frameAt(jumper, 0).made;
  assert.equal(R.frameAt(jumper, made - 0.1).hoop.net, 0);
  assert.equal(R.frameAt(jumper, made + 0.16).hoop.net, 3);
  assert.equal(R.frameAt(jumper, made + 0.16).hoop.tilt, 0, 'a swish leaves the rim still');
  // A dunk pulls the rim down while the dunker hangs and wobbles it back on release.
  const dunk = { kind: 'dunk', side: 'right', start: [640, 340], pts: 2, duration: 4 },
    slam = R.frameAt(dunk, 0).made;
  assert.equal(R.frameAt(dunk, slam - 0.05).hoop.tilt, 0);
  assert.equal(R.frameAt(dunk, slam + 0.1).hoop.tilt, -2);
  assert.equal(R.frameAt(dunk, slam + 0.4).hoop.tilt, -1.5);
  const wobble = [0.1, 0.2, 0.3].map(u => R.frameAt(dunk, 2.15 + u).hoop.tilt);
  assert.deepEqual(wobble, [1, -0.75, 0.25]);
  assert.equal(R.frameAt(dunk, 3).hoop.tilt, 0);
});

test('the camera never jumps between frames', () => {
  for (const clip of [
    { kind: 'jumper', side: 'right', spot: R.SPOTS['corner-three'].shot, pts: 3, duration: 4.4 },
    { kind: 'jumper', side: 'left', spot: R.SPOTS['top-three'].shot, pts: 3, duration: 4.4 },
    { kind: 'dunk', side: 'right', start: [596, 262], pts: 2, duration: 4 },
  ]) {
    let a = R.frameAt(clip, 0).camera,
      b = R.frameAt(clip, 1 / 60).camera;
    for (let t = 2 / 60; t <= clip.duration; t += 1 / 60) {
      const c = R.frameAt(clip, t).camera;
      // At 60 frames a second it can move quickly with the ball, but never lurches: its speed changes by
      // under a court pixel from one frame to the next.
      assert.ok(Math.hypot(c.x - b.x, c.y - b.y) < 6, `${clip.kind} races at ${t.toFixed(2)}`);
      assert.ok(Math.hypot(c.x - 2 * b.x + a.x, c.y - 2 * b.y + a.y) < 1, `${clip.kind} lurches at ${t.toFixed(2)}`);
      a = b;
      b = c;
    }
  }
});
