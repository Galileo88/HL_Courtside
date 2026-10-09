/* Pixel-art story scenes, composed at the game's court and player scale. */
(() => {
  'use strict';
  const art = {};
  let ready;
  function load() {
    ready ||= Promise.all([
      window.HoopWirePlayer.ready(),
      ...['press-background', 'press-table', 'press-table_2p'].map(async name => {
        const image = new Image();
        image.src = `assets/scene/${name}.png`;
        await image.decode();
        art[name] = image;
      }),
    ]);
    return ready;
  }
  function teamSnapshot(team) {
    return structuredClone({
      id: team?.id,
      city: team?.city,
      name: team?.name,
      shortName: team?.shortName,
      logoURL: team?.logoURL || null,
      teamColors: team?.teamColors,
      uniforms: team?.uniforms,
      court: team?.court,
    });
  }
  function playerSnapshot(player) {
    if (!player) return null;
    return structuredClone({
      id: player.id,
      tid: player.tid,
      fn: player.fn,
      ln: player.ln,
      num: player.num,
      appearance: player.appearance,
      accessories: player.accessories,
    });
  }
  function sceneKind(id, verified) {
    return verified ? window.HoopWireCore.choose(id, ['action', 'interview', 'action'], 'scene-kind') : 'action';
  }
  const actionVariants = [
    'drive',
    'close-up',
    'dunk',
    'three-point',
    'pass',
    'pass-close-up',
    'drive-tight',
    'shot-close-up',
    'pass-tight',
    'dunk-tight',
  ];
  const injuryVariants = ['injury', 'injury-close'];
  const interviewVariants = ['group', 'player-close-up', 'player-profile', 'player-coach'];
  function interviewDesign(seed, variant) {
    variant = interviewVariants.includes(variant)
      ? variant
      : window.HoopWireCore.choose(seed, interviewVariants, 'interview-framing');
    const cameras = {
      group: [0, 0, 768, 432],
      'player-close-up': [224, 126, 320, 180],
      'player-profile': [260, 126, 320, 180],
      'player-coach': [100, 104, 576, 324],
    };
    return { variant, camera: [...cameras[variant]] };
  }
  function actionDesign(seed, variant, side) {
    variant = [...actionVariants, ...injuryVariants].includes(variant)
      ? variant
      : window.HoopWireCore.choose(seed, actionVariants, 'action-variant');
    const layouts = {
      drive: {
        label: 'Drive to the basket',
        pose: 'dribbling',
        frame: 1,
        camera: [510, 94, 384, 216],
        subject: [695, 270],
        support: [
          [615, 192],
          [641, 291],
          [684, 185],
          [762, 249],
          [783, 299],
        ],
      },
      'close-up': {
        label: 'Close-up ball handling',
        pose: 'dribbling',
        frame: 1,
        camera: [626, 176, 192, 108],
        subject: [695, 270],
        support: [
          [649, 235],
          [755, 265],
          [672, 217],
          [750, 245],
          [790, 275],
        ],
      },
      dunk: {
        label: 'Dunk approach',
        pose: 'dunking',
        frame: 0,
        camera: [688, 148, 192, 108],
        subject: [778, 216],
        groundFoot: 276,
        support: [
          [714, 228],
          [734, 254],
          [720, 204],
          [813, 249],
          [847, 247],
        ],
      },
      'three-point': {
        label: 'Three-point shot',
        pose: 'shooting',
        frame: 4,
        camera: [576, 158, 256, 144],
        subject: [610, 250],
        groundFoot: 256,
        flightBall: [636, 204],
        support: [
          [717, 205],
          [738, 286],
          [662, 251],
          [762, 249],
          [791, 290],
        ],
      },
      pass: {
        label: 'Passing to a teammate',
        pose: 'passing',
        frame: 2,
        camera: [576, 158, 256, 144],
        subject: [665, 254],
        flightBall: [694, 236],
        support: [
          [760, 264],
          [702, 201],
          [713, 216],
          [780, 283],
          [791, 208],
        ],
      },
      'pass-close-up': {
        label: 'Close-up passing',
        pose: 'passing',
        frame: 2,
        camera: [620, 172, 192, 108],
        subject: [665, 254],
        flightBall: [694, 236],
        support: [
          [760, 264],
          [702, 201],
          [713, 216],
          [787, 273],
          [791, 208],
        ],
      },
      'drive-tight': {
        label: 'Player close-up driving',
        pose: 'dribbling',
        frame: 1,
        camera: [647, 222, 96, 54],
        subject: [695, 270],
        support: [
          [615, 192],
          [641, 291],
          [684, 185],
          [762, 249],
          [783, 299],
        ],
      },
      'shot-close-up': {
        label: 'Player close-up shooting',
        pose: 'shooting',
        frame: 4,
        camera: [566, 194, 112, 63],
        subject: [610, 250],
        groundFoot: 256,
        flightBall: [636, 204],
        support: [
          [717, 205],
          [738, 286],
          [698, 251],
          [762, 249],
          [791, 290],
        ],
      },
      'pass-tight': {
        label: 'Player close-up passing',
        pose: 'passing',
        frame: 2,
        camera: [617, 206, 96, 54],
        subject: [665, 254],
        flightBall: [694, 236],
        support: [
          [760, 264],
          [702, 191],
          [743, 216],
          [787, 273],
          [791, 208],
        ],
      },
      'dunk-tight': {
        label: 'Player close-up dunking',
        pose: 'dunking',
        frame: 0,
        camera: [730, 168, 96, 54],
        subject: [778, 216],
        groundFoot: 276,
        support: [
          [714, 228],
          [734, 254],
          [720, 204],
          [813, 249],
          [847, 247],
        ],
      },
      // Injuries: the player down on the floor in the game's injured pose,
      // teammates standing over them, the opponents a step away.
      injury: {
        label: 'Injury on the floor',
        pose: 'injured-leg',
        frame: 0,
        camera: [576, 158, 256, 144],
        subject: [680, 254],
        support: [
          [652, 238],
          [710, 242],
          [618, 270],
          [758, 274],
          [788, 220],
        ],
      },
      'injury-close': {
        label: 'Close-up of an injury',
        pose: 'injured-leg',
        frame: 0,
        camera: [624, 200, 128, 72],
        subject: [680, 254],
        support: [
          [652, 238],
          [710, 242],
          [618, 270],
          [758, 274],
          [788, 220],
        ],
      },
    };
    side = ['left', 'right'].includes(side) ? side : window.HoopWireCore.choose(seed, ['left', 'right'], 'court-side');
    const action = { variant, side, ...structuredClone(layouts[variant]) };
    if (side === 'left') {
      action.camera[0] = 1024 - action.camera[0] - action.camera[2];
      action.subject[0] = 1024 - action.subject[0];
      action.support.forEach(point => (point[0] = 1024 - point[0]));
      if (action.flightBall) action.flightBall[0] = 1024 - action.flightBall[0];
    }
    return action;
  }
  function upgrade(scene, story, context) {
    const saved = structuredClone(scene);
    const enriched = context ? inputs(context, story.id) : {};
    const action = actionDesign(story.id);
    return {
      ...saved,
      version: 16,
      seed: story.id,
      attackDirection: action.side,
      action,
      interview: interviewDesign(story.id, saved.interview?.variant),
      ball: saved.ball || enriched.ball || { pri: 'E37033', sec: 'E37033', ter: 'E37033', outline: '44220F' },
      teammates: saved.teammates || enriched.teammates || [],
      opponents: saved.opponents || enriched.opponents || (saved.opponentPlayer ? [saved.opponentPlayer] : []),
      coach: saved.coach || enriched.coach || story.coach || null,
      kind: saved.kind || sceneKind(story.id, !!story.playerStats),
      pose: action.pose,
    };
  }
  function inputs(ctx, id, league = {}) {
    const C = window.HoopWireCore;
    const team = ctx.potgSnapshot?.team || ctx.winner;
    const opponent = team?.id === ctx.loser?.id ? ctx.winner : ctx.loser;
    const liveTeam = team?.id === ctx.loser?.id ? ctx.loser : ctx.winner;
    const featured = ctx.potg || ctx.scenePlayer;
    const teammates = (liveTeam?.roster || [])
      .filter(p => p.id !== featured?.id)
      .sort((a, b) => a.id - b.id)
      .slice(0, 2)
      .map(playerSnapshot);
    // An injury story shows the player down on the floor in an action scene.
    const action = actionDesign(id, ctx.injury ? C.choose(id, injuryVariants, 'injury-framing') : undefined);
    return {
      version: 16,
      seed: id,
      league: { name: league.leagueName || ctx.leagueName, logoURL: league.logoURL || null },
      attackDirection: action.side,
      action,
      interview: interviewDesign(id, ctx.interviewVariant),
      ball: structuredClone(ctx.gameBall),
      kind: ctx.injury ? 'action' : ctx.sceneKind || sceneKind(id, ctx.potgStatsTrusted),
      event: ctx.event || null,
      pose: action.pose,
      player: playerSnapshot(ctx.potg || ctx.scenePlayer),
      team: teamSnapshot(team),
      opponent: teamSnapshot(opponent),
      opponentPlayer: playerSnapshot(opponent?.roster?.[0]),
      opponents: (opponent?.roster || []).slice(0, 3).map(playerSnapshot),
      uniformIndex: team?.id === ctx.game.homeTeam ? 0 : 1,
      opponentUniformIndex: opponent?.id === ctx.game.homeTeam ? 0 : 1,
      teammates,
      coach: C.coachForTeam(liveTeam),
      home: teamSnapshot(ctx.home),
      gameContext:
        ctx.game?.winner != null
          ? { result: team?.id === ctx.game.winner ? 'win' : 'loss', day: ctx.dayNumber, season: ctx.seasonYear }
          : null,
    };
  }
  function caption(scene, story = {}) {
    if (!scene) return null;
    if (String(scene.kind).startsWith('coach-')) {
      const day = story.day,
        year = story.season ?? scene.season;
      return [
        window.HoopWireCoachScenes.caption(scene),
        [Number.isFinite(day) ? `Day ${day}` : null, Number.isFinite(Number(year)) ? String(year) : null]
          .filter(Boolean)
          .join(', ') || null,
      ]
        .filter(Boolean)
        .join(' | ');
    }
    const C = window.HoopWireCore,
      name = scene.player ? C.playerDisplay(scene.player) : C.teamDisplay(scene.team);
    const game = story.gameSummary,
      teams = game ? [game.home, game.away].filter(Boolean) : [];
    const own = teams.find(t => (t.id != null && t.id === scene.team?.id) || t.name === C.teamDisplay(scene.team));
    const other = own ? teams.find(t => t !== own) : null,
      opponent = other?.name || C.teamDisplay(scene.opponent);
    let result = scene.gameContext?.result;
    if (own && other && Number.isFinite(own.score) && Number.isFinite(other.score))
      result = own.score === other.score ? 'tie' : own.score > other.score ? 'win' : 'loss';
    let description;
    if (scene.kind === 'interview' && scene.player?.isCoach) {
      description = `Coach ${name} speaks with reporters.`;
    } else if (scene.kind === 'interview') {
      const participants = [name];
      const variant = scene.interview?.variant || 'group';
      if (variant === 'group') {
        if (scene.teammates?.[0]) participants.push(C.playerDisplay(scene.teammates[0]));
        if (scene.coach) participants.push(`Coach ${C.playerDisplay(scene.coach)}`);
        else if (scene.teammates?.[1]) participants.push(C.playerDisplay(scene.teammates[1]));
      } else if (variant === 'player-coach') {
        if (scene.coach) participants.push(`Coach ${C.playerDisplay(scene.coach)}`);
        else if (scene.teammates?.[0]) participants.push(C.playerDisplay(scene.teammates[0]));
      }
      const group =
        participants.length > 1 ? participants.slice(0, -1).join(', ') + ' and ' + participants.at(-1) : name;
      const plural = participants.length > 1;
      description = scene.event
        ? `${group} ${plural ? 'meet' : 'meets'} the press before the ${scene.event}.`
        : story.kind === 'season'
          ? `${group} ${plural ? 'discuss' : 'discusses'} ${story.type === 'Award announcement' ? 'the award announcement' : 'the season'}.`
          : `${group} ${plural ? 'answer' : 'answers'} postgame questions${result === 'win' ? ' after a win' : result === 'loss' ? ' after a loss' : result === 'tie' ? ' after a tied game' : ''}.`;
    } else {
      const actions = {
        drive: 'drives to the basket',
        'close-up': 'handles the ball',
        dunk: 'goes up for a dunk',
        'three-point': 'takes a three-point shot',
        pass: 'passes to a teammate',
        'pass-close-up': 'passes to a teammate',
        injury: 'goes down with an injury',
        'injury-close': 'goes down with an injury',
        'drive-tight': 'drives to the basket',
        'shot-close-up': 'takes a three-point shot',
        'pass-tight': 'passes to a teammate',
        'dunk-tight': 'goes up for a dunk',
      };
      description = `${name} ${actions[scene.action?.variant] || 'in action'} against ${opponent}.`;
    }
    const matchup =
      teams.length === 2
        ? `${teams[0].name} vs ${teams[1].name}`
        : scene.team && scene.opponent
          ? `${C.teamDisplay(scene.team)} vs ${C.teamDisplay(scene.opponent)}`
          : null;
    const day = story.day ?? scene.gameContext?.day,
      year = story.season ?? scene.gameContext?.season;
    const date = [Number.isFinite(day) ? `Day ${day}` : null, Number.isFinite(year) ? String(year) : null]
      .filter(Boolean)
      .join(', ');
    return [description, story.kind === 'season' || scene.player?.isCoach ? null : matchup, date || null]
      .filter(Boolean)
      .join(' | ');
  }
  function player(ctx, data, team, uniform, x, y, size, pose = 'idle', frame = 0, facing = 'left', ball = {}) {
    if (!data) return;
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 168;
    window.HoopWirePlayer.draw(tile, data, team, uniform, frame, pose, facing, ball);
    ctx.drawImage(tile, x, y, size, (size * 42) / 32);
  }
  async function render(scene, story = {}) {
    await load();
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 432;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let customCourt = null,
      sceneInputs = scene;
    if (String(scene.kind).startsWith('coach-')) {
      // Coach stories: hiring, firing, a rough season, a good one.
      const drawn = await window.HoopWireCoachScenes.draw(scene, art),
        extra = drawn.extra || {};
      ctx.drawImage(drawn.canvas, 0, 0);
      sceneInputs = {
        ...scene,
        ...(extra.pressLogoData !== undefined
          ? { pressLogoData: extra.pressLogoData, pressLeagueLogoData: extra.pressLeagueLogoData }
          : {}),
        ...(extra.adsData !== undefined ? { adsData: extra.adsData } : {}),
      };
      customCourt = extra.customCourt || null;
    } else if (scene.kind === 'interview') {
      const stage = document.createElement('canvas');
      stage.width = 768;
      stage.height = 432;
      const press = stage.getContext('2d');
      press.imageSmoothingEnabled = false;
      const design = interviewDesign(scene.seed, scene.interview?.variant || 'group'),
        variant = design.variant;
      // A wall tile spans twice its pixel size in the world; render it at the
      // camera's zoom so the logos land on screen without being resampled.
      const backdrop = await window.HoopWirePressBackdrop.render(
        art['press-background'],
        scene.team,
        scene.pressLogoData,
        { scale: (2 * canvas.width) / design.camera[2], league: scene.league, leagueData: scene.pressLeagueLogoData }
      );
      sceneInputs = {
        ...scene,
        pressLogoData: backdrop.logoData,
        pressLogoStatus: backdrop.status,
        pressLeagueLogoData: backdrop.leagueLogoData,
        pressLeagueLogoStatus: backdrop.leagueStatus,
      };
      window.HoopWirePressBackdrop.paint(ctx, backdrop, design.camera);
      const left = scene.teammates?.[0],
        right = scene.coach || scene.teammates?.[1];
      if (variant === 'group') {
        player(press, left, scene.team, scene.uniformIndex, 56, 104, 192);
        player(press, scene.player, scene.team, scene.uniformIndex, 288, 104, 192);
        player(press, right, scene.team, scene.uniformIndex, 520, 104, 192);
      } else if (variant === 'player-coach' && (scene.coach || left)) {
        // The two seats of the two-microphone desk, each between a mic and a water bottle.
        player(press, scene.player, scene.team, scene.uniformIndex, 160, 104, 192);
        player(press, scene.coach || left, scene.team, scene.uniformIndex, 424, 104, 192);
      } else {
        player(
          press,
          scene.player,
          scene.team,
          scene.uniformIndex,
          288,
          104,
          192,
          'idle',
          variant === 'player-profile' ? 1 : 0,
          variant === 'player-profile' ? 'right' : 'left'
        );
      }
      // Build every participant and prop at the same scale, then move the camera.
      // This keeps the desk, microphones and backdrop in proportion to the player.
      // Two at the table use the two-microphone desk; everyone else the three-seat one.
      const desk = variant === 'player-coach' && (scene.coach || left) ? art['press-table_2p'] : art['press-table'];
      press.drawImage(desk, 0, 218, 768, 192);
      press.drawImage(desk, 0, 31, 128, 1, 0, 410, 768, 22);
      ctx.drawImage(stage, ...design.camera, 0, 0, 768, 432);
    } else {
      const floor = await window.HoopWireCourt.render(scene.home || scene.team, { includeHoops: false });
      customCourt = floor.customCourt;
      const world = document.createElement('canvas');
      world.width = 2048;
      world.height = 1024;
      const game = world.getContext('2d');
      game.imageSmoothingEnabled = false;
      game.scale(2, 2);
      game.drawImage(floor.canvas, 0, 0);
      // Native player sprites are 32 x 42, on the native 1024 x 512 court.
      // Compose directly at 2x so the finer native number layer survives.
      // The close crop preserves court geometry and keeps players in proportion.
      const action = scene.action || actionDesign(scene.seed, 'drive');
      const attack = action.side || scene.attackDirection || 'right',
        defense = attack === 'right' ? 'left' : 'right';
      function actor(data, team, uniform, x, foot, pose, frame, groundFoot = foot) {
        if (!data) return;
        player(
          game,
          data,
          team,
          uniform,
          x - 16,
          foot - 42,
          32,
          pose,
          frame,
          team?.id === scene.team?.id ? attack : defense,
          scene.ball
        );
      }
      const actors = [
        [scene.teammates?.[0], scene.team, scene.uniformIndex, ...action.support[0], 'idle', 0],
        [scene.teammates?.[1], scene.team, scene.uniformIndex, ...action.support[1], 'idle', 0],
        [scene.opponents?.[1], scene.opponent, scene.opponentUniformIndex, ...action.support[2], 'idle', 0],
        [
          scene.opponents?.[0] || scene.opponentPlayer,
          scene.opponent,
          scene.opponentUniformIndex,
          ...action.support[3],
          'idle',
          0,
        ],
        [
          scene.player,
          scene.team,
          scene.uniformIndex,
          ...action.subject,
          scene.pose || action.pose,
          action.frame,
          action.groundFoot || action.subject[1],
        ],
        [scene.opponents?.[2], scene.opponent, scene.opponentUniformIndex, ...action.support[4], 'idle', 0],
      ];
      // Shadows stay on the floor. Bodies and hoop structures share the same
      // ground-depth ordering, including the ground point of airborne players.
      for (const args of actors) {
        if (!args[0]) continue;
        game.fillStyle = '#00000033';
        game.beginPath();
        game.ellipse(args[3], (args[7] ?? args[4]) - 2, 11, 4, 0, 0, Math.PI * 2);
        game.fill();
      }
      const layers = actors.map(args => ({ depth: args[7] ?? args[4], order: 0, draw: () => actor(...args) }));
      layers.push(...floor.hoopLayers.map(layer => ({ ...layer, order: 1, draw: () => layer.draw(game) })));
      layers.sort((a, b) => a.depth - b.depth || a.order - b.order).forEach(layer => layer.draw());
      if (action.flightBall) {
        const ball = document.createElement('canvas');
        ball.width = ball.height = 16;
        window.HoopWirePlayer.drawBall(ball, scene.ball);
        game.drawImage(ball, action.flightBall[0] - 4, action.flightBall[1] - 4, 8, 8);
      }
      const [x, y, w, h] = action.camera;
      ctx.drawImage(world, x * 2, y * 2, w * 2, h * 2, 0, 0, 768, 432);
    }
    const blob = await new Promise((resolve, reject) =>
      // Lossless WebP keeps every pixel and is about a third the size of PNG. A browser that cannot
      // write WebP returns a PNG instead.
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not compose the article image.'))), 'image/webp', 1)
    );
    const text = caption(scene, story);
    return { imageBlob: blob, sceneInputs, customCourt, imageAlt: text, imageCaption: text };
  }
  async function refreshFraming(stories, leagues = []) {
    const pending = stories.filter(
        s =>
          (s.sceneInputs?.kind === 'interview' &&
            ((s.sceneInputs.version || 0) < 16 ||
              leagues.some(l => l.id === s.fingerprint && l.logoURL && l.logoURL !== s.sceneInputs.league?.logoURL))) ||
          (s.sceneInputs?.kind === 'action' && (s.sceneInputs.version || 0) < 10)
      ),
      updated = [];
    for (let i = 0; i < pending.length; i += 4) {
      updated.push(
        ...(await Promise.all(
          pending.slice(i, i + 4).map(async story => {
            const scene = upgrade(story.sceneInputs, story),
              league = leagues.find(l => l.id === story.fingerprint);
            if (league) {
              if (league.logoURL && league.logoURL !== scene.league?.logoURL) scene.pressLeagueLogoData = null;
              scene.league = {
                ...scene.league,
                name: league.name,
                logoURL: league.logoURL || scene.league?.logoURL || null,
              };
            }
            const rendered = await render(scene, story);
            // Retain a saved custom court if its source is unavailable on this visit.
            if (
              story.imageBlob &&
              story.customCourt?.status === 'loaded' &&
              rendered.customCourt?.status === 'unavailable'
            )
              return story;
            return { ...story, ...rendered };
          })
        ))
      );
    }
    return updated;
  }
  window.HoopWireScenes = {
    inputs,
    render,
    upgrade,
    actionDesign,
    actionVariants,
    interviewDesign,
    interviewVariants,
    refreshFraming,
    caption,
  };
})();
