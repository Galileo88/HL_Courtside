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
  const slam = R.frameAt(clip, 1.7),
    end = R.frameAt(clip, 4);
  assert.equal(slam.shooter.pose, 'dunking');
  assert.ok(slam.shooter.lift > 50);
  assert.ok(slam.shake > 0);
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
