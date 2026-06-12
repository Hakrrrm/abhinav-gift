'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5_000;

function nextIndex(index, itemCount) {
  if (itemCount === 0) return 0;
  return (index + 1) % itemCount;
}

function buildSlots(items, activeIndex, activeSlot) {
  const slots = [null, null];
  if (items.length === 0) return slots;

  slots[activeSlot] = {
    item: items[activeIndex],
    index: activeIndex,
  };

  const standbySlot = 1 - activeSlot;
  const standbyIndex = nextIndex(activeIndex, items.length);
  slots[standbySlot] = {
    item: items[standbyIndex],
    index: standbyIndex,
  };

  return slots;
}

export default function Player() {
  const [playlist, setPlaylist] = useState(null); // null = loading
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState(0);
  const [slots, setSlots] = useState([null, null]);
  const [playlistVersion, setPlaylistVersion] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const videoRefs = useRef([null, null]);
  const playlistJson = useRef('');
  const advancingRef = useRef(false);
  const activeIndexRef = useRef(0);

  const items = playlist?.items ?? [];
  const imageDurationMs = (playlist?.settings?.imageDurationSeconds ?? 8) * 1000;

  const advance = useCallback(() => {
    if (items.length === 0 || advancingRef.current) return;

    advancingRef.current = true;
    setNeedsTap(false);
    videoRefs.current[activeSlot]?.pause();

    const nextActiveSlot = 1 - activeSlot;
    const nextActiveIndex = slots[nextActiveSlot]?.index ?? nextIndex(activeIndex, items.length);

    setActiveSlot(nextActiveSlot);
    setActiveIndex(nextActiveIndex);
    setSlots(buildSlots(items, nextActiveIndex, nextActiveSlot));

    window.setTimeout(() => {
      advancingRef.current = false;
    }, 250);
  }, [activeIndex, activeSlot, items, slots]);

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
          const nextItems = data.items ?? [];
          const nextActiveIndex =
            hadPlaylist && nextItems.length > 0
              ? nextIndex(activeIndexRef.current, nextItems.length)
              : 0;

          playlistJson.current = json;
          videoRefs.current.forEach((video) => video?.pause());
          setNeedsTap(false);
          setActiveIndex(nextActiveIndex);
          setActiveSlot(0);
          setSlots(buildSlots(nextItems, nextActiveIndex, 0));
          setPlaylistVersion((version) => version + 1);
          setPlaylist(data);
        }
      } catch {
        // Network blip: keep playing what we have and retry on next poll.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeEntry = slots[activeSlot];
  const activeItem = activeEntry?.item ?? null;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Images advance on a timer; videos advance only after they fully end.
  useEffect(() => {
    if (!activeItem || activeItem.type !== 'image') return;
    const timer = setTimeout(advance, imageDurationMs);
    return () => clearTimeout(timer);
  }, [activeItem, activeIndex, imageDurationMs, advance]);

  // Keep the active video playing and the standby video preloaded but paused.
  useEffect(() => {
    videoRefs.current.forEach((video, slot) => {
      if (!video) return;

      if (slot !== activeSlot) {
        video.pause();
        video.load();
        return;
      }

      const attempt = video.play();
      if (attempt?.catch) {
        attempt.catch(() => setNeedsTap(true));
      }
    });
  }, [activeSlot, activeIndex, playlistVersion]);

  const handleTap = () => {
    setNeedsTap(false);
    videoRefs.current[activeSlot]?.play().catch(() => {});
  };

  if (playlist === null) {
    return (
      <div className="player-message">
        <h1>Loading...</h1>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div className="player-message">
        <h1>No media yet</h1>
        <p>Upload images or videos from the /admin page.</p>
      </div>
    );
  }

  return (
    <div className="player">
      {slots.map((entry, slot) => {
        if (!entry?.item) return null;

        const item = entry.item;
        const isActive = slot === activeSlot;
        const key = `${playlistVersion}-${slot}-${entry.index}-${item.url}`;

        return (
          <div
            className={`player-layer${isActive ? ' active' : ''}`}
            key={key}
            aria-hidden={!isActive}
          >
            {item.type === 'video' ? (
              <video
                ref={(node) => {
                  videoRefs.current[slot] = node;
                }}
                src={item.url}
                autoPlay={isActive}
                muted
                playsInline
                preload="auto"
                onEnded={advance}
                onError={advance}
              />
            ) : (
              <img src={item.url} alt="" onError={advance} />
            )}
          </div>
        );
      })}
      {needsTap && (
        <div className="tap-overlay" onClick={handleTap}>
          Tap / press OK to start playback
        </div>
      )}
    </div>
  );
}
