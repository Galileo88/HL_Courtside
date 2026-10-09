/* Atomic browser archive; blobs stay outside localStorage. */
(() => {
  'use strict';
  const STORES = ['stories', 'snapshots', 'leagues', 'meta', 'profiles'];
  const request = req =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  class Archive {
    async open() {
      // Version 2 adds player, coach and team profiles; older archives keep everything else.
      const req = indexedDB.open('hoopwire.daily.v1', 2);
      req.onupgradeneeded = () => {
        for (const name of STORES)
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
      };
      this.db = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('Close other HoopWire tabs, then reload to open the archive.'));
      });
      this.db.onversionchange = () => this.db.close();
      this.migrationError = null;
      try {
        await this.migrate();
      } catch (error) {
        this.migrationError = error.message;
      }
      return this;
    }
    async all(name) {
      return request(this.db.transaction(name).objectStore(name).getAll());
    }
    async get(name, id) {
      return request(this.db.transaction(name).objectStore(name).get(id));
    }
    async reset(fingerprint) {
      if (typeof fingerprint !== 'string' || !fingerprint) throw new Error('Choose a league archive to reset.');
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Archive reset failed.'));
        tx.onabort = () => reject(tx.error || new Error('Archive reset was aborted.'));
        for (const name of ['stories', 'snapshots', 'profiles']) {
          const cursor = tx.objectStore(name).openCursor();
          cursor.onsuccess = () => {
            const record = cursor.result;
            if (!record) return;
            if (record.value.fingerprint === fingerprint) record.delete();
            record.continue();
          };
        }
        tx.objectStore('leagues').delete(fingerprint);
        // Keep the original recovery copy without re-importing reset coverage.
        tx.objectStore('meta').put({ id: 'legacy-migrated', date: new Date().toISOString() });
      });
    }
    async resetAll() {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Archive reset failed.'));
        tx.onabort = () => reject(tx.error || new Error('Archive reset was aborted.'));
        for (const name of ['stories', 'snapshots', 'leagues', 'profiles']) tx.objectStore(name).clear();
        // Keep the original recovery copy without re-importing reset coverage.
        tx.objectStore('meta').put({ id: 'legacy-migrated', date: new Date().toISOString() });
      });
    }
    async write(records) {
      const names = Object.keys(records).filter(name => records[name].length);
      if (!names.length) return;
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(names, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Archive write failed.'));
        tx.onabort = () => reject(tx.error || new Error('Archive write was aborted.'));
        try {
          for (const name of names) for (const record of records[name]) tx.objectStore(name).put(record);
        } catch (error) {
          tx.abort();
          reject(error);
        }
      });
    }
    async remove(name, ids) {
      if (!ids.length) return;
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(name, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Archive delete failed.'));
        for (const id of ids) tx.objectStore(name).delete(id);
      });
    }
    async migrate() {
      if (await this.get('meta', 'legacy-migrated')) return;
      let text;
      try {
        text = localStorage.getItem('hoopwire.archive.v1');
      } catch {
        return;
      } // IndexedDB may still work when localStorage is unavailable.
      if (!text) return;
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('The old archive is invalid; its original data has been retained.');
      const existing = new Set((await this.all('stories')).map(s => s.id));
      const stories = Object.values(parsed).filter(s => !existing.has(s.id));
      if (stories.some(s => !validStory(s)))
        throw new Error('The old archive contains invalid stories; its original data has been retained.');
      const leagues = new Map();
      for (const story of stories) {
        story.leagueName ||= `Archived league ${story.fingerprint}`;
        leagues.set(story.fingerprint, { id: story.fingerprint, name: story.leagueName });
      }
      const oldLeagues = new Set((await this.all('leagues')).map(l => l.id));
      await this.write({
        stories,
        leagues: [...leagues.values()].filter(l => !oldLeagues.has(l.id)),
        meta: [{ id: 'legacy-migrated', date: new Date().toISOString() }],
      });
      // Keep the original localStorage archive as a recovery copy.
    }
    async exportData(fingerprint) {
      const stories = (await this.all('stories')).filter(s => !fingerprint || s.fingerprint === fingerprint);
      for (const story of stories) {
        if (story.imageBlob) {
          story.imageData = await encodeImage(story.imageBlob);
          delete story.imageBlob;
        }
      }
      const leagues = (await this.all('leagues')).filter(l => !fingerprint || l.id === fingerprint);
      for (const league of leagues)
        for (const studio of Object.values(league.studios || {})) {
          if (studio.imageBlob) {
            studio.imageData = await encodeImage(studio.imageBlob);
            delete studio.imageBlob;
          }
          if (studio.backdropBlob) {
            studio.backdropData = await encodeImage(studio.backdropBlob);
            delete studio.backdropBlob;
          }
        }
      return {
        format: 'hoopwire-daily',
        version: 1,
        stories,
        snapshots: (await this.all('snapshots')).filter(s => !fingerprint || s.fingerprint === fingerprint),
        leagues,
        profiles: (await this.all('profiles')).filter(p => !fingerprint || p.fingerprint === fingerprint),
      };
    }
    async importData(data) {
      if (
        data?.format !== 'hoopwire-daily' ||
        data.version !== 1 ||
        !['stories', 'snapshots', 'leagues'].every(k => Array.isArray(data[k]))
      )
        throw new Error('This is not a supported HoopWire backup.');
      const C = window.HoopWireCore;
      for (const story of data.stories) {
        if (!validStory(story)) throw new Error('Backup contains an invalid article.');
        if (story.templateVersion === 3 && story.playerStats && !C.validStats(story.playerStats))
          throw new Error('Backup contains invalid player stats.');
        if (story.imageData) {
          story.imageBlob = decodeImage(story.imageData);
          delete story.imageData;
        }
      }
      for (const snap of data.snapshots) {
        if (
          typeof snap.id !== 'string' ||
          !C.validStats(snap.stats) ||
          snap.id !== C.snapshotId(snap.fingerprint, snap.season, snap.gid, snap.pid) ||
          snap.player?.id !== snap.pid ||
          !Number.isInteger(snap.day) ||
          snap.day < 1
        )
          throw new Error('Backup contains an invalid stat snapshot.');
      }
      // Backups made before profiles existed have none.
      data.profiles ||= [];
      if (
        !Array.isArray(data.profiles) ||
        data.profiles.some(
          p =>
            typeof p?.fingerprint !== 'string' ||
            !['player', 'coach', 'team'].includes(p.kind) ||
            p.id !== `${p.fingerprint}:${p.kind}:${p.ref}` ||
            typeof p.name !== 'string'
        )
      )
        throw new Error('Backup contains an invalid profile.');
      if (data.leagues.some(l => typeof l.id !== 'string' || typeof l.name !== 'string'))
        throw new Error('Backup contains an invalid league.');
      for (const league of data.leagues) {
        if (league.studios && (typeof league.studios !== 'object' || Array.isArray(league.studios)))
          throw new Error('Backup contains invalid studios.');
        for (const studio of Object.values(league.studios || {})) {
          if (
            !studio?.inputs ||
            !Array.isArray(studio.inputs.announcers) ||
            studio.inputs.announcers.length !== 4 ||
            studio.inputs.announcers.some(p => typeof p.fn !== 'string' || typeof p.ln !== 'string')
          )
            throw new Error('Backup contains an invalid studio.');
          if (studio.imageData) {
            studio.imageBlob = decodeImage(studio.imageData);
            delete studio.imageData;
          }
          if (studio.backdropData) {
            studio.backdropBlob = decodeImage(studio.backdropData);
            delete studio.backdropData;
          }
        }
      }
      const records = {};
      for (const name of ['stories', 'snapshots', 'leagues', 'profiles']) {
        const ids = new Set((await this.all(name)).map(r => r.id));
        const seen = new Set();
        records[name] = data[name].filter(r => {
          if (seen.has(r.id)) throw new Error('Backup contains duplicate records.');
          seen.add(r.id);
          return !ids.has(r.id);
        });
      }
      await this.write(records);
      return records.stories.length;
    }
  }
  function encodeImage(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  function decodeImage(data) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) throw new Error('Backup contains an invalid image.');
    const bytes = Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0));
    if (bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
      throw new Error('Backup image is not a PNG.');
    return new Blob([bytes], { type: 'image/png' });
  }
  function validStory(s) {
    return (
      s &&
      typeof s.id === 'string' &&
      typeof s.fingerprint === 'string' &&
      ['string', 'number'].includes(typeof s.season) &&
      Number.isInteger(s.day) &&
      s.day > 0 &&
      ((Number.isInteger(s.gid) && s.gid > 0 && s.id === `${s.fingerprint}:${s.season}:game:${s.gid}`) ||
        (s.kind === 'performance' &&
          Number.isInteger(s.gid) &&
          Number.isInteger(s.playerId) &&
          s.id === `${s.fingerprint}:${s.season}:performance:${s.gid}:${s.playerId}`) ||
        (s.kind === 'season' &&
          typeof s.eventKey === 'string' &&
          /^[a-z0-9-]+$/.test(s.eventKey) &&
          s.id === `${s.fingerprint}:${s.season}:season:${s.eventKey}` &&
          Array.isArray(s.relatedTeams) &&
          s.relatedTeams.every(t => Number.isInteger(t.id) && typeof t.name === 'string') &&
          Array.isArray(s.seasonSnapshot?.headers) &&
          s.seasonSnapshot.headers.every(h => typeof h === 'string') &&
          Array.isArray(s.seasonSnapshot.rows) &&
          s.seasonSnapshot.rows.every(
            r =>
              Array.isArray(r) &&
              r.length === s.seasonSnapshot.headers.length &&
              r.every(v => typeof v === 'string' || Number.isFinite(v))
          ))) &&
      typeof s.headline === 'string' &&
      Array.isArray(s.paragraphs) &&
      s.paragraphs.every(p => typeof p === 'string')
    );
  }
  window.HoopWireArchive = Archive;
})();
