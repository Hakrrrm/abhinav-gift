'use client';

import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5_000;

export default function Player() {
  const [playlist, setPlaylist] = useState(null); // null = loading
  const [tick, setTick] = useState(0); // increments on every advance, forces remount
  const [playlistVersion, setPlaylistVersion] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const videoRef = useRef(null);
  const playlistJson = useRef('');

  // Poll the playlist so the TV picks up admin changes on its own.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/playlist?v=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const json = JSON.stringify(data);
        if (!cancelled && json !== playlistJson.current) {
          const hadPlaylist = playlistJson.current !== '';
          playlistJson.current = json;
          videoRef.current?.pause();
          setNeedsTap(false);
          setTick((t) => (hadPlaylist ? t + 1 : 0));
          setPlaylistVersion((version) => version + 1);
          setPlaylist(data);
        }
      } catch {
        // Network blip — keep playing what we have and retry on next poll.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const items = playlist?.items ?? [];
  const item = items.length > 0 ? items[tick % items.length] : null;
  const imageDurationMs = (playlist?.settings?.imageDurationSeconds ?? 8) * 1000;

  const advance = () => setTick((t) => t + 1);

  // Images advance on a timer; videos advance via onEnded.
  useEffect(() => {
    if (!item || item.type !== 'image') return;
    const timer = setTimeout(advance, imageDurationMs);
    return () => clearTimeout(timer);
  }, [item, tick, imageDurationMs]);

  // Some TV browsers refuse autoplay until the user interacts once.
  useEffect(() => {
    if (!item || item.type !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt?.catch) {
      attempt.catch(() => setNeedsTap(true));
    }
  }, [item, tick]);

  const handleTap = () => {
    setNeedsTap(false);
    videoRef.current?.play().catch(() => {});
  };

  if (playlist === null) {
    return (
      <div className="player-message">
        <h1>Loading…</h1>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="player-message">
        <h1>No media yet</h1>
        <p>Upload images or videos from the /admin page.</p>
      </div>
    );
  }

  return (
    <div className="player">
      {item.type === 'video' ? (
        <video
          key={`${playlistVersion}-${item.url}-${tick}`}
          ref={videoRef}
          src={item.url}
          autoPlay
          muted
          playsInline
          onEnded={advance}
          onError={advance}
        />
      ) : (
        <img
          key={`${playlistVersion}-${item.url}-${tick}`}
          src={item.url}
          alt=""
          onError={advance}
        />
      )}
      {needsTap && (
        <div className="tap-overlay" onClick={handleTap}>
          Tap / press OK to start playback
        </div>
      )}
    </div>
  );
}
